import { curveBumpX, curveBumpY, line as d3Line } from 'd3-shape';
import { layoutTree } from './layoutTree.js';

export const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Unnamed person';
export function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage can be unavailable or full. */
  }
}
export function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Storage can be unavailable. */
  }
}
const horizontalRelationshipLine = d3Line().curve(curveBumpX);
const verticalRelationshipLine = d3Line().curve(curveBumpY);
export function relationshipPath(edge) {
  const points = [
    [edge.x1, edge.y1],
    [edge.x2, edge.y2],
  ];
  const horizontalRelationship = ['left', 'right'].includes(edge.fromSide) || ['left', 'right'].includes(edge.toSide);
  return (horizontalRelationship ? horizontalRelationshipLine : verticalRelationshipLine)(points);
}
export const year = (date) => (date ? new Date(date).getUTCFullYear() : '—');
export function formatLongDate(value) {
  if (!value) return 'Not added';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not added' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
export function relationshipLabel(role, relative, person) {
  if (role === 'Parent') return relative?.gender === 'male' ? 'Father' : relative?.gender === 'female' ? 'Mother' : 'Parent';
  if (role === 'Child') return relative?.gender === 'male' ? 'Son' : relative?.gender === 'female' ? 'Daughter' : 'Child';
  if (role === 'Partner') {
    if (person?.gender === 'male' && relative?.gender === 'female') return 'Wife';
    if (person?.gender === 'female' && relative?.gender === 'male') return 'Husband';
  }
  return role;
}
export function partnerRelationship(person, partnerId) {
  return (person?.partnerRelationships || []).find((link) => String(link.partnerId) === String(partnerId))?.label || '';
}
export function partnerDisplayLabel(person, relative) {
  const stored = partnerRelationship(person, relative?.id);
  return ['', 'Husband', 'Wife', 'Spouse'].includes(stored) ? relationshipLabel('Partner', relative, person) || stored || 'Partner' : stored;
}
export function descendantIds(people, personId) {
  const childrenByParent = new Map();
  people.forEach((person) =>
    (person.parentIds || []).forEach((parentId) => {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(person.id);
    }),
  );
  const found = new Set();
  const queue = [personId];
  while (queue.length) {
    const parentId = queue.shift();
    (childrenByParent.get(parentId) || []).forEach((childId) => {
      if (childId !== personId && !found.has(childId)) {
        found.add(childId);
        queue.push(childId);
      }
    });
  }
  return [...found];
}
export function familyColorMap(people, focalId) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const colors = new Map();
  if (!byId.has(focalId)) return colors;
  colors.set(focalId, 'focal');

  const visitedAncestors = new Set([focalId]);
  function addAncestors(personId, branch, depth, path) {
    const person = byId.get(personId);
    (person?.parentIds || [])
      .filter((id) => byId.has(id))
      .forEach((parentId, index) => {
        if (path.has(parentId)) return;
        const parent = byId.get(parentId);
        const side = depth === 0 ? (parent.gender === 'male' ? 'paternal' : parent.gender === 'female' ? 'maternal' : index === 0 ? 'paternal' : 'maternal') : branch;
        const ancestorGender = parent.gender === 'female' || parent.gender === 'male' ? parent.gender : 'unknown';
        const color = depth === 0 ? (side === 'paternal' ? 'father' : 'mother') : `${side}-${ancestorGender}`;
        if (!colors.has(parentId)) colors.set(parentId, color);
        if (visitedAncestors.has(parentId)) return;
        visitedAncestors.add(parentId);
        addAncestors(parentId, side, depth + 1, new Set([...path, parentId]));
      });
  }
  addAncestors(focalId, '', 0, new Set([focalId]));

  const childrenByParent = new Map();
  people.forEach((person) =>
    (person.parentIds || []).forEach((parentId) => {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(person);
    }),
  );
  const visitedDescendants = new Set([focalId]);
  function addDescendants(personId) {
    (childrenByParent.get(personId) || []).forEach((child) => {
      if (visitedDescendants.has(child.id)) return;
      const gender = child.gender === 'female' || child.gender === 'male' ? child.gender : 'unknown';
      if (!colors.has(child.id)) colors.set(child.id, `descendant-${gender}`);
      visitedDescendants.add(child.id);
      addDescendants(child.id);
    });
  }
  addDescendants(focalId);
  return colors;
}
export function linkLabelPoint(edge, label, positions, placedLabels, straight = false) {
  const halfWidth = Math.max(22, label.length * 3.1);
  const curveXs = [edge.x1, edge.x2, edge.c1x, edge.c2x].filter(Number.isFinite);
  const curveYs = [edge.y1, edge.y2, edge.c1y, edge.c2y].filter(Number.isFinite);
  const nearbyPositions = positions.filter(
    (position) =>
      position.x + position.w >= Math.min(...curveXs) - halfWidth - 6 &&
      position.x <= Math.max(...curveXs) + halfWidth + 6 &&
      position.y + position.h >= Math.min(...curveYs) - 100 &&
      position.y <= Math.max(...curveYs) + 100,
  );
  const candidates = [];
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const u = 1 - t;
    const x = straight ? edge.x1 + (edge.x2 - edge.x1) * t : u ** 3 * edge.x1 + 3 * u ** 2 * t * edge.c1x + 3 * u * t ** 2 * edge.c2x + t ** 3 * edge.x2;
    const curveY = straight ? edge.y1 + (edge.y2 - edge.y1) * t : u ** 3 * edge.y1 + 3 * u ** 2 * t * edge.c1y + 3 * u * t ** 2 * edge.c2y + t ** 3 * edge.y2;
    for (const offsetY of [0, -24, 24, -42, 42, -60, 60, -78, 78]) {
      const point = { x, y: curveY - 9 + offsetY };
      let collisions = 0;
      nearbyPositions.forEach((position) => {
        const nodeRight = position.x + position.w;
        const nodeBottom = position.y + position.h;
        if (point.x + halfWidth > position.x - 6 && point.x - halfWidth < nodeRight + 6 && point.y + 8 > position.y - 6 && point.y - 8 < nodeBottom + 6) collisions += 1;
      });
      placedLabels.forEach((placed) => {
        if (Math.abs(point.x - placed.x) < halfWidth + placed.halfWidth + 6 && Math.abs(point.y - placed.y) < 18) collisions += 1;
      });
      candidates.push({ ...point, halfWidth, score: collisions * 1000 + Math.abs(t - 0.5) * 10 + Math.abs(offsetY) * 0.1 });
    }
  }
  const best = candidates.sort((a, b) => a.score - b.score)[0] || { x: edge.labelX, y: edge.labelY, halfWidth };
  placedLabels.push({ x: best.x, y: best.y, halfWidth });
  return { x: best.x, y: best.y };
}
export function applyDragPositions(people, drag) {
  if (!drag.familyPositions) return people.map((person) => (person.id === drag.id ? { ...person, treeX: drag.lastX, treeY: drag.lastY } : person));
  const dx = drag.lastX - drag.x,
    dy = drag.lastY - drag.y;
  const starts = new Map(drag.familyPositions.map((position) => [position.id, position]));
  return people.map((person) => {
    const start = starts.get(person.id);
    return start ? { ...person, treeX: start.x + dx, treeY: start.y + dy } : person;
  });
}
function compactGenerationPositions(people, { nodeWidth = 196, coupleGap = 14, familyGap = 42, generationGap = 170 } = {}) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const levels = new Map();
  function levelFor(id, path = new Set()) {
    if (levels.has(id)) return levels.get(id);
    if (path.has(id)) return 0;
    const person = byId.get(id);
    const parentLevels = (person?.parentIds || []).filter((parentId) => byId.has(parentId)).map((parentId) => levelFor(parentId, new Set(path).add(id)));
    const level = parentLevels.length ? Math.max(...parentLevels) + 1 : 0;
    levels.set(id, level);
    return level;
  }
  people.forEach((person) => levelFor(person.id));
  // A spouse without recorded parents belongs on their partner's generation.
  for (let pass = 0; pass < people.length; pass += 1) {
    let changed = false;
    people.forEach((person) => {
      (person.partnerIds || []).forEach((partnerId) => {
        if (!byId.has(partnerId)) return;
        const sharedLevel = Math.max(levels.get(person.id) || 0, levels.get(partnerId) || 0);
        if (levels.get(person.id) !== sharedLevel) {
          levels.set(person.id, sharedLevel);
          changed = true;
        }
        if (levels.get(partnerId) !== sharedLevel) {
          levels.set(partnerId, sharedLevel);
          changed = true;
        }
      });
    });
    if (!changed) break;
  }
  const automatic = layoutTree(people.map((person) => ({ ...person, treeX: null, treeY: null })));
  const rows = new Map();
  people.forEach((person) => {
    const level = levels.get(person.id) || 0;
    if (!rows.has(level)) rows.set(level, []);
    rows.get(level).push(person);
  });
  const positions = [];
  const positionById = new Map();
  [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([level, members]) => {
      const memberIds = new Set(members.map((person) => person.id));
      const seen = new Set();
      const units = [];
      members.forEach((person) => {
        if (seen.has(person.id)) return;
        const unit = [];
        const queue = [person.id];
        seen.add(person.id);
        while (queue.length) {
          const id = queue.shift();
          unit.push(byId.get(id));
          (byId.get(id)?.partnerIds || []).forEach((partnerId) => {
            if (memberIds.has(partnerId) && !seen.has(partnerId)) {
              seen.add(partnerId);
              queue.push(partnerId);
            }
          });
        }
        unit.sort((a, b) => (automatic.positions.get(a.id)?.automaticX || 0) - (automatic.positions.get(b.id)?.automaticX || 0));
        const parentXs = unit.flatMap((member) => (member.parentIds || []).map((parentId) => positionById.get(parentId)?.treeX).filter(Number.isFinite));
        units.push({
          members: unit,
          parentKey: [...new Set(unit.flatMap((member) => member.parentIds || []).filter((parentId) => positionById.has(parentId)))].sort().join('|'),
          anchor: parentXs.length ? parentXs.reduce((sum, x) => sum + x, 0) / parentXs.length : null,
          automaticX: unit.reduce((sum, member) => sum + (automatic.positions.get(member.id)?.automaticX || 0), 0) / unit.length,
          width: unit.length * nodeWidth + Math.max(0, unit.length - 1) * coupleGap,
        });
      });
      units.sort((a, b) => {
        if (Number.isFinite(a.anchor) && Number.isFinite(b.anchor)) return a.anchor - b.anchor || a.automaticX - b.automaticX;
        if (Number.isFinite(a.anchor)) return -1;
        if (Number.isFinite(b.anchor)) return 1;
        return a.automaticX - b.automaticX;
      });
      const blockMap = new Map();
      units.forEach((unit, index) => {
        const key = unit.parentKey || `root-${index}`;
        if (!blockMap.has(key)) blockMap.set(key, { units: [], anchor: unit.anchor, automaticX: unit.automaticX });
        blockMap.get(key).units.push(unit);
      });
      const blocks = [...blockMap.values()].map((block) => ({
        ...block,
        width: block.units.reduce((sum, unit) => sum + unit.width, 0) + Math.max(0, block.units.length - 1) * familyGap,
      }));
      blocks.sort((a, b) => {
        if (Number.isFinite(a.anchor) && Number.isFinite(b.anchor)) return a.anchor - b.anchor || a.automaticX - b.automaticX;
        if (Number.isFinite(a.anchor)) return -1;
        if (Number.isFinite(b.anchor)) return 1;
        return a.automaticX - b.automaticX;
      });
      if (blocks.every((block) => !Number.isFinite(block.anchor))) {
        const rowWidth = blocks.reduce((sum, block) => sum + block.width, 0) + Math.max(0, blocks.length - 1) * familyGap;
        let cursor = -rowWidth / 2;
        blocks.forEach((block) => {
          block.x = cursor;
          cursor += block.width + familyGap;
        });
      } else {
        let rightEdge = -Infinity;
        blocks.forEach((block) => {
          const desiredX = Number.isFinite(block.anchor) ? block.anchor - block.width / 2 : rightEdge + familyGap;
          block.x = Math.max(desiredX, rightEdge + familyGap);
          rightEdge = block.x + block.width;
        });
        const anchoredBlocks = blocks.filter((block) => Number.isFinite(block.anchor));
        const correction = anchoredBlocks.reduce((sum, block) => sum + block.anchor - (block.x + block.width / 2), 0) / anchoredBlocks.length;
        blocks.forEach((block) => {
          block.x += correction;
        });
      }
      blocks.forEach((block) => {
        let unitX = block.x;
        block.units.forEach((unit) => {
          unit.members.forEach((person, index) => {
            const position = { id: person.id, treeX: unitX + index * (nodeWidth + coupleGap), treeY: level * generationGap };
            positions.push(position);
            positionById.set(person.id, position);
          });
          unitX += unit.width + familyGap;
        });
      });
    });
  return positions;
}
export function compactDashboardPositions(people) {
  const nodeWidth = 196;
  const groupGap = 132;
  const groups = getFamilyGroups(people);
  const positionedGroups = groups.map((group) =>
    compactGenerationPositions(group.people, {
      nodeWidth,
      coupleGap: 18,
      familyGap: 28,
      generationGap: 126,
    }),
  );
  let cursor = 0;
  const positions = positionedGroups.flatMap((groupPositions) => {
    const minX = Math.min(...groupPositions.map((position) => position.treeX));
    const maxX = Math.max(...groupPositions.map((position) => position.treeX + nodeWidth));
    const offsetX = cursor - minX;
    cursor += maxX - minX + groupGap;
    return groupPositions.map((position) => ({ ...position, treeX: position.treeX + offsetX }));
  });
  const totalWidth = Math.max(0, cursor - groupGap);
  return positions.map((position) => ({ ...position, treeX: position.treeX - totalWidth / 2 }));
}
export function getFamilyGroups(people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const links = new Map(people.map((person) => [person.id, new Set()]));
  people.forEach((person) =>
    [...(person.parentIds || []), ...(person.partnerIds || []), ...(person.siblingIds || []), ...(person.relationshipLinks || []).map((link) => link.personId)].forEach((id) => {
      if (byId.has(id)) {
        links.get(person.id).add(id);
        links.get(id).add(person.id);
      }
    }),
  );
  const seen = new Set();
  const groups = [];
  people.forEach((person) => {
    if (seen.has(person.id)) return;
    const ids = [];
    const queue = [person.id];
    seen.add(person.id);
    while (queue.length) {
      const id = queue.shift();
      ids.push(id);
      (links.get(id) || []).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    const members = ids.map((id) => byId.get(id));
    const surnames = new Map();
    members.forEach((member) => {
      const name = member.lastName?.trim();
      if (name) surnames.set(name, (surnames.get(name) || 0) + 1);
    });
    const surname = [...surnames].sort((a, b) => b[1] - a[1])[0]?.[0] || members[0]?.firstName || 'Family';
    // A group's id must not depend on API ordering. MongoDB rows are sorted by
    // birth date, so adding or editing a member could otherwise change the first
    // member and make saved views appear to have been deleted.
    const stableId = ids.map(String).sort((a, b) => a.localeCompare(b))[0];
    groups.push({ id: stableId, name: `${surname} family`, people: members });
  });
  return groups.sort((a, b) => a.name.localeCompare(b.name));
}
export function fromApi(p) {
  return {
    ...p,
    id: String(p._id),
    parentIds: (p.parentIds || []).map((x) => String(x._id || x)),
    partnerIds: (p.partnerIds || []).map((x) => String(x._id || x)),
    siblingIds: (p.siblingIds || []).map((x) => String(x._id || x)),
    relationshipLinks: (p.relationshipLinks || []).map((link) => ({
      personId: String(link.personId?._id || link.personId),
      label: link.label || '',
    })),
    partnerRelationships: (p.partnerRelationships || []).map((link) => ({
      partnerId: String(link.partnerId?._id || link.partnerId),
      label: link.label || '',
    })),
    treeX: p.treeX,
    treeY: p.treeY,
    color: ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][(p.firstName?.charCodeAt(0) || 0) % 8],
  };
}
export const mongoPeopleCacheKey = (userId) => `kinfolk-mongo-people-v2:${String(userId || 'anonymous')}`;
export function readMongoPeopleCache(userId) {
  try {
    const cached = JSON.parse(storageGet(mongoPeopleCacheKey(userId)));
    if (!Array.isArray(cached?.people)) return { people: [], hasSnapshot: false };
    return {
      people: cached.people.map((person) => fromApi({ ...person, _id: person._id || person.id })),
      hasSnapshot: true,
    };
  } catch {
    return { people: [], hasSnapshot: false };
  }
}

