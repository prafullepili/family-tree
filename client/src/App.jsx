import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { curveBumpX, curveBumpY, curveLinear, line as d3Line } from 'd3-shape';
import {
  Plus,
  Search,
  GitFork,
  UsersRound,
  Sun,
  Moon,
  X,
  MapPin,
  CalendarDays,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Lock,
  Unlock,
  Heart,
  Camera,
  RefreshCw,
  Info,
  Palette,
  Network,
  Bookmark,
  Save,
  FolderOpen,
  Settings,
  Check,
  Download,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';
import { initialPeople } from './demoFamily.js';
import { layoutTree, resolveNodeOverlaps } from './layoutTree.js';
import { relationshipPlacement } from './relationshipPlacement.js';

const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Unnamed person';
const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE_URL}${path}`;
const DATA_COLUMNS = [
  'First Name',
  'Last Name',
  'Maiden Name',
  'Gender',
  'Born',
  'Died',
  'Birthplace',
  'Occupation',
  'About',
  'Family Notes',
  'Photo URL',
  'Parents',
  'Partners',
  'Siblings',
  'Other Relationships',
  'Tree X',
  'Tree Y',
];
const exportDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
function personDataRow(person, peopleById) {
  const personName = (id) => fullName(peopleById.get(String(id)));
  const namedPeople = (ids) => (ids || []).map(personName).join('; ');
  const partners = (person.partnerIds || [])
    .map((id) => {
      const label = (person.partnerRelationships || []).find((link) => String(link.partnerId) === String(id))?.label;
      return `${personName(id)}${label ? ` (${label})` : ''}`;
    })
    .join('; ');
  const otherRelationships = (person.relationshipLinks || []).map((link) => `${personName(link.personId)}${link.label ? ` (${link.label})` : ''}`).join('; ');
  return {
    'First Name': person.firstName || '',
    'Last Name': person.lastName || '',
    'Maiden Name': person.maidenName || '',
    Gender: person.gender || 'unspecified',
    Born: exportDate(person.birthDate),
    Died: exportDate(person.deathDate),
    Birthplace: person.birthPlace || '',
    Occupation: person.occupation || '',
    About: person.bio || '',
    'Family Notes': person.notes || '',
    'Photo URL': person.photoUrl || '',
    Parents: namedPeople(person.parentIds),
    Partners: partners,
    Siblings: namedPeople(person.siblingIds),
    'Other Relationships': otherRelationships,
    'Tree X': Number.isFinite(person.treeX) ? person.treeX : '',
    'Tree Y': Number.isFinite(person.treeY) ? person.treeY : '',
  };
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function parseCsv(text) {
  const rows = [];
  let row = [],
    value = '',
    quoted = false;
  for (let index = 0; index <= text.length; index += 1) {
    const character = text[index] ?? '\n';
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  const [headers = [], ...data] = rows;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] ?? ''])));
}
function parseJsonCell(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return String(value)
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
function normalizeImportedRows(rows) {
  return rows
    .map((row, index) => ({
      sourceId: String(row['ID'] || row.id || `import-${index + 1}`).trim(),
      firstName: String(row['First Name'] || row.firstName || '').trim(),
      lastName: String(row['Last Name'] || row.lastName || '').trim(),
      maidenName: String(row['Maiden Name'] || row.maidenName || '').trim(),
      gender: ['female', 'male', 'nonbinary', 'unspecified'].includes(String(row['Gender'] || row.gender || '').toLowerCase()) ? String(row['Gender'] || row.gender).toLowerCase() : 'unspecified',
      birthDate: String(row['Born'] || row.birthDate || '').trim() || null,
      deathDate: String(row['Died'] || row.deathDate || '').trim() || null,
      birthPlace: String(row['Birthplace'] || row.birthPlace || '').trim(),
      occupation: String(row['Occupation'] || row.occupation || '').trim(),
      bio: String(row['About'] || row.bio || '').trim(),
      notes: String(row['Family Notes'] || row.notes || '').trim(),
      photoUrl: String(row['Photo URL'] || row.photoUrl || '').trim(),
      parentIds: parseJsonCell(row['Parent IDs'] ?? row.parentIds).map(String),
      partnerIds: parseJsonCell(row['Partner IDs'] ?? row.partnerIds).map(String),
      siblingIds: parseJsonCell(row['Sibling IDs'] ?? row.siblingIds).map(String),
      partnerRelationships: parseJsonCell(row['Partner Relationships'] ?? row.partnerRelationships),
      relationshipLinks: parseJsonCell(row['Other Relationships'] ?? row.relationshipLinks),
      treeX: row['Tree X'] === '' || row.treeX === '' ? null : Number(row['Tree X'] ?? row.treeX),
      treeY: row['Tree Y'] === '' || row.treeY === '' ? null : Number(row['Tree Y'] ?? row.treeY),
    }))
    .filter((person) => person.firstName);
}
function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage can be unavailable or full. */
  }
}
function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Storage can be unavailable. */
  }
}
const initials = (p) => `${p?.firstName?.[0] || ''}${p?.lastName?.[0] || ''}`.toUpperCase() || '?';
const straightRelationshipLine = d3Line().curve(curveLinear);
const horizontalRelationshipLine = d3Line().curve(curveBumpX);
const verticalRelationshipLine = d3Line().curve(curveBumpY);
function relationshipPath(edge) {
  const points = [
    [edge.x1, edge.y1],
    [edge.x2, edge.y2],
  ];
  const horizontalRelationship = ['left', 'right'].includes(edge.fromSide) || ['left', 'right'].includes(edge.toSide);
  return (horizontalRelationship ? horizontalRelationshipLine : verticalRelationshipLine)(points);
}
const year = (date) => (date ? new Date(date).getUTCFullYear() : '—');
function formatLongDate(value) {
  if (!value) return 'Not added';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not added' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
function relationshipLabel(role, relative, person) {
  if (role === 'Parent') return relative?.gender === 'male' ? 'Father' : relative?.gender === 'female' ? 'Mother' : 'Parent';
  if (role === 'Child') return relative?.gender === 'male' ? 'Son' : relative?.gender === 'female' ? 'Daughter' : 'Child';
  if (role === 'Partner') {
    if (person?.gender === 'male' && relative?.gender === 'female') return 'Wife';
    if (person?.gender === 'female' && relative?.gender === 'male') return 'Husband';
  }
  return role;
}
function partnerRelationship(person, partnerId) {
  return (person?.partnerRelationships || []).find((link) => String(link.partnerId) === String(partnerId))?.label || '';
}
function partnerDisplayLabel(person, relative) {
  const stored = partnerRelationship(person, relative?.id);
  return ['', 'Husband', 'Wife', 'Spouse'].includes(stored) ? relationshipLabel('Partner', relative, person) || stored || 'Partner' : stored;
}
function descendantIds(people, personId) {
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
function familyColorMap(people, focalId) {
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
function linkLabelPoint(edge, label, positions, placedLabels, straight = false) {
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
function applyDragPositions(people, drag) {
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
function compactDashboardPositions(people) {
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
function getFamilyGroups(people) {
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
function fromApi(p) {
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
const mongoPeopleCacheKey = 'kinfolk-mongo-people-v1';
function readMongoPeopleCache() {
  try {
    const cached = JSON.parse(storageGet(mongoPeopleCacheKey));
    if (!Array.isArray(cached?.people)) return { people: [], hasSnapshot: false };
    return {
      people: cached.people.map((person) => fromApi({ ...person, _id: person._id || person.id })),
      hasSnapshot: true,
    };
  } catch {
    return { people: [], hasSnapshot: false };
  }
}
function PersonAvatar({ person, size = 'small' }) {
  return <div className={`person-avatar ${size} ${person?.color || 'sage'}`}>{person?.photoUrl ? <img src={person.photoUrl} alt="" /> : <span>{initials(person)}</span>}</div>;
}
function FamilyBranchLinks({ branches, people, orthogonal = false, curved = false, endpointDots = false, highlightedLink, highlightedNodeId, highlightedAncestorIds, onHighlight }) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const highlightAtPointer = (event, link) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      onHighlight(link);
      return;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const localPoint = point.matrixTransform(matrix.inverse());
    onHighlight({ ...link, point: { x: localPoint.x, y: localPoint.y } });
  };
  return (
    <g className="family-branch-links">
      {branches.map((branch, index) => {
        const bus = straightRelationshipLine([
          [branch.sourceX, branch.sourceY],
          [branch.sourceX, branch.branchY],
        ]);
        const busMinX = Math.min(branch.sourceX, ...branch.childXs);
        const busMaxX = Math.max(branch.sourceX, ...branch.childXs);
        const busRail = straightRelationshipLine([
          [busMinX, branch.branchY],
          [busMaxX, branch.branchY],
        ]);
        const branchKey = `family-${index}`;
        const branchHighlighted = highlightedLink?.key?.startsWith(`${branchKey}-`);
        const branchNodeRelated = branch.children.some(
          (childId) =>
            branch.parentIds.includes(highlightedNodeId) ||
            childId === highlightedNodeId ||
            (highlightedAncestorIds.has(childId) && branch.parentIds.some((parentId) => highlightedAncestorIds.has(parentId))),
        );
        const curvedGuides = ['above', 'below']
          .map((side) => {
            const indices = branch.childTops
              .map((childTop, childIndex) => ({ childIndex, below: childTop >= branch.sourceY }))
              .filter(({ below }) => below === (side === 'below'))
              .map(({ childIndex }) => childIndex);
            if (!indices.length) return null;
            const direction = side === 'below' ? 1 : -1;
            // A two-parent family branches from the connector joining the parents.
            // A single-parent family starts at that parent's nearest card edge.
            const sourceY = branch.parentIds.length > 1 ? branch.sourceY : side === 'below' ? branch.sourceBottomY : branch.sourceTopY;
            const railY = sourceY + direction * 22;
            const railWidth = Math.min(96, Math.max(26, (indices.length - 1) * 20));
            const railStartX = branch.sourceX - railWidth / 2;
            const sourceXs = new Map(indices.map((childIndex, rank) => [childIndex, indices.length === 1 ? branch.sourceX : railStartX + (railWidth * rank) / (indices.length - 1)]));
            return { side, indices, sourceY, railY, railStartX, railWidth, sourceXs };
          })
          .filter(Boolean);
        return (
          <g key={`family-branch-${index}`}>
            {!curved && (
              <>
                <path
                  className={`connector family-route family-trunk ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`}
                  d={bus}
                  markerStart={endpointDots ? `url(#${branchHighlighted || branchNodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})` : undefined}
                />
                <path className={`connector family-route family-rail ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`} d={busRail} />
              </>
            )}
            {curvedGuides.map((guide) => (
              <g key={guide.side}>
                <path
                  className={`connector family-route family-trunk ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`}
                  d={straightRelationshipLine([
                    [branch.sourceX, guide.sourceY],
                    [branch.sourceX, guide.railY],
                  ])}
                />
                {guide.indices.length > 1 && (
                  <path
                    className={`connector family-route family-rail ${branchHighlighted ? 'is-highlighted' : ''} ${branchNodeRelated ? 'is-node-related' : ''}`}
                    d={straightRelationshipLine([
                      [guide.railStartX, guide.railY],
                      [guide.railStartX + guide.railWidth, guide.railY],
                    ])}
                  />
                )}
                <circle className="family-junction" cx={branch.sourceX} cy={guide.railY} r="3.2" />
              </g>
            ))}
            {branch.childXs.map((x, i) => {
              const child = byId.get(branch.children[i]);
              const label = child?.gender === 'male' ? 'Son' : child?.gender === 'female' ? 'Daughter' : 'Child';
              const childTop = branch.childTops[i];
              const childBottom = branch.childBottoms[i];
              const childIsBelow = childTop >= branch.sourceY;
              const guide = curvedGuides.find((item) => item.indices.includes(i));
              const routeSourceX = curved ? guide.sourceXs.get(i) : x;
              const routeSourceY = curved ? guide.railY : branch.branchY;
              const routeTargetY = childIsBelow ? childTop : childBottom;
              const d3Route = curved
                ? verticalRelationshipLine([
                    [routeSourceX, routeSourceY],
                    [x, routeTargetY],
                  ])
                : null;
              const curve = d3Route
                ? d3Route
                : orthogonal
                  ? straightRelationshipLine([
                      [x, branch.branchY],
                      [x, childTop],
                    ])
                  : verticalRelationshipLine([
                      [x, branch.branchY],
                      [x, childTop],
                    ]);
              const labelX = d3Route ? (x + routeSourceX) / 2 : x;
              const labelY = (d3Route ? (routeSourceY + routeTargetY) / 2 : (childTop + branch.branchY) / 2) + (childIsBelow ? -7 : 7);
              const linkKey = `${branchKey}-${branch.children[i]}`;
              const linkHighlighted = highlightedLink?.key === linkKey;
              const nodeRelated =
                branch.parentIds.includes(highlightedNodeId) ||
                branch.children[i] === highlightedNodeId ||
                (highlightedAncestorIds.has(branch.children[i]) && branch.parentIds.some((parentId) => highlightedAncestorIds.has(parentId)));
              const markerId = linkHighlighted || nodeRelated ? 'family-link-highlight-arrow' : 'family-link-arrow';
              const linkedIds = [...branch.parentIds, branch.children[i]];
              const parentNames = branch.parentIds.map((id) => fullName(byId.get(id))).join(' and ');
              const childName = fullName(child);
              const childNameWidth = Math.max(54, Math.min(150, childName.length * 6.4 + 18));
              const hoverPoint = linkHighlighted && highlightedLink?.point ? highlightedLink.point : { x: labelX, y: labelY - 22 };
              return (
                <g key={branch.children[i]} className={`relationship-link ${linkHighlighted ? 'is-highlighted' : ''} ${nodeRelated ? 'is-node-related' : ''}`}>
                  <path
                    className="connector-hit"
                    d={curve}
                    tabIndex="0"
                    aria-label={`${parentNames} to ${fullName(child)} · ${label}`}
                    onPointerEnter={(event) => highlightAtPointer(event, { key: linkKey, ids: linkedIds })}
                    onPointerMove={(event) => highlightAtPointer(event, { key: linkKey, ids: linkedIds })}
                    onPointerLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight({ key: linkKey, ids: linkedIds })}
                    onBlur={() => onHighlight(null)}
                  />
                  <path
                    className="connector family-route family-drop"
                    d={curve}
                    markerStart={endpointDots ? `url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})` : undefined}
                    markerEnd={endpointDots ? `url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})` : !orthogonal ? `url(#${markerId})` : undefined}
                  />
                  <text className="connector-relation family-role" x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central">
                    <title>{label}</title>
                    {label}
                  </text>
                  <g className="connector-child-name" transform={`translate(${hoverPoint.x} ${hoverPoint.y - 16})`} aria-hidden="true">
                    <rect x={-childNameWidth / 2} y="-10" width={childNameWidth} height="20" rx="6" />
                    <text textAnchor="middle" dominantBaseline="central">
                      {childName}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

export default function App() {
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.innerWidth <= 1050);
  const [initialCache] = useState(readMongoPeopleCache);
  const [people, setPeople] = useState(() => initialCache.people);
  const [hasMongoSnapshot, setHasMongoSnapshot] = useState(initialCache.hasSnapshot);
  const memberList = useRef(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [familyPickerOpen, setFamilyPickerOpen] = useState(false);
  const [familyQuery, setFamilyQuery] = useState('');
  const [visibleLinkTypes, setVisibleLinkTypes] = useState(() => {
    try {
      return {
        parent: true,
        partner: true,
        sibling: true,
        custom: true,
        ...JSON.parse(storageGet('kinfolk-visible-link-types-v1') || '{}'),
      };
    } catch {
      return { parent: true, partner: true, sibling: true, custom: true };
    }
  });
  const [deceasedRibbon, setDeceasedRibbon] = useState(() => {
    const saved = storageGet('kinfolk-deceased-ribbon-v1');
    return ['black', 'red'].includes(saved) ? saved : 'off';
  });
  const [treeVisualStyle, setTreeVisualStyle] = useState(() => {
    const savedStyle = storageGet('kinfolk-tree-visual-style-v2');
    return ['dashboard', 'classic', 'atlas'].includes(savedStyle) ? savedStyle : 'dashboard';
  });
  const [familyColorsEnabled, setFamilyColorsEnabled] = useState(() => storageGet('kinfolk-family-colors-v1') === 'true');
  const [selectedId, setSelectedId] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [aboutTooltipId, setAboutTooltipId] = useState('');
  const [quickAddForId, setQuickAddForId] = useState('');
  const [highlightedLink, setHighlightedLink] = useState(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState('');
  const [dismissedAboutTooltipId, setDismissedAboutTooltipId] = useState('');
  const [movementLocked, setMovementLocked] = useState(() => storageGet('kinfolk-canvas-movement-locked-v2') === 'true');
  const [marqueeRect, setMarqueeRect] = useState(null);
  const [phoneLayoutPreview, setPhoneLayoutPreview] = useState({});
  const [theme, setTheme] = useState(() => storageGet('kinfolk-theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasHelpRef = useRef(null);
  const [treeStyleMenuOpen, setTreeStyleMenuOpen] = useState(false);
  const treeStyleControlRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportFieldsOpen, setExportFieldsOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState(() => {
    try {
      const saved = JSON.parse(storageGet('kinfolk-export-columns-v2') || 'null');
      const valid = Array.isArray(saved) ? saved.filter((column) => DATA_COLUMNS.includes(column)) : [];
      return valid.length ? valid : DATA_COLUMNS;
    } catch {
      return DATA_COLUMNS;
    }
  });
  const settingsControlRef = useRef(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [detailsWidth, setDetailsWidth] = useState(() => {
    const saved = Number(storageGet('kinfolk-details-width'));
    return Number.isFinite(saved) && saved >= 286 && saved <= 620 ? saved : 390;
  });
  const detailsResize = useRef(null);
  const [zoom, setZoom] = useState(() => {
    const saved = Number(storageGet(window.innerWidth <= 1050 ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1'));
    return Number.isFinite(saved) && saved >= 0.1 && saved <= 2 ? saved : 1;
  });
  const [treeViewportWidth, setTreeViewportWidth] = useState(0);
  const [treeViewportHeight, setTreeViewportHeight] = useState(0);
  const autoFitSignature = useRef('');
  const manualZoomTouched = useRef(false);
  const viewportMode = useRef(isCompactViewport);
  const [query, setQuery] = useState('');
  const [memberFamilyFilter, setMemberFamilyFilter] = useState('__all__');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [apiState, setApiState] = useState('checking');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [confirmArrange, setConfirmArrange] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [savedLayoutsOpen, setSavedLayoutsOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [applyingLayoutId, setApplyingLayoutId] = useState('');
  const [confirmLayoutDeleteId, setConfirmLayoutDeleteId] = useState('');
  const [deletingLayoutId, setDeletingLayoutId] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteDescendants, setDeleteDescendants] = useState(() => storageGet('kinfolk-delete-descendants') === 'true');
  const drag = useRef(null);
  const pendingPositionSaves = useRef(new Map());
  const positionSaveTimer = useRef(0);
  const positionSaveMessage = useRef({ success: 'Position saved', failure: 'Moved for this session; the position could not be saved' });
  const spacePan = useRef(false);
  const pinch = useRef(null);
  const zoomFrame = useRef(0);
  const pendingZoom = useRef(null);
  const zoomValue = useRef(1);
  const pendingZoomAnchor = useRef(null);
  const treeScroll = useRef(null);
  const previousOrigin = useRef(null);
  const refreshDataRef = useRef(null);
  const importFileRef = useRef(null);
  const families = useMemo(() => getFamilyGroups(people), [people]);
  const selectedFamily = selectedFamilyId === '__all__' ? null : families.find((group) => group.id === selectedFamilyId) || [...families].sort((a, b) => b.people.length - a.people.length)[0];
  const familyPeople = selectedFamilyId === '__all__' ? people : selectedFamily?.people || people;
  const familyPeopleIdentity = familyPeople
    .map((person) => String(person._id || person.id))
    .sort()
    .join('|');
  const layoutScopeId = selectedFamilyId === '__all__' ? '__all__' : selectedFamily?.id || familyPeople[0]?.id || '__all__';
  const treePeople = useMemo(
    () => (memberFamilyFilter === '__all__' ? familyPeople : familyPeople.filter((person) => (person.lastName?.trim().toLocaleLowerCase() || '__other__') === memberFamilyFilter)),
    [familyPeople, memberFamilyFilter],
  );
  const activeLinkNodeId = treePeople.some((person) => person.id === (highlightedNodeId || selectedId)) ? highlightedNodeId || selectedId : '';
  const highlightedAncestorIds = useMemo(() => {
    const byId = new Map(treePeople.map((person) => [person.id, person]));
    const ids = new Set();
    const visit = (id) => {
      if (!id || ids.has(id) || !byId.has(id)) return;
      ids.add(id);
      (byId.get(id).parentIds || []).forEach(visit);
    };
    visit(activeLinkNodeId);
    return ids;
  }, [activeLinkNodeId, treePeople]);
  const highlightedNetworkIds = useMemo(() => {
    const ids = new Set(highlightedAncestorIds);
    if (!activeLinkNodeId) return ids;
    treePeople.forEach((person) => {
      const references = [...(person.parentIds || []), ...(person.partnerIds || []), ...(person.siblingIds || []), ...(person.relationshipLinks || []).map((link) => link.personId)];
      if (person.id === activeLinkNodeId) references.forEach((id) => ids.add(id));
      if (references.includes(activeLinkNodeId)) ids.add(person.id);
    });
    ids.add(activeLinkNodeId);
    return ids;
  }, [activeLinkNodeId, treePeople, highlightedAncestorIds]);
  const familyColorFocusId = treePeople.some((person) => person.id === selectedId) ? selectedId : null;
  const familyColors = useMemo(() => familyColorMap(treePeople, familyColorFocusId), [treePeople, familyColorFocusId]);
  const selected = people.find((p) => p.id === selectedId) || null;
  const byId = (id) => people.find((p) => p.id === id);
  const familyLinkGroups = useMemo(() => {
    if (!selected) return [];
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const seen = new Set();
    const makeGroup = (key, label, links) => ({
      key,
      label,
      links: links.filter((link) => {
        if (!peopleById.has(link.id) || seen.has(link.id)) return false;
        seen.add(link.id);
        return true;
      }),
    });
    const siblings = people
      .filter((person) => person.id !== selected.id && ((person.siblingIds || []).includes(selected.id) || (person.parentIds || []).some((parentId) => (selected.parentIds || []).includes(parentId))))
      .map((person) => ({ id: person.id, role: 'Sibling' }));
    return [
      makeGroup(
        'parents',
        'Parents',
        (selected.parentIds || []).map((id) => ({ id, role: 'Parent' })),
      ),
      makeGroup(
        'partners',
        'Partners',
        (selected.partnerIds || []).map((id) => ({ id, role: 'Partner', label: partnerDisplayLabel(selected, peopleById.get(id)) })),
      ),
      makeGroup(
        'children',
        'Children',
        people.filter((person) => (person.parentIds || []).includes(selected.id)).map((person) => ({ id: person.id, role: 'Child' })),
      ),
      makeGroup('siblings', 'Siblings', siblings),
      makeGroup(
        'other',
        'Other relationships',
        (selected.relationshipLinks || []).map((link) => ({ id: link.personId, role: link.label || 'Related' })),
      ),
    ].filter((group) => group.links.length);
  }, [people, selected]);
  const layoutPeople = useMemo(() => {
    if (!isCompactViewport || !Object.keys(phoneLayoutPreview).length) return treePeople;
    return treePeople.map((person) => {
      const preview = phoneLayoutPreview[person.id];
      return preview ? { ...person, treeX: preview.treeX, treeY: preview.treeY } : person;
    });
  }, [treePeople, isCompactViewport, phoneLayoutPreview]);
  const cardWidth = 196;
  const cardHeight = 76;
  const layout = useMemo(() => layoutTree(layoutPeople, { nodeWidth: cardWidth, nodeHeight: cardHeight }), [layoutPeople, cardWidth, cardHeight]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const layoutPositions = [...layout.positions.values()];
  const minNodeX = layoutPositions.length ? Math.min(...layoutPositions.map((position) => position.x)) : 0;
  const minNodeY = layoutPositions.length ? Math.min(...layoutPositions.map((position) => position.y)) : 0;
  const maxNodeX = layoutPositions.length ? Math.max(...layoutPositions.map((position) => position.x + position.w)) : layout.width;
  const maxNodeY = layoutPositions.length ? Math.max(...layoutPositions.map((position) => position.y + position.h)) : layout.height;
  const treeBaseWidth = Math.max(800, ...layoutPositions.map((position) => position.automaticX + layout.originX + position.w + 60));
  const treeBaseHeight = Math.max(300, ...layoutPositions.map((position) => position.automaticY + layout.originY + position.h + 100));
  // Manual dragging can put nodes above/left of the automatic layout's origin.
  // Add canvas space for those coordinates so zooming never clips a moved node.
  const treeBoardOffsetX = Math.max(0, 60 - minNodeX);
  const treeBoardOffsetY = Math.max(0, 56 - minNodeY);
  const treePaddingX = treeViewportWidth / 2;
  const treePaddingY = treeViewportHeight / 2;
  const maxCanvasZoom = Math.max(0.1, Math.min(2, (treeViewportWidth - 24) / cardWidth));
  const treeBoardWidth = Math.max(layout.width, maxNodeX) + treeBoardOffsetX;
  const treeBoardHeight = Math.max(layout.height, maxNodeY) + treeBoardOffsetY;
  const treeContentWidth = treeBoardWidth * zoom;
  // Keep the automatic layout's origin fixed as manually moved nodes expand
  // the canvas. Scroll padding cancels the changing origin so dragging keeps
  // tracking the pointer at every edge.
  const treeBoardLeft = treePaddingX + treeBoardOffsetX * zoom + Math.max(0, (treeViewportWidth - treeBaseWidth * zoom) / 2);
  const treeBoardTop = treePaddingY + treeBoardOffsetY * zoom + Math.max(0, (treeViewportHeight - treeBaseHeight * zoom) / 2);
  const treeExtraWidth = Math.max(0, (layout.originX - 60 + treeBoardOffsetX) * zoom, treePaddingX * 2 + treeBoardLeft + treeContentWidth - treeViewportWidth);
  const appliedTreeOffset = useRef({ x: treeBoardOffsetX, y: treeBoardOffsetY });
  const connectorNodePositions = [...layout.positions.values()];
  const connectorLabelPositions = [];
  const memberFamilyOptions = useMemo(() => {
    const groups = new Map();
    familyPeople.forEach((person) => {
      const surname = person.lastName?.trim();
      const key = surname?.toLocaleLowerCase() || '__other__';
      if (!groups.has(key)) groups.set(key, { key, name: surname ? `${surname} family` : 'Other family members', count: 0 });
      groups.get(key).count += 1;
    });
    return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [familyPeople]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return familyPeople.filter((person) => {
      const surnameKey = person.lastName?.trim().toLocaleLowerCase() || '__other__';
      const matchesGroup = memberFamilyFilter === '__all__' || surnameKey === memberFamilyFilter;
      const matchesName = !normalizedQuery || fullName(person).toLocaleLowerCase().includes(normalizedQuery);
      return matchesGroup && matchesName;
    });
  }, [query, familyPeople, memberFamilyFilter]);
  const sidebarMemberGroups = useMemo(() => {
    const groups = new Map();
    filtered.forEach((person) => {
      const surname = person.lastName?.trim();
      const key = surname?.toLocaleLowerCase() || '__other__';
      if (!groups.has(key)) groups.set(key, { name: surname ? `${surname} family` : 'Other family members', people: [] });
      groups.get(key).people.push(person);
    });
    return [...groups.values()]
      .map((group) => ({ ...group, people: [...group.people].sort((a, b) => fullName(a).localeCompare(fullName(b))) }))
      .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
  }, [filtered]);
  useEffect(() => {
    setSelectedNodeIds([]);
    setHighlightedNodeId('');
    setHighlightedLink(null);
    setSelectedId((current) => (current && !treePeople.some((person) => person.id === current) ? '' : current));
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
    manualZoomTouched.current = false;
    autoFitSignature.current = '';
  }, [memberFamilyFilter]);
  const selectedDescendants = selected ? descendantIds(people, selected.id) : [];
  const deleteShortcutState = useRef(null);
  deleteShortcutState.current = { selectedId, selectedNodeIds, confirmDelete, modal, familyPeople: treePeople };
  useEffect(() => {
    document.getElementById('boot-screen')?.remove();
    document.documentElement.dataset.theme = theme;
    storageSet('kinfolk-theme', theme);
  }, [theme]);
  useEffect(() => {
    storageSet('kinfolk-canvas-movement-locked-v2', String(movementLocked));
  }, [movementLocked]);
  useEffect(() => {
    storageSet('kinfolk-tree-visual-style-v2', treeVisualStyle);
  }, [treeVisualStyle]);
  useEffect(() => {
    if (!treeStyleMenuOpen && !settingsOpen) return;
    const closeMenu = (event) => {
      if (!treeStyleControlRef.current?.contains(event.target)) setTreeStyleMenuOpen(false);
      if (!settingsControlRef.current?.contains(event.target)) setSettingsOpen(false);
    };
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, [treeStyleMenuOpen, settingsOpen]);

  useEffect(() => {
    if (!quickAddForId) return;
    const closeQuickAdd = (event) => {
      if (!event.target.closest('.tree-node-quick-add')) setQuickAddForId('');
    };
    window.addEventListener('pointerdown', closeQuickAdd);
    return () => window.removeEventListener('pointerdown', closeQuickAdd);
  }, [quickAddForId]);
  useEffect(() => {
    const updateViewportMode = () => setIsCompactViewport(window.innerWidth <= 1050);
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);
  useEffect(() => {
    if (viewportMode.current === isCompactViewport) return;
    viewportMode.current = isCompactViewport;
    manualZoomTouched.current = false;
    const saved = Number(storageGet(isCompactViewport ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1'));
    const nextZoom = Number.isFinite(saved) && saved >= 0.1 && saved <= 2 ? saved : 1;
    zoomValue.current = nextZoom;
    setZoom(nextZoom);
  }, [isCompactViewport]);
  useEffect(() => {
    storageSet('kinfolk-details-width', String(detailsWidth));
  }, [detailsWidth]);
  useEffect(() => {
    storageRemove('kinfolk-phone-tree-layout-v1');
  }, []);
  useEffect(() => {
    storageSet(isCompactViewport ? 'kinfolk-phone-zoom-v1' : 'kinfolk-site-zoom-v1', String(zoom));
  }, [isCompactViewport, zoom]);
  function beginDetailsResize(event) {
    if (window.innerWidth <= 1050) return;
    event.preventDefault();
    detailsResize.current = { startX: event.clientX, startWidth: detailsWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDetailsResize(event) {
    if (!detailsResize.current) return;
    setDetailsWidth(Math.max(286, Math.min(620, detailsResize.current.startWidth + detailsResize.current.startX - event.clientX)));
  }
  function endDetailsResize() {
    detailsResize.current = null;
  }
  function handleDetailsResizeKey(event) {
    const delta = event.key === 'ArrowLeft' ? 16 : event.key === 'ArrowRight' ? -16 : 0;
    if (delta) {
      event.preventDefault();
      setDetailsWidth((width) => Math.max(286, Math.min(620, width + delta)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setDetailsWidth(event.key === 'Home' ? 286 : 620);
    }
  }
  useEffect(() => {
    storageSet('kinfolk-visible-link-types-v1', JSON.stringify(visibleLinkTypes));
    storageRemove('kinfolk-link-style');
  }, [visibleLinkTypes]);
  useEffect(() => {
    storageSet('kinfolk-deceased-ribbon-v1', deceasedRibbon);
  }, [deceasedRibbon]);
  useEffect(() => {
    storageSet('kinfolk-family-colors-v1', String(familyColorsEnabled));
  }, [familyColorsEnabled]);
  useLayoutEffect(() => {
    zoomValue.current = zoom;
    const anchor = pendingZoomAnchor.current;
    if (!anchor) return;
    const viewport = treeScroll.current;
    pendingZoomAnchor.current = null;
    if (!viewport) return;
    // Measure the transformed board after React applies the new scale. Using
    // the board rect keeps the zoom anchor correct when the surface is centered
    // or scroll bounds change (especially with a single node).
    requestAnimationFrame(() => {
      const board = viewport.querySelector('.tree-board');
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const pointX = boardRect.left + anchor.x * zoom;
      const pointY = boardRect.top + anchor.y * zoom;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + pointX - anchor.clientX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + pointY - anchor.clientY));
    });
  }, [zoom, treeBoardLeft, treeBoardTop]);
  useLayoutEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const nextOffset = treePaddingX + treeBoardOffsetX * zoom;
    const delta = nextOffset - appliedTreeOffset.current.x;
    appliedTreeOffset.current.x = nextOffset;
    if (delta) viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + delta));
  }, [treeBoardOffsetX, treePaddingX, zoom]);
  useLayoutEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const nextOffset = treePaddingY + treeBoardOffsetY * zoom;
    const delta = nextOffset - appliedTreeOffset.current.y;
    appliedTreeOffset.current.y = nextOffset;
    if (delta) viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + delta));
  }, [treeBoardOffsetY, treePaddingY, zoom]);
  useLayoutEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const updateSize = () => {
      setTreeViewportWidth(viewport.clientWidth);
      setTreeViewportHeight(viewport.clientHeight);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const viewport = treeScroll.current;
    if (!viewport) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const baseZoom = pendingZoom.current?.nextZoom ?? zoomValue.current;
      zoomAround(e.clientX, e.clientY, Math.max(0.1, Math.min(maxCanvasZoom, baseZoom * Math.exp(-e.deltaY * 0.01))));
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [zoomAround]);
  useEffect(() => {
    if (!sidebarOpen || !selectedId) return;
    memberList.current?.querySelector('.member-list-item.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, sidebarOpen]);
  useEffect(() => {
    if (!aboutTooltipId) return;
    const closeOnOutsidePointer = (event) => {
      if (!event.target?.closest?.('.tree-node-about-wrap.is-open')) {
        setDismissedAboutTooltipId(aboutTooltipId);
        setAboutTooltipId('');
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setDismissedAboutTooltipId(aboutTooltipId);
        setAboutTooltipId('');
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [aboutTooltipId]);
  useEffect(() => {
    setSelectedNodeIds([]);
  }, [selectedFamilyId]);
  useEffect(() => {
    storageSet('kinfolk-delete-descendants', String(deleteDescendants));
  }, [deleteDescendants]);
  useEffect(() => {
    setPeople((previous) => {
      const removed = new Set(previous.filter((person) => String(person.id).startsWith('stress-')).map((person) => person.id));
      if (!removed.size) return previous;
      return previous
        .filter((person) => !removed.has(person.id))
        .map((person) => ({
          ...person,
          parentIds: (person.parentIds || []).filter((id) => !removed.has(id)),
          partnerIds: (person.partnerIds || []).filter((id) => !removed.has(id)),
        }));
    });
  }, []);
  useLayoutEffect(() => {
    const previous = previousOrigin.current;
    if (treeScroll.current) {
      if (previous?.hasPeople && treePeople.length) {
        treeScroll.current.scrollLeft += (layout.originX - previous.x) * zoom;
        treeScroll.current.scrollTop += (layout.originY - previous.y) * zoom;
      } else {
        treeScroll.current.scrollLeft = 0;
        treeScroll.current.scrollTop = 0;
      }
    }
    previousOrigin.current = { x: layout.originX, y: layout.originY, hasPeople: treePeople.length > 0 };
  }, [layout.originX, layout.originY, zoom, treePeople.length]);
  const layoutSignature = layoutPeople
    .map((person) => `${person.id}:${person.treeX ?? ''}:${person.treeY ?? ''}:${(person.parentIds || []).join(',')}:${(person.partnerIds || []).join(',')}`)
    .join('|');
  useLayoutEffect(() => {
    if (!treePeople.length || apiState === 'checking' || manualZoomTouched.current) return;
    const viewport = treeScroll.current;
    if (!viewport || !treeViewportWidth || !treeViewportHeight) return;
    const signature = `${isCompactViewport ? 'compact' : 'wide'}:${layoutSignature}:${treeViewportWidth}x${treeViewportHeight}`;
    if (autoFitSignature.current === signature) return;
    autoFitSignature.current = signature;
    const contentWidth = Math.max(cardWidth, maxNodeX - minNodeX);
    const contentHeight = Math.max(cardHeight, maxNodeY - minNodeY);
    const minimumReadableZoom = 0.1;
    const fittedZoom = Math.max(minimumReadableZoom, Math.min(1, maxCanvasZoom, (viewport.clientWidth - 48) / contentWidth, (viewport.clientHeight - 48) / contentHeight));
    zoomValue.current = fittedZoom;
    setZoom(fittedZoom);
    requestAnimationFrame(() => {
      const boardRect = viewport.querySelector('.tree-board')?.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (!boardRect || !layoutPositions.length) return;
      const centerX = (minNodeX + maxNodeX) / 2;
      const centerY = (minNodeY + maxNodeY) / 2;
      const targetX = viewportRect.left + viewport.clientWidth / 2;
      const targetY = viewportRect.top + viewport.clientHeight / 2;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + boardRect.left + centerX * fittedZoom - targetX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + boardRect.top + centerY * fittedZoom - targetY));
    });
  }, [
    apiState,
    treePeople.length,
    isCompactViewport,
    layoutSignature,
    maxCanvasZoom,
    maxNodeX,
    maxNodeY,
    minNodeX,
    minNodeY,
    treeViewportHeight,
    treeViewportWidth,
    treeVisualStyle,
    cardWidth,
    cardHeight,
  ]);
  useEffect(() => {
    if (apiState !== 'demo') return;
    const timer = setTimeout(() => storageSet('kinfolk-demo-people', JSON.stringify(people)), 250);
    return () => clearTimeout(timer);
  }, [people, apiState]);
  useEffect(() => {
    let active = true;
    if (!familyPeople.length || !['connected', 'demo'].includes(apiState)) {
      setSavedLayouts([]);
      return undefined;
    }
    if (apiState === 'demo') {
      try {
        const layouts = JSON.parse(storageGet('kinfolk-saved-layouts-v1') || '[]');
        const familyPersonIds = new Set(familyPeople.map((person) => String(person.id)));
        setSavedLayouts(
          Array.isArray(layouts)
            ? layouts.filter((item) => item.familyId === layoutScopeId || (layoutScopeId !== '__all__' && (item.positions || []).some((position) => familyPersonIds.has(String(position.personId)))))
            : [],
        );
      } catch {
        setSavedLayouts([]);
      }
      return undefined;
    }
    const layoutQuery = new URLSearchParams({ familyId: layoutScopeId });
    if (layoutScopeId !== '__all__')
      layoutQuery.set(
        'personIds',
        familyPeople
          .map((person) => person._id)
          .filter(Boolean)
          .join(','),
      );
    fetch(apiUrl(`/api/layouts?${layoutQuery}`), { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((layouts) => {
        if (active) setSavedLayouts(layouts);
      })
      .catch(() => {
        if (active) setSavedLayouts([]);
      });
    return () => {
      active = false;
    };
  }, [apiState, familyPeopleIdentity, layoutScopeId]);
  useEffect(() => {
    if (apiState !== 'connected' || !hasMongoSnapshot) return;
    try {
      storageSet(mongoPeopleCacheKey, JSON.stringify({ people, updatedAt: Date.now() }));
    } catch {
      // The live MongoDB data remains available even if browser storage is full or disabled.
    }
  }, [people, apiState, hasMongoSnapshot]);
  useEffect(() => {
    let active = true;
    (async () => {
      setIsRefreshing(true);
      try {
        let ready = false;
        for (let i = 0; i < 8; i++) {
          const h = await fetch(apiUrl('/api/health'));
          if (!h.ok) throw Error();
          const state = await h.json();
          if (!state.configured) {
            if (active) {
              setPeople(initialPeople());
              setHasMongoSnapshot(false);
              setApiState('demo');
            }
            return;
          }
          if (state.database === 'connected') {
            ready = true;
            break;
          }
          if (i < 7) await new Promise((r) => setTimeout(r, 1000));
        }
        if (!ready) throw Error();
        const response = await fetch(apiUrl('/api/people'));
        if (!response.ok) throw Error();
        const savedRows = await response.json();
        const rows = savedRows.map(fromApi);
        if (active) {
          storageRemove('kinfolk-demo-people');
          setHasMongoSnapshot(true);
          setPeople(rows);
          setSelectedId((selectedId) => (rows.some((person) => person.id === selectedId) ? selectedId : ''));
          setApiState('connected');
          setRefreshFailed(false);
        }
      } catch {
        if (active) {
          setRefreshFailed(true);
          setApiState(initialCache.hasSnapshot ? 'connected' : 'error');
        }
      } finally {
        if (active) setIsRefreshing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function refreshFromDatabase() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshFailed(false);
    try {
      let ready = false;
      for (let i = 0; i < 8; i++) {
        const healthResponse = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
        if (!healthResponse.ok) throw Error();
        const health = await healthResponse.json();
        if (!health.configured) {
          setRefreshFailed(hasMongoSnapshot);
          if (!hasMongoSnapshot) setApiState('error');
          notify('MongoDB is not configured for this app');
          return;
        }
        if (health.database === 'connected') {
          ready = true;
          break;
        }
        if (i < 7) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!ready) throw Error();
      const response = await fetch(apiUrl('/api/people'), { cache: 'no-store' });
      if (!response.ok) throw Error();
      const rows = (await response.json()).map(fromApi);
      storageRemove('kinfolk-demo-people');
      storageSet(mongoPeopleCacheKey, JSON.stringify({ people: rows, updatedAt: Date.now() }));
      setPeople(rows);
      setHasMongoSnapshot(true);
      setSelectedId((selectedId) => (rows.some((person) => person.id === selectedId) ? selectedId : ''));
      setApiState('connected');
      setRefreshFailed(false);
      notify(`Synced ${rows.length} ${rows.length === 1 ? 'person' : 'people'} from MongoDB`);
    } catch {
      setRefreshFailed(true);
      if (!hasMongoSnapshot) setApiState('error');
      notify(hasMongoSnapshot ? 'Could not refresh from MongoDB. Showing the last saved data.' : 'Could not load family data from MongoDB.');
    } finally {
      setIsRefreshing(false);
    }
  }
  refreshDataRef.current = refreshFromDatabase;
  function updateExportColumns(nextColumns) {
    const ordered = DATA_COLUMNS.filter((column) => nextColumns.includes(column));
    setExportColumns(ordered);
    storageSet('kinfolk-export-columns-v2', JSON.stringify(ordered));
  }
  function exportCsv() {
    if (!exportColumns.length) {
      notify('Select at least one field to export');
      return;
    }
    const peopleById = new Map(people.map((person) => [String(person.id || person._id), person]));
    const rows = people.map((person) => personDataRow(person, peopleById));
    const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [exportColumns.map(escapeCell).join(','), ...rows.map((row) => exportColumns.map((column) => escapeCell(row[column])).join(','))].join('\r\n');
    downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `family-tree-${new Date().toISOString().slice(0, 10)}.csv`);
    setSettingsOpen(false);
    notify(`Exported ${people.length} people as CSV`);
  }
  async function exportExcel() {
    if (!exportColumns.length) {
      notify('Select at least one field to export');
      return;
    }
    try {
      const excelModule = await import('exceljs');
      const ExcelJS = excelModule.default || excelModule;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Kinfolk';
      const sheet = workbook.addWorksheet('Family Tree', { views: [{ state: 'frozen', ySplit: 1 }] });
      sheet.columns = exportColumns.map((header) => ({ header, key: header, width: Math.min(42, Math.max(13, header.length + 3)) }));
      const peopleById = new Map(people.map((person) => [String(person.id || person._id), person]));
      people.map((person) => personDataRow(person, peopleById)).forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F6B4F' } };
      const lastColumn = sheet.getColumn(exportColumns.length).letter;
      sheet.autoFilter = { from: 'A1', to: `${lastColumn}${Math.max(1, people.length + 1)}` };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `family-tree-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setSettingsOpen(false);
      notify(`Exported ${people.length} people as Excel`);
    } catch {
      notify('Could not create the Excel file');
    }
  }
  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      let rows;
      if (file.name.toLowerCase().endsWith('.csv')) rows = parseCsv(await file.text());
      else {
        const excelModule = await import('exceljs');
        const ExcelJS = excelModule.default || excelModule;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw Error('The workbook has no worksheet');
        const headers = sheet
          .getRow(1)
          .values.slice(1)
          .map((value) => String(value || '').trim());
        rows = [];
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const values = row.values.slice(1);
          if (values.some((value) => value !== null && value !== undefined && value !== '')) rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
        });
      }
      const importedPeople = normalizeImportedRows(rows);
      if (!importedPeople.length) throw Error('No people with a first name were found');
      setPendingImport({ filename: file.name, people: importedPeople });
      setSettingsOpen(false);
    } catch (error) {
      notify(error.message || 'Could not read this import file');
    }
  }
  async function confirmDataImport() {
    if (!pendingImport || isImporting) return;
    setIsImporting(true);
    try {
      if (apiState === 'connected') {
        const response = await fetch(apiUrl('/api/people/import'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ people: pendingImport.people }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw Error(result?.error || 'Could not import the family data');
        const rows = await refreshPeople();
        setPeople(rows);
      } else {
        const existingIds = new Set(people.map((person) => person.id));
        const idMap = new Map(pendingImport.people.map((person, index) => [person.sourceId, existingIds.has(person.sourceId) ? person.sourceId : `local-import-${Date.now()}-${index}`]));
        const imported = pendingImport.people.map((person, index) => {
          const remap = (id) => idMap.get(String(id)) || (existingIds.has(String(id)) ? String(id) : null);
          return {
            ...person,
            id: idMap.get(person.sourceId),
            _id: null,
            parentIds: person.parentIds.map(remap).filter(Boolean).slice(0, 2),
            partnerIds: person.partnerIds.map(remap).filter(Boolean),
            siblingIds: person.siblingIds.map(remap).filter(Boolean),
            partnerRelationships: person.partnerRelationships.map((link) => ({ ...link, partnerId: remap(link.partnerId) })).filter((link) => link.partnerId),
            relationshipLinks: person.relationshipLinks.map((link) => ({ ...link, personId: remap(link.personId) })).filter((link) => link.personId && link.label),
            treeX: Number.isFinite(person.treeX) ? person.treeX : null,
            treeY: Number.isFinite(person.treeY) ? person.treeY : null,
            color: ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][(people.length + index) % 8],
          };
        });
        const importedById = new Map(imported.map((person) => [person.id, person]));
        setPeople((current) => [...current.map((person) => importedById.get(person.id) || person), ...imported.filter((person) => !existingIds.has(person.id))]);
      }
      const count = pendingImport.people.length;
      setPendingImport(null);
      setSelectedId('');
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(`Imported ${count} ${count === 1 ? 'person' : 'people'}`);
    } catch (error) {
      notify(error.message || 'Could not import the family data');
    } finally {
      setIsImporting(false);
    }
  }
  useEffect(() => {
    const handleRefreshShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'r') return;
      event.preventDefault();
      event.stopPropagation();
      refreshDataRef.current?.();
    };
    window.addEventListener('keydown', handleRefreshShortcut, true);
    return () => window.removeEventListener('keydown', handleRefreshShortcut, true);
  }, []);
  function notify(text) {
    setToast(text);
    setTimeout(() => setToast(''), 2600);
  }
  async function refreshPeople() {
    const r = await fetch(apiUrl('/api/people'));
    if (!r.ok) throw Error('Could not reload your family tree');
    return (await r.json()).map(fromApi);
  }
  async function saveMember(values) {
    const prior = modal.person;
    const { childIds = [], childRelationships = [], ...memberValues } = values;
    const childRoleById = new Map(childRelationships.map((link) => [link.personId, link.role]));
    const currentPositions = new Map([...layoutTree(people).positions, ...layout.positions]);
    const placement = relationshipPlacement(people, values, prior, currentPositions);
    const anchoredPeople = placement
      ? people.map((person) => {
          const position = currentPositions.get(person.id);
          return position ? { ...person, treeX: position.rawX, treeY: position.rawY } : person;
        })
      : people;
    const payload = {
      ...memberValues,
      ...placement,
      parentIds: (values.parentIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      partnerIds: (values.partnerIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      siblingIds: (values.siblingIds || []).filter((id) => people.some((p) => p.id === id && p._id)),
      partnerRelationships: (values.partnerRelationships || []).filter((link) => (values.partnerIds || []).includes(link.partnerId) && people.some((p) => p.id === link.partnerId && p._id)),
      relationshipLinks: (values.relationshipLinks || []).filter((link) => link.label.trim() && people.some((p) => p.id === link.personId && p._id)),
    };
    if (apiState === 'connected') {
      try {
        if (placement) {
          const positions = anchoredPeople
            .filter(
              (person) =>
                person._id &&
                person.id !== prior?.id &&
                (!Number.isFinite(people.find((item) => item.id === person.id)?.treeX) || !Number.isFinite(people.find((item) => item.id === person.id)?.treeY)),
            )
            .map((person) => ({ id: person._id, treeX: person.treeX, treeY: person.treeY }));
          if (positions.length) {
            const response = await fetch(apiUrl('/api/people/layout/positions'), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ positions }),
            });
            if (!response.ok) throw Error('Could not preserve the family positions');
          }
        }
        const r = await fetch(apiUrl(prior ? `/api/people/${prior._id}` : '/api/people'), {
          method: prior ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error || 'Could not save this person');
        const saved = fromApi(data);
        const nextChildIds = new Set(childIds.filter((id) => people.some((person) => person.id === id && person._id)));
        const currentChildren = prior ? people.filter((person) => (person.parentIds || []).includes(prior.id)) : [];
        const childUpdates = [...new Map([...currentChildren, ...people.filter((person) => nextChildIds.has(person.id))].map((person) => [person.id, person])).values()]
          .filter((child) => {
            const role = childRoleById.get(child.id);
            const requestedGender = role === 'Son' ? 'male' : role === 'Daughter' ? 'female' : null;
            const linkChanged = currentChildren.some((person) => person.id === child.id) !== nextChildIds.has(child.id);
            return child._id && (linkChanged || (requestedGender && child.gender !== requestedGender));
          })
          .map(async (child) => {
            const parentIds = nextChildIds.has(child.id) ? [...new Set([...(child.parentIds || []), saved.id])] : (child.parentIds || []).filter((id) => id !== saved.id);
            const role = childRoleById.get(child.id);
            const requestedGender = role === 'Son' ? 'male' : role === 'Daughter' ? 'female' : null;
            const response = await fetch(apiUrl(`/api/people/${child._id}`), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parentIds, ...(requestedGender ? { gender: requestedGender } : {}) }),
            });
            if (!response.ok) throw Error('Person saved, but a child link could not be updated');
          });
        await Promise.all(childUpdates);
        const rows = await refreshPeople();
        setPeople(rows);
        setSelectedId(saved.id);
        setModal(null);
        setDetailsOpen(false);
        setMobileDetailsOpen(false);
        notify(prior ? 'Person updated' : 'Person added to the tree');
      } catch (e) {
        notify(e.message);
      }
      return;
    }
    const id = prior?.id || `local-${Date.now()}`;
    const newPerson = {
      ...prior,
      ...values,
      ...placement,
      id,
      _id: null,
      color: prior?.color || ['sage', 'rose', 'blue', 'peach', 'lavender', 'yellow', 'mint', 'pink'][people.length % 8],
    };
    let rows = prior ? anchoredPeople.map((p) => (p.id === id ? newPerson : p)) : [...anchoredPeople, newPerson];
    const currentChildren = new Set(prior ? people.filter((person) => (person.parentIds || []).includes(prior.id)).map((person) => person.id) : []);
    const nextChildren = new Set(childIds);
    const currentPartners = new Set(prior?.partnerIds || []);
    const nextPartners = new Set(values.partnerIds || []);
    const currentSiblings = new Set(prior?.siblingIds || []);
    const nextSiblings = new Set(values.siblingIds || []);
    const nextCustom = new Map((values.relationshipLinks || []).map((link) => [link.personId, link.label.trim()]));
    rows = rows.map((p) => {
      if (p.id === id) return p;
      let updated = p;
      if (currentChildren.has(p.id) || nextChildren.has(p.id)) {
        const childRole = childRoleById.get(p.id);
        const requestedGender = childRole === 'Son' ? 'male' : childRole === 'Daughter' ? 'female' : null;
        updated = {
          ...updated,
          parentIds: nextChildren.has(p.id) ? [...new Set([...(updated.parentIds || []), id])] : (updated.parentIds || []).filter((parentId) => parentId !== id),
          ...(requestedGender ? { gender: requestedGender } : {}),
        };
      }
      const next = nextPartners.has(p.id);
      const relationship = (values.partnerRelationships || []).find((link) => link.partnerId === p.id)?.label;
      const partnerRelationships = (updated.partnerRelationships || []).filter((link) => link.partnerId !== id);
      updated = {
        ...updated,
        partnerIds: next ? [...new Set([...(updated.partnerIds || []), id])] : currentPartners.has(p.id) ? (updated.partnerIds || []).filter((x) => x !== id) : updated.partnerIds || [],
        partnerRelationships: next ? (relationship ? [...partnerRelationships, { partnerId: id, label: relationship }] : partnerRelationships) : partnerRelationships,
        siblingIds: nextSiblings.has(p.id)
          ? [...new Set([...(updated.siblingIds || []), id])]
          : currentSiblings.has(p.id)
            ? (updated.siblingIds || []).filter((x) => x !== id)
            : updated.siblingIds || [],
        relationshipLinks: (updated.relationshipLinks || []).filter((link) => link.personId !== id),
      };
      if (nextCustom.has(p.id)) updated.relationshipLinks = [...updated.relationshipLinks, { personId: id, label: nextCustom.get(p.id) }];
      return updated;
    });
    setPeople(rows);
    setSelectedId(id);
    setModal(null);
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
    notify(prior ? 'Person updated for this browser' : 'Person added for this browser');
  }
  async function removePerson() {
    if (!selected) return;
    const isBulkSelection = selectedNodeIds.length > 1;
    try {
      const removalIds = new Set(isBulkSelection ? selectedNodeIds : [selected.id, ...(deleteDescendants ? selectedDescendants : [])]);
      const removedPeople = people.filter((person) => removalIds.has(person.id));
      const rows = people
        .filter((person) => !removalIds.has(person.id))
        .map((person) => {
          const position = layout.positions.get(person.id);
          return {
            ...person,
            parentIds: (person.parentIds || []).filter((id) => !removalIds.has(id)),
            partnerIds: (person.partnerIds || []).filter((id) => !removalIds.has(id)),
            siblingIds: (person.siblingIds || []).filter((id) => !removalIds.has(id)),
            partnerRelationships: (person.partnerRelationships || []).filter((link) => !removalIds.has(link.partnerId)),
            relationshipLinks: (person.relationshipLinks || []).filter((link) => !removalIds.has(link.personId)),
            treeX: position?.rawX ?? person.treeX,
            treeY: position?.rawY ?? person.treeY,
          };
        });
      if (apiState === 'connected') {
        const positions = rows.filter((person) => person._id).map((person) => ({ id: person._id, treeX: person.treeX, treeY: person.treeY }));
        const saved = await fetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        });
        if (!saved.ok) throw Error('Could not preserve the current tree layout');
        const ids = removedPeople.filter((person) => person._id).map((person) => person._id);
        if (ids.length) {
          const response = await fetch(apiUrl('/api/people/batch'), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          if (!response.ok) throw Error('Could not delete the selected people');
        }
      }
      setPeople(rows);
      setSelectedId(rows[0]?.id || '');
      setSelectedNodeIds([]);
      setConfirmDelete(false);
      notify(`Removed ${removedPeople.length} ${removedPeople.length === 1 ? 'person' : 'people'}; others stayed in place`);
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    if (!confirmDelete || !selected) return;
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        removePerson();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmDelete(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDelete, selectedId, selectedNodeIds, deleteDescendants, people, apiState, layout]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) spacePan.current = true;
      const state = deleteShortcutState.current;
      if (!state || state.confirmDelete || state.modal || event.repeat || event.altKey) return;
      const target = event.target;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.closest?.('[contenteditable="true"]')) return;
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'a') {
        if (!state.familyPeople.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const ids = state.familyPeople.map((person) => person.id);
        setSelectedNodeIds(ids);
        setSelectedId(ids[0] || '');
        setDetailsOpen(false);
        setMobileDetailsOpen(false);
        return;
      }
      const code = String(event.code || '').toLowerCase();
      if (!['delete', 'del', 'backspace'].includes(key) && !['delete', 'numpaddecimal'].includes(code) && event.keyCode !== 46) return;
      if (event.ctrlKey || event.metaKey || !state.selectedId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setConfirmDelete(true);
    };
    const onKeyUp = (event) => {
      if (event.code === 'Space') spacePan.current = false;
    };
    const onBlur = () => {
      spacePan.current = false;
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== 'Escape' || confirmDelete) return;
      if (modal) {
        event.preventDefault();
        setModal(null);
        if (!selected) {
          setDetailsOpen(false);
          setMobileDetailsOpen(false);
        }
        return;
      }
      if (helpOpen) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }
      if (sidebarOpen) {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (mobileDetailsOpen || detailsOpen) {
        event.preventDefault();
        setMobileDetailsOpen(false);
        setDetailsOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [confirmDelete, detailsOpen, helpOpen, modal, mobileDetailsOpen, selected, sidebarOpen]);
  useEffect(() => {
    const closeHelpOutside = (event) => {
      if (!canvasHelpRef.current?.contains(event.target)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', closeHelpOutside);
    return () => document.removeEventListener('pointerdown', closeHelpOutside);
  }, []);
  function focusPersonInTree(id) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const viewport = treeScroll.current;
        if (!viewport) return;
        const node = [...viewport.querySelectorAll('.tree-person')].find((item) => item.dataset.personId === id);
        if (!node) return;
        const nodeRect = node.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        viewport.scrollTo({
          left: viewport.scrollLeft + nodeRect.left + nodeRect.width / 2 - viewportRect.left - viewport.clientWidth / 2,
          top: viewport.scrollTop + nodeRect.top + nodeRect.height / 2 - viewportRect.top - viewport.clientHeight / 2,
          behavior: 'smooth',
        });
      }),
    );
  }
  function zoomAround(clientX, clientY, nextZoom) {
    manualZoomTouched.current = true;
    pendingZoom.current = { clientX, clientY, nextZoom };
    if (zoomFrame.current) return;
    zoomFrame.current = requestAnimationFrame(() => {
      zoomFrame.current = 0;
      const request = pendingZoom.current;
      pendingZoom.current = null;
      if (!request || Math.abs(request.nextZoom - zoomValue.current) < 0.0001) return;
      const viewport = treeScroll.current;
      const board = viewport?.querySelector('.tree-board');
      if (viewport && board) {
        const boardRect = board.getBoundingClientRect();
        pendingZoomAnchor.current = {
          x: (request.clientX - boardRect.left) / zoomValue.current,
          y: (request.clientY - boardRect.top) / zoomValue.current,
          clientX: request.clientX,
          clientY: request.clientY,
        };
      }
      setZoom(request.nextZoom);
    });
  }
  function zoomTo(nextZoom) {
    nextZoom = Math.max(0.1, Math.min(maxCanvasZoom, nextZoom));
    const viewport = treeScroll.current;
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }
    const board = viewport.querySelector('.tree-board');
    const boardRect = board?.getBoundingClientRect();
    if (boardRect && layout.positions.size) {
      const positions = [...layout.positions.values()];
      const minX = Math.min(...positions.map((position) => position.x));
      const maxX = Math.max(...positions.map((position) => position.x + position.w));
      const minY = Math.min(...positions.map((position) => position.y));
      const maxY = Math.max(...positions.map((position) => position.y + position.h));
      zoomAround(boardRect.left + ((minX + maxX) / 2) * zoomValue.current, boardRect.top + ((minY + maxY) / 2) * zoomValue.current, nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAround(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom);
  }
  function fitTreeToView() {
    manualZoomTouched.current = true;
    const viewport = treeScroll.current;
    if (!viewport) return;
    const fittedZoom = Math.min(1, maxCanvasZoom);
    zoomValue.current = fittedZoom;
    setZoom(fittedZoom);
    requestAnimationFrame(() => {
      const board = viewport.querySelector('.tree-board');
      const boardRect = board?.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (!boardRect || !layoutPositions.length) return;
      const centerX = (minNodeX + maxNodeX) / 2;
      const centerY = (minNodeY + maxNodeY) / 2;
      const targetX = viewportRect.left + viewport.clientWidth / 2;
      const targetY = viewportRect.top + viewport.clientHeight / 2;
      viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + boardRect.left + centerX * fittedZoom - targetX));
      viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + boardRect.top + centerY * fittedZoom - targetY));
    });
  }
  async function arrangeFamily() {
    if (!treePeople.length || isArranging) return;
    setIsArranging(true);
    try {
      const arrangedPositions =
        treeVisualStyle === 'dashboard' || treeVisualStyle === 'atlas'
          ? compactDashboardPositions(treePeople)
          : (() => {
              const automaticLayout = layoutTree(treePeople.map((person) => ({ ...person, treeX: null, treeY: null })));
              return treePeople.map((person) => {
                const position = automaticLayout.positions.get(person.id);
                return { id: person.id, treeX: position.rawX, treeY: position.rawY };
              });
            })();
      if (apiState === 'connected') {
        const databasePositions = arrangedPositions.map((position) => ({ ...position, id: people.find((person) => person.id === position.id)?._id })).filter((position) => position.id);
        const response = await fetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: databasePositions }),
        });
        if (!response.ok) throw Error('Could not save the arranged family');
      }
      const positionById = new Map(arrangedPositions.map((position) => [position.id, position]));
      setPeople((current) =>
        current.map((person) => {
          const position = positionById.get(person.id);
          return position ? { ...person, treeX: position.treeX, treeY: position.treeY } : person;
        }),
      );
      setPhoneLayoutPreview({});
      setSelectedNodeIds([]);
      setConfirmArrange(false);
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(apiState === 'connected' ? 'Family arranged and saved' : 'Family arranged for this browser');
    } catch (error) {
      notify(error.message || 'Could not arrange the family');
    } finally {
      setIsArranging(false);
    }
  }
  async function saveNamedLayout(event) {
    event.preventDefault();
    const name = layoutName.trim();
    if (!name || !treePeople.length || isSavingLayout) return;
    setIsSavingLayout(true);
    try {
      const positions = treePeople
        .map((person) => {
          const position = layout.positions.get(person.id);
          if (!position) return null;
          return { personId: apiState === 'connected' ? person._id : person.id, treeX: position.rawX, treeY: position.rawY };
        })
        .filter((position) => position?.personId);
      let saved;
      if (apiState === 'connected') {
        const response = await fetch(apiUrl('/api/layouts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, familyId: layoutScopeId, familyName: selectedFamily?.name || 'All families', positions }),
        });
        if (!response.ok) throw Error((await response.json().catch(() => null))?.error || 'Could not save this tree view');
        saved = await response.json();
      } else {
        const allLayouts = (() => {
          try {
            const parsed = JSON.parse(storageGet('kinfolk-saved-layouts-v1') || '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
        const normalizedName = name.toLocaleLowerCase();
        const currentPersonIds = new Set(positions.map((position) => String(position.personId)));
        const existing = allLayouts.find(
          (item) => item.normalizedName === normalizedName && (item.familyId === layoutScopeId || (item.positions || []).some((position) => currentPersonIds.has(String(position.personId)))),
        );
        saved = {
          _id: existing?._id || `local-${Date.now()}`,
          name,
          normalizedName,
          familyId: layoutScopeId,
          positions,
          updatedAt: new Date().toISOString(),
        };
        const next = [saved, ...allLayouts.filter((item) => item._id !== saved._id)];
        storageSet('kinfolk-saved-layouts-v1', JSON.stringify(next));
      }
      setSavedLayouts((current) => [saved, ...current.filter((item) => item._id !== saved._id && item.normalizedName !== saved.normalizedName)]);
      setLayoutName('');
      notify(`Saved “${name}”`);
    } catch (error) {
      notify(error.message || 'Could not save this tree view');
    } finally {
      setIsSavingLayout(false);
    }
  }
  async function applyNamedLayout(savedLayout) {
    if (applyingLayoutId) return;
    setApplyingLayoutId(savedLayout._id);
    try {
      const positions = (savedLayout.positions || [])
        .map((position) => ({
          id: String(position.personId),
          treeX: Number(position.treeX),
          treeY: Number(position.treeY),
        }))
        .filter((position) => Number.isFinite(position.treeX) && Number.isFinite(position.treeY));
      const currentIds = new Set(people.map((person) => String(person._id || person.id)));
      const availablePositions = positions.filter((position) => currentIds.has(position.id));
      if (!availablePositions.length) throw Error('No matching people remain in this saved view');
      if (apiState === 'connected') {
        const response = await fetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: availablePositions }),
        });
        if (!response.ok) throw Error('Could not restore this tree view');
      }
      const byPersonId = new Map(availablePositions.map((position) => [position.id, position]));
      setPeople((current) =>
        current.map((person) => {
          const position = byPersonId.get(String(person._id || person.id));
          return position ? { ...person, treeX: position.treeX, treeY: position.treeY } : person;
        }),
      );
      setPhoneLayoutPreview({});
      setSelectedNodeIds([]);
      setSavedLayoutsOpen(false);
      manualZoomTouched.current = false;
      autoFitSignature.current = '';
      notify(`Restored “${savedLayout.name}”`);
    } catch (error) {
      notify(error.message || 'Could not restore this tree view');
    } finally {
      setApplyingLayoutId('');
    }
  }
  async function removeNamedLayout(savedLayout) {
    if (deletingLayoutId) return;
    setDeletingLayoutId(savedLayout._id);
    try {
      if (apiState === 'connected') {
        const response = await fetch(apiUrl(`/api/layouts/${savedLayout._id}`), { method: 'DELETE' });
        if (!response.ok) throw Error((await response.json().catch(() => null))?.error || 'Could not remove this saved view');
      } else {
        let allLayouts = [];
        try {
          const parsed = JSON.parse(storageGet('kinfolk-saved-layouts-v1') || '[]');
          if (Array.isArray(parsed)) allLayouts = parsed;
        } catch {
          // Replace unreadable local layout data with the remaining valid views.
        }
        storageSet('kinfolk-saved-layouts-v1', JSON.stringify(allLayouts.filter((item) => item._id !== savedLayout._id)));
      }
      setSavedLayouts((current) => current.filter((item) => item._id !== savedLayout._id));
      setConfirmLayoutDeleteId('');
      notify(`Removed “${savedLayout.name}”`);
    } catch (error) {
      notify(error.message || 'Could not remove this saved view');
    } finally {
      setDeletingLayoutId('');
    }
  }
  function handleTouchStart(e) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    drag.current = null;
    const [a, b] = e.touches;
    pinch.current = {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      zoom: zoomValue.current,
    };
  }
  function handleTouchMove(e) {
    if (e.touches.length !== 2 || !pinch.current) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const centerX = (a.clientX + b.clientX) / 2;
    const centerY = (a.clientY + b.clientY) / 2;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    zoomAround(centerX, centerY, Math.max(0.1, Math.min(maxCanvasZoom, (pinch.current.zoom * distance) / pinch.current.distance)));
  }
  function handleTouchEnd(e) {
    if (e.touches.length < 2) pinch.current = null;
  }
  function selectPerson(personId) {
    setSelectedId(personId);
    setSelectedNodeIds([]);
  }
  function openAddPersonForm() {
    setModal({ inline: true });
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openQuickAdd(person, kind) {
    const childRole = person.gender === 'male' ? 'Son' : person.gender === 'female' ? 'Daughter' : 'Child';
    const parentRole = person.gender === 'male' ? 'Father' : person.gender === 'female' ? 'Mother' : 'Parent';
    const partnerRole = person.gender === 'male' ? 'Husband' : person.gender === 'female' ? 'Wife' : 'Partner';
    const presets = {
      father: { gender: 'male', lastName: person.lastName || '', role: childRole },
      mother: { gender: 'female', lastName: person.lastName || '', role: childRole },
      brother: { gender: 'male', lastName: person.lastName || '', role: 'Sibling' },
      sister: { gender: 'female', lastName: person.lastName || '', role: 'Sibling' },
      son: { gender: 'male', lastName: person.lastName || '', role: parentRole },
      daughter: { gender: 'female', lastName: person.lastName || '', role: parentRole },
      partner: {
        gender: person.gender === 'male' ? 'female' : person.gender === 'female' ? 'male' : 'unspecified',
        lastName: '',
        role: partnerRole,
      },
    };
    const preset = presets[kind];
    const initialRelationships = [];
    const addInitialRelationship = (personId, role) => {
      if (!personId || initialRelationships.some((link) => link.personId === personId)) return;
      initialRelationships.push({ personId, role, customLabel: '' });
    };
    addInitialRelationship(person.id, preset.role);
    if (kind === 'son' || kind === 'daughter') {
      const otherParent = (person.partnerIds || []).map((id) => people.find((candidate) => candidate.id === id)).find(Boolean);
      if (otherParent) {
        addInitialRelationship(otherParent.id, otherParent.gender === 'male' ? 'Father' : otherParent.gender === 'female' ? 'Mother' : 'Parent');
      }
      const parentIds = new Set([person.id, otherParent?.id].filter(Boolean));
      people
        .filter((candidate) => candidate.id !== person.id && (candidate.parentIds || []).some((parentId) => parentIds.has(parentId)))
        .forEach((sibling) => addInitialRelationship(sibling.id, sibling.gender === 'male' ? 'Brother' : sibling.gender === 'female' ? 'Sister' : 'Sibling'));
    }
    if (kind === 'brother' || kind === 'sister') {
      (person.parentIds || [])
        .map((id) => people.find((candidate) => candidate.id === id))
        .filter(Boolean)
        .forEach((parent) => addInitialRelationship(parent.id, parent.gender === 'male' ? 'Father' : parent.gender === 'female' ? 'Mother' : 'Parent'));
      const sharedParentIds = new Set(person.parentIds || []);
      people
        .filter((candidate) => candidate.id !== person.id && ((person.siblingIds || []).includes(candidate.id) || (candidate.parentIds || []).some((parentId) => sharedParentIds.has(parentId))))
        .forEach((sibling) => addInitialRelationship(sibling.id, sibling.gender === 'male' ? 'Brother' : sibling.gender === 'female' ? 'Sister' : 'Sibling'));
    }
    setQuickAddForId('');
    setSelectedId(person.id);
    setSelectedNodeIds([]);
    setModal({
      inline: true,
      defaults: { gender: preset.gender, lastName: preset.lastName },
      initialRelationships,
    });
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openPersonDetails(personId) {
    selectPerson(personId);
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openPersonEditor(person) {
    openPersonDetails(person.id);
    setModal({ person, inline: true });
  }
  function openLinkEditor() {
    if (selected) setModal({ person: selected, inline: true, focusLinks: true });
  }
  function clearSelection() {
    setSelectedId('');
    setSelectedNodeIds([]);
    setHighlightedNodeId('');
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
  }
  async function flushPositionSaves({ silent = false, keepalive = false } = {}) {
    if (positionSaveTimer.current) {
      clearTimeout(positionSaveTimer.current);
      positionSaveTimer.current = 0;
    }
    const positions = [...pendingPositionSaves.current.values()];
    if (!positions.length) return;
    pendingPositionSaves.current.clear();
    const message = positionSaveMessage.current;
    try {
      const response = await fetch(apiUrl('/api/people/layout/positions'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
        keepalive,
      });
      if (!response.ok) throw Error();
      if (!silent) notify(message.success);
    } catch {
      positions.forEach((position) => {
        if (!pendingPositionSaves.current.has(position.id)) pendingPositionSaves.current.set(position.id, position);
      });
      if (!silent) notify(message.failure);
    }
  }
  function queuePositionSave(positions, message) {
    positions.forEach((position) => pendingPositionSaves.current.set(position.id, position));
    positionSaveMessage.current = message;
    if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current);
    positionSaveTimer.current = window.setTimeout(() => flushPositionSaves(), 650);
  }
  function startDrag(e, p, pos) {
    if (e.button !== 0) return;
    if (e.target.closest('.tree-node-info,.tree-node-edit,.tree-node-delete,.tree-node-about,.tree-node-about-tooltip,.tree-node-quick-add')) return;
    e.preventDefault();
    e.stopPropagation();
    if (movementLocked) {
      const gesture = { mode: 'select-only', id: p.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, held: false };
      drag.current = gesture;
      gesture.holdTimer = window.setTimeout(() => {
        if (drag.current === gesture && !gesture.moved) gesture.held = true;
      }, 520);
      return;
    }
    const movingGroup = selectedNodeIds.length > 1 && selectedNodeIds.includes(p.id);
    const viewport = treeScroll.current;
    if (e.pointerId != null && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    const gesture = {
      mode: 'person',
      id: p.id,
      personId: p._id,
      compactViewport: isCompactViewport,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: pos.rawX,
      y: pos.rawY,
      zoom,
      scrollLeft: viewport?.scrollLeft || 0,
      scrollTop: viewport?.scrollTop || 0,
      moved: false,
      held: false,
      frame: 0,
      holdTimer: 0,
      groupSelection: movingGroup,
      familyPositions: movingGroup
        ? treePeople
            .filter((person) => selectedNodeIds.includes(person.id))
            .map((person) => {
              const position = layout.positions.get(person.id);
              return position ? { id: person.id, personId: person._id, x: position.rawX, y: position.rawY } : null;
            })
            .filter(Boolean)
        : null,
    };
    drag.current = gesture;
    gesture.holdTimer = window.setTimeout(() => {
      if (drag.current === gesture && !gesture.moved) gesture.held = true;
    }, 520);
  }
  function startPan(e) {
    if ((e.button !== 0 && e.button !== 1) || e.target.closest('.tree-person,.connector-hit,button,input,textarea,select,[role="button"]')) return;
    const viewport = treeScroll.current;
    if (!viewport) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const touchGesture = e.pointerType === 'touch';
    const shouldPan = e.button === 1 || spacePan.current;
    const bounds = viewport.getBoundingClientRect();
    drag.current = {
      mode: touchGesture ? 'touch-pending' : shouldPan ? 'pan' : 'marquee',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
      additive: e.shiftKey,
      additiveIds: e.shiftKey ? [...new Set([...selectedNodeIds, ...(selectedId ? [selectedId] : [])])] : [],
      startLocalX: e.clientX - bounds.left + viewport.scrollLeft,
      startLocalY: e.clientY - bounds.top + viewport.scrollTop,
    };
    if (touchGesture) {
      const gesture = drag.current;
      gesture.holdTimer = window.setTimeout(() => {
        if (drag.current === gesture && !gesture.moved) gesture.readyForMarquee = true;
      }, 450);
    }
    setMarqueeRect(null);
  }
  useEffect(() => {
    function onMove(e) {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX,
        dy = e.clientY - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      d.moved = true;
      d.held = false;
      if (d.holdTimer) {
        clearTimeout(d.holdTimer);
        d.holdTimer = 0;
      }
      e.preventDefault();
      if (d.mode === 'select-only') return;
      if (d.mode === 'touch-pending') d.mode = d.readyForMarquee ? 'marquee' : 'pan';
      if (d.mode === 'select') d.mode = 'pan';
      if (d.mode === 'person' || d.mode === 'pan') manualZoomTouched.current = true;
      if (d.mode === 'marquee') {
        const viewport = treeScroll.current;
        if (!viewport) return;
        const bounds = viewport.getBoundingClientRect();
        const currentX = e.clientX - bounds.left + viewport.scrollLeft;
        const currentY = e.clientY - bounds.top + viewport.scrollTop;
        setMarqueeRect({
          left: Math.min(d.startLocalX, currentX),
          top: Math.min(d.startLocalY, currentY),
          width: Math.abs(currentX - d.startLocalX),
          height: Math.abs(currentY - d.startLocalY),
        });
        return;
      }
      if (d.mode === 'pan') {
        const viewport = treeScroll.current;
        if (viewport) {
          viewport.scrollLeft = d.scrollLeft - dx;
          viewport.scrollTop = d.scrollTop - dy;
        }
        return;
      }
      const moveX = dx / d.zoom,
        moveY = dy / d.zoom;
      d.lastX = d.x + moveX;
      d.lastY = d.y + moveY;
      if (!d.frame)
        d.frame = requestAnimationFrame(() => {
          d.frame = 0;
          if (d.compactViewport) {
            const deltaX = d.lastX - d.x;
            const deltaY = d.lastY - d.y;
            const nextPositions = d.familyPositions
              ? Object.fromEntries(d.familyPositions.map((position) => [position.id, { treeX: position.x + deltaX, treeY: position.y + deltaY }]))
              : { [d.id]: { treeX: d.lastX, treeY: d.lastY } };
            setPhoneLayoutPreview((previous) => ({ ...previous, ...nextPositions }));
          } else setPeople((prev) => applyDragPositions(prev, d));
        });
    }
    async function onUp(e) {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (d.holdTimer) clearTimeout(d.holdTimer);
      if (d.frame) cancelAnimationFrame(d.frame);
      if (d.mode === 'select-only') {
        if (d.held && !d.moved) {
          openPersonDetails(d.id);
          return;
        }
        setSelectedId(d.id);
        setSelectedNodeIds([]);
        return;
      }
      if (d.mode === 'touch-pending') {
        if (!d.moved) clearSelection();
        return;
      }
      if (d.mode === 'pan') {
        if (d.held && !d.moved && d.id) {
          openPersonDetails(d.id);
        } else if (!d.moved && d.id) {
          setSelectedId(d.id);
          setSelectedNodeIds([]);
        } else if (!d.moved) clearSelection();
        return;
      }
      if (d.mode === 'marquee') {
        setMarqueeRect(null);
        if (!d.moved) {
          if (!d.additive) clearSelection();
          return;
        }
        const box = {
          left: Math.min(d.startX, e.clientX),
          right: Math.max(d.startX, e.clientX),
          top: Math.min(d.startY, e.clientY),
          bottom: Math.max(d.startY, e.clientY),
        };
        const hitIds = [...(treeScroll.current?.querySelectorAll('.tree-person') || [])]
          .filter((node) => {
            const bounds = node.getBoundingClientRect();
            return bounds.right >= box.left && bounds.left <= box.right && bounds.bottom >= box.top && bounds.top <= box.bottom;
          })
          .map((node) => node.dataset.personId);
        const ids = [...new Set([...(d.additiveIds || []), ...hitIds])];
        setSelectedId(ids[0] || '');
        setSelectedNodeIds(ids.length > 1 ? ids : []);
        setDetailsOpen(false);
        setMobileDetailsOpen(false);
        return;
      }
      if (d.held && !d.moved) {
        openPersonDetails(d.id);
        return;
      }
      if (d.mode === 'select' || !d.moved) {
        const card = [...(treeScroll.current?.querySelectorAll('.tree-person') || [])].find((node) => node.dataset.personId === d.id)?.querySelector('.tree-person-card');
        card?.focus({ preventScroll: true });
        setSelectedId(d.id);
        setSelectedNodeIds([]);
        return;
      }
      const moving = d.familyPositions
        ? d.familyPositions.map((position) => {
            const current = layoutRef.current.positions.get(position.id);
            return { id: position.id, x: position.x + (d.lastX - d.x), y: position.y + (d.lastY - d.y), w: current?.w || 196, h: current?.h || 76 };
          })
        : [{ id: d.id, x: d.lastX, y: d.lastY, w: layoutRef.current.positions.get(d.id)?.w || 196, h: layoutRef.current.positions.get(d.id)?.h || 76 }];
      const movingIds = new Set(moving.map((position) => position.id));
      const stationary = [...layoutRef.current.positions.values()]
        .filter((position) => !movingIds.has(position.person.id))
        .map((position) => ({ id: position.person.id, x: position.rawX, y: position.rawY, w: position.w, h: position.h }));
      const resolved = resolveNodeOverlaps(moving, stationary);
      const resolvedById = new Map(resolved.map((position) => [position.id, position]));
      setPeople((previous) =>
        previous.map((person) => {
          const position = resolvedById.get(person.id);
          return position ? { ...person, treeX: position.x, treeY: position.y } : person;
        }),
      );
      setSelectedId(d.id);
      if (!d.groupSelection) setSelectedNodeIds([]);
      if (d.compactViewport) {
        setPhoneLayoutPreview((previous) => {
          const next = { ...previous };
          movingIds.forEach((id) => delete next[id]);
          return next;
        });
      }
      const draggedPersonIds = new Map((d.familyPositions || [{ id: d.id, personId: d.personId }]).map((person) => [person.id, person.personId]));
      const databasePositions = moving
        .map((position) => {
          const resolvedPosition = resolvedById.get(position.id);
          const personId = draggedPersonIds.get(position.id);
          return resolvedPosition && personId ? { id: personId, treeX: resolvedPosition.x, treeY: resolvedPosition.y } : null;
        })
        .filter(Boolean);
      if (databasePositions.length) {
        queuePositionSave(databasePositions, {
          success: d.familyPositions ? 'Selected positions saved' : 'Position saved',
          failure: d.familyPositions ? 'Moved for this session; positions could not be saved' : 'Moved for this session; the position could not be saved',
        });
      } else notify(d.familyPositions ? 'Positions saved on this device' : 'Position saved on this device');
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (drag.current?.holdTimer) clearTimeout(drag.current.holdTimer);
      if (drag.current?.frame) cancelAnimationFrame(drag.current.frame);
      if (pendingPositionSaves.current.size) flushPositionSaves({ silent: true, keepalive: true });
    };
  }, []);
  const treeName = selectedFamilyId === '__all__' ? 'All families' : selectedFamily?.name || 'Your family';
  return (
    <div
      className={`family-app theme-${theme} tree-style-${treeVisualStyle} link-style-smooth deceased-ribbon-${deceasedRibbon} ${activeLinkNodeId ? 'has-link-focus' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${detailsOpen ? 'details-open' : 'details-closed'} ${modal?.inline ? 'editing-person' : ''}`}
      style={{ '--details-width': `${detailsWidth}px` }}
    >
      {sidebarOpen && (
        <>
          <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />
          <aside className="simple-sidebar">
            <div className="simple-brand">
              <div className="simple-brand-mark">
                <GitFork size={18} />
              </div>
              <span>kinfolk</span>
              <button className="plain-icon hide-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
                <PanelLeftClose size={17} />
              </button>
            </div>
            <div className="sidebar-family">
              <span className="sidebar-family-mark">{treeName[0] || 'F'}</span>
              <div>
                <strong>{treeName}</strong>
                <small>{apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? 'Loading…' : `${familyPeople.length} ${familyPeople.length === 1 ? 'person' : 'people'}`}</small>
              </div>
            </div>
            {families.length > 1 && (
              <div className="family-picker-label">
                <span>FAMILY</span>
                <div
                  className="family-picker-control"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setFamilyPickerOpen(false);
                  }}
                >
                  <label className="family-picker-search">
                    <Search size={13} />
                    <input
                      value={familyPickerOpen ? familyQuery : selectedFamilyId === '__all__' ? (families.length === 2 ? 'Both families' : 'All families') : selectedFamily?.name || ''}
                      placeholder="Search families"
                      onFocus={() => {
                        setFamilyPickerOpen(true);
                        setFamilyQuery('');
                      }}
                      onChange={(e) => {
                        setFamilyQuery(e.target.value);
                        setFamilyPickerOpen(true);
                      }}
                      aria-label="Search and select a family"
                      aria-expanded={familyPickerOpen}
                    />
                    {familyPickerOpen && familyQuery && (
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFamilyQuery('')} aria-label="Clear family search">
                        <X size={12} />
                      </button>
                    )}
                  </label>
                  {familyPickerOpen && (
                    <div className="family-picker-options">
                      <button
                        type="button"
                        className={selectedFamilyId === '__all__' ? 'active' : ''}
                        onClick={() => {
                          setSelectedFamilyId('__all__');
                          setSelectedId('');
                          setFamilyPickerOpen(false);
                          setFamilyQuery('');
                          setDetailsOpen(false);
                          setMobileDetailsOpen(false);
                          if (treeScroll.current) {
                            treeScroll.current.scrollLeft = 0;
                            treeScroll.current.scrollTop = 0;
                          }
                        }}
                      >
                        {families.length === 2 ? 'Both families' : 'All families'} · {people.length}
                      </button>
                      {families
                        .filter((group) => group.name.toLowerCase().includes(familyQuery.toLowerCase()))
                        .map((group) => (
                          <button
                            type="button"
                            key={group.id}
                            className={selectedFamilyId === group.id || (!selectedFamilyId && selectedFamily?.id === group.id) ? 'active' : ''}
                            onClick={() => {
                              setSelectedFamilyId(group.id);
                              setSelectedId('');
                              setFamilyPickerOpen(false);
                              setFamilyQuery('');
                              setDetailsOpen(false);
                              setMobileDetailsOpen(false);
                              if (treeScroll.current) {
                                treeScroll.current.scrollLeft = 0;
                                treeScroll.current.scrollTop = 0;
                              }
                            }}
                          >
                            {group.name} · {group.people.length}
                          </button>
                        ))}
                      {!families.some((group) => group.name.toLowerCase().includes(familyQuery.toLowerCase())) && <span>No matching families</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="side-caption">FAMILY MEMBERS</div>
            <label className="sidebar-search">
              <select value={memberFamilyFilter} onChange={(event) => setMemberFamilyFilter(event.target.value)} aria-label="Filter family group">
                <option value="__all__">All groups</option>
                {memberFamilyOptions.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.name} ({group.count})
                  </option>
                ))}
              </select>
              <Search size={14} />
              <input placeholder="Find a person" value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button onClick={() => setQuery('')}>
                  <X size={12} />
                </button>
              )}
            </label>
            <div className="member-list" ref={memberList}>
              {sidebarMemberGroups.map((group) => (
                <section className="member-family-group" key={group.name}>
                  <div className="member-family-heading">
                    <strong>{group.name}</strong>
                    <span>{group.people.length}</span>
                  </div>
                  <div className="member-family-people">
                    {group.people.map((p) => (
                      <button
                        key={p.id}
                        className={`member-list-item ${selectedId === p.id || selectedNodeIds.includes(p.id) ? 'active' : ''}`}
                        onClick={(e) => {
                          e.currentTarget.focus();
                          selectPerson(p.id);
                          setDetailsOpen(true);
                          if (window.innerWidth < 800) {
                            setSidebarOpen(false);
                            setMobileDetailsOpen(true);
                          }
                          focusPersonInTree(p.id);
                        }}
                      >
                        <PersonAvatar person={p} />
                        <span>{fullName(p)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {!filtered.length && (
                <div className="empty-list">
                  {apiState === 'checking' && (!hasMongoSnapshot || !people.length)
                    ? 'Loading family members…'
                    : apiState === 'error'
                      ? 'Could not load family members'
                      : query || memberFamilyFilter !== '__all__'
                        ? 'No matching people'
                        : 'No people yet'}
                </div>
              )}
            </div>
            <div className="sidebar-bottom">
              <div className="storage-status">
                <span className={`status-light ${refreshFailed ? 'error' : apiState}`} />
                <span>
                  {refreshFailed && hasMongoSnapshot
                    ? 'Offline · showing saved data'
                    : isRefreshing && hasMongoSnapshot
                      ? 'Refreshing data…'
                      : apiState === 'connected'
                        ? 'Saved to MongoDB'
                        : apiState === 'checking'
                          ? 'Connecting…'
                          : apiState === 'demo'
                            ? 'Saved in this browser'
                            : 'Database unavailable'}
                </span>
              </div>
              <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                <span>Switch to {theme === 'light' ? 'dark' : 'light'} mode</span>
              </button>
            </div>
          </aside>
        </>
      )}
      <main className="simple-main">
        <header className="simple-topbar">
          <div className="topbar-left">
            <button
              className="plain-icon open-sidebar"
              onClick={() => {
                const next = !sidebarOpen;
                setSidebarOpen(next);
                if (next && window.innerWidth <= 1050) setMobileDetailsOpen(false);
              }}
              aria-label={sidebarOpen ? 'Hide family members' : 'Show family members'}
              title={sidebarOpen ? 'Hide family members' : 'Show family members'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <div className="topbar-title">
              <span>FAMILY TREE</span>
              <h1>{treeName}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="header-member-search">
              <select value={memberFamilyFilter} onChange={(event) => setMemberFamilyFilter(event.target.value)} aria-label="Search within family group">
                <option value="__all__">All groups</option>
                {memberFamilyOptions.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.name} ({group.count})
                  </option>
                ))}
              </select>
              <Search size={14} />
              <input
                value={query}
                placeholder="Search people"
                aria-label="Search family members"
                onFocus={() => {
                  setSidebarOpen(true);
                  if (window.innerWidth <= 1050) setMobileDetailsOpen(false);
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSidebarOpen(true);
                  if (window.innerWidth <= 1050) setMobileDetailsOpen(false);
                }}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear member search">
                  <X size={12} />
                </button>
              )}
            </label>
            <div className={`top-settings ${settingsOpen ? 'is-open' : ''}`} ref={settingsControlRef}>
              <button type="button" className="top-theme-toggle" aria-label="Tree settings" aria-expanded={settingsOpen} title="Tree settings" onClick={() => setSettingsOpen((open) => !open)}>
                <Settings size={17} />
              </button>
              {settingsOpen && (
                <div className="tree-settings-menu" role="dialog" aria-label="Tree settings">
                  <div className="tree-settings-heading">
                    <strong>Visible relationships</strong>
                    <small>Choose which relationships appear in the tree</small>
                  </div>
                  {[
                    ['parent', 'Parents and children'],
                    ['partner', 'Partners and spouses'],
                    ['sibling', 'Siblings'],
                    ['custom', 'Other relationships'],
                  ].map(([type, label]) => (
                    <label className="link-visibility-option" key={type}>
                      <input type="checkbox" checked={visibleLinkTypes[type]} onChange={(event) => setVisibleLinkTypes((current) => ({ ...current, [type]: event.target.checked }))} />
                      <span className="link-visibility-check" aria-hidden="true">
                        {visibleLinkTypes[type] && <Check size={12} />}
                      </span>
                      <span>{label}</span>
                    </label>
                  ))}
                  <label className="deceased-ribbon-setting">
                    <span>
                      <strong>Deceased marker</strong>
                      <small>Show a corner ribbon when a death date is recorded</small>
                    </span>
                    <select value={deceasedRibbon} onChange={(event) => setDeceasedRibbon(event.target.value)} aria-label="Deceased person ribbon">
                      <option value="off">Off</option>
                      <option value="black">Black ribbon</option>
                      <option value="red">Red ribbon</option>
                    </select>
                  </label>
                  <div className="tree-data-settings">
                    <span>
                      <strong>Family data</strong>
                      <small>Choose fields, then export as CSV or Excel</small>
                    </span>
                    <button type="button" className="export-fields-toggle" onClick={() => setExportFieldsOpen((open) => !open)} aria-expanded={exportFieldsOpen}>
                      <span>Fields to export</span>
                      <strong>
                        {exportColumns.length} of {DATA_COLUMNS.length}
                      </strong>
                    </button>
                    {exportFieldsOpen && (
                      <div className="export-fields-panel">
                        <div className="export-fields-actions">
                          <button type="button" onClick={() => updateExportColumns(DATA_COLUMNS)}>
                            Select all
                          </button>
                          <button type="button" onClick={() => updateExportColumns([])}>
                            Clear
                          </button>
                        </div>
                        <div className="export-fields-grid">
                          {DATA_COLUMNS.map((column) => {
                            const checked = exportColumns.includes(column);
                            return (
                              <label key={column}>
                                <input type="checkbox" checked={checked} onChange={() => updateExportColumns(checked ? exportColumns.filter((item) => item !== column) : [...exportColumns, column])} />
                                <span className="link-visibility-check" aria-hidden="true">
                                  {checked && <Check size={11} />}
                                </span>
                                <span>{column}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="tree-data-actions">
                      <button type="button" onClick={exportCsv} title="Export CSV">
                        <Download size={13} /> CSV
                      </button>
                      <button type="button" onClick={exportExcel} title="Export Excel workbook">
                        <FileSpreadsheet size={13} /> Excel
                      </button>
                      <button type="button" onClick={() => importFileRef.current?.click()} title="Import CSV or Excel">
                        <Upload size={13} /> Import
                      </button>
                    </div>
                    <input
                      ref={importFileRef}
                      className="tree-data-file-input"
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleImportFile}
                    />
                  </div>
                </div>
              )}
            </div>
            <button className="top-theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color mode">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className={`top-theme-toggle data-refresh-toggle ${isRefreshing ? 'is-refreshing' : ''}`}
              onClick={refreshFromDatabase}
              disabled={isRefreshing}
              aria-label={isRefreshing ? 'Refreshing family data' : 'Refresh family data'}
              title={isRefreshing ? 'Refreshing family data…' : 'Refresh family data'}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="right-panel-toggle"
              onClick={() => {
                if (window.innerWidth <= 1050) {
                  setSidebarOpen(false);
                  setDetailsOpen(true);
                  setMobileDetailsOpen(!mobileDetailsOpen);
                } else setDetailsOpen(!detailsOpen);
              }}
              aria-label={(window.innerWidth <= 1050 ? mobileDetailsOpen : detailsOpen) ? 'Hide person details' : 'Show person details'}
            >
              {(window.innerWidth <= 1050 ? mobileDetailsOpen : detailsOpen) ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
            </button>
            <button className="add-person-button" onClick={() => openAddPersonForm()}>
              <Plus size={16} />
              <span>Add person</span>
            </button>
          </div>
        </header>
        <div className="tree-toolbar-simple">
          <div className="tree-toolbar-settings">
            <label className="tree-style-toolbar-field">
              <span>TREE STYLE</span>
              <select className="link-style-select" value={treeVisualStyle} onChange={(event) => setTreeVisualStyle(event.target.value)}>
                <option value="dashboard">Dashboard cards</option>
                <option value="classic">Classic cards</option>
                <option value="atlas">Family atlas</option>
              </select>
            </label>
            <button
              className={`family-color-toggle ${familyColorsEnabled ? 'active' : ''}`}
              type="button"
              aria-label={familyColorsEnabled ? 'Turn off family branch colors' : 'Turn on family branch colors'}
              aria-pressed={familyColorsEnabled}
              title="Color ancestors and descendants around the selected person"
              onClick={() => setFamilyColorsEnabled((enabled) => !enabled)}
            >
              <Palette size={14} />
              <span>Family colors</span>
            </button>
          </div>
          <div className="tree-count">
            <UsersRound size={15} />
            <span>{apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? 'Loading family…' : `${treePeople.length} ${treePeople.length === 1 ? 'person' : 'people'}`}</span>
            {(apiState !== 'checking' || (hasMongoSnapshot && people.length > 0)) && (
              <>
                <span className="toolbar-dot">·</span>
                <span>{layout.generationCount} generations</span>
              </>
            )}
          </div>
          <div className="tree-toolbar-actions">
            <button
              className="arrange-family-button saved-layouts-button"
              onClick={() => setSavedLayoutsOpen(true)}
              disabled={!treePeople.length}
              aria-label="Save or restore a favorite tree view"
              title="Save or restore a favorite tree view"
            >
              <Bookmark size={14} />
              <span>Saved views</span>
            </button>
            <button
              className="arrange-family-button"
              onClick={() => setConfirmArrange(true)}
              disabled={!treePeople.length || isArranging}
              aria-label="Arrange family into a clear layout"
              title="Arrange generations and save the new positions"
            >
              <GitFork size={14} />
              <span>{isArranging ? 'Arranging…' : 'Arrange'}</span>
            </button>
            <button
              className={`canvas-lock-button ${movementLocked ? 'locked' : 'unlocked'}`}
              onClick={() => setMovementLocked((locked) => !locked)}
              aria-pressed={movementLocked}
              aria-label={movementLocked ? 'Unlock node movement' : 'Lock node movement'}
              title={movementLocked ? 'Node movement is locked. Unlock to move people.' : 'Node movement is unlocked. Lock to prevent moving people.'}
            >
              {movementLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{movementLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
            <div className="zoom-tools">
              <button onClick={() => zoomTo(Math.max(0.1, +(zoomValue.current - 0.1).toFixed(2)))} aria-label="Zoom out">
                <ZoomOut size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => zoomTo(Math.min(maxCanvasZoom, +(zoomValue.current + 0.1).toFixed(2)))} aria-label="Zoom in">
                <ZoomIn size={16} />
              </button>
              <i />
              <button onClick={fitTreeToView} aria-label="Reset tree to 100% and center" title="100% and center">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
        </div>
        <section className="simple-canvas">
          <div className={`canvas-help ${helpOpen ? 'open' : ''}`} ref={canvasHelpRef}>
            <button
              className="canvas-help-button"
              aria-label="Canvas help"
              aria-expanded={helpOpen}
              aria-controls="canvas-help-tooltip"
              title="Canvas help"
              onClick={() => setHelpOpen((open) => !open)}
            >
              <Info size={17} />
            </button>
            <div id="canvas-help-tooltip" className="canvas-help-tooltip" role="tooltip">
              <p>
                <strong>Select and move:</strong> Drag any person to move them. Click or tap to select; selected people move together. Use the lock button to prevent accidental moves.
              </p>
              <p>
                <strong>Select a group:</strong> On laptop, drag empty canvas. On phone, hold empty canvas briefly, then drag to draw a rectangle.
              </p>
              <p>
                <strong>Move the canvas:</strong> On phone, drag empty space. On laptop, hold Space while dragging or use the middle mouse button.
              </p>
              <p>
                <strong>More:</strong> Hold a person for details. Use the eye icon to show details on laptop. Ctrl + mouse wheel or trackpad pinch zooms. Ctrl+A selects this family; Delete removes the
                selection. Use the + on a node to add a family member.
              </p>
            </div>
          </div>
          {selectedNodeIds.length > 1 && (
            <div className="selection-toolbar" aria-live="polite">
              <span>{selectedNodeIds.length} selected</span>
              <button onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Remove selected
              </button>
              <button className="selection-clear-button" aria-label="Clear selection" title="Clear selection" onClick={clearSelection}>
                <X size={14} />
              </button>
            </div>
          )}
          <div
            className="tree-scroll"
            ref={treeScroll}
            onPointerDown={startPan}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div
              className="tree-zoom-surface"
              style={{
                width: `calc(100% + ${treeExtraWidth}px)`,
                minWidth: treeContentWidth,
                height: Math.max(treeBoardHeight * zoom, treeViewportHeight + treePaddingY * 2 + treeBoardOffsetY * zoom, treeBoardTop + treeBoardHeight * zoom + treePaddingY),
              }}
            >
              <div
                className="tree-board"
                style={{
                  width: treeBoardWidth,
                  height: treeBoardHeight,
                  left: treeBoardLeft,
                  top: treeBoardTop,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <svg className="connector-svg" width={treeBoardWidth} height={treeBoardHeight} aria-label="Family relationships">
                  <defs>
                    <marker id="family-link-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="var(--line)" />
                    </marker>
                    <marker id="partner-link-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="var(--accent)" />
                    </marker>
                    <marker id="family-link-highlight-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="#f0a928" />
                    </marker>
                    <marker id="partner-link-highlight-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="#f0a928" />
                    </marker>
                    <marker id="smooth-link-dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse">
                      <circle cx="4" cy="4" r="2.4" />
                    </marker>
                    <marker id="smooth-link-highlight-dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse">
                      <circle cx="4" cy="4" r="3" fill="#f0a928" />
                    </marker>
                  </defs>
                  {visibleLinkTypes.parent && (
                    <FamilyBranchLinks
                      branches={layout.familyBranches}
                      people={treePeople}
                      curved
                      endpointDots
                      highlightedLink={highlightedLink}
                      highlightedNodeId={activeLinkNodeId}
                      highlightedAncestorIds={highlightedAncestorIds}
                      onHighlight={setHighlightedLink}
                    />
                  )}
                  {layout.edges
                    .filter((edge) => edge.kind !== 'parent' && visibleLinkTypes[edge.kind] !== false)
                    .map((edge, i) => {
                      const d = relationshipPath(edge);
                      const from = byId(edge.fromId),
                        to = byId(edge.toId);
                      const relation =
                        edge.kind === 'parent'
                          ? relationshipLabel('Parent', from, to)
                          : edge.kind === 'sibling'
                            ? 'Sibling'
                            : edge.kind === 'custom'
                              ? edge.label
                              : relationshipLabel('Partner', from, to) || 'Partner';
                      const reverseRelation =
                        edge.kind === 'parent'
                          ? relationshipLabel('Child', to, from)
                          : edge.kind === 'sibling'
                            ? 'Sibling'
                            : edge.kind === 'custom'
                              ? edge.label
                              : relationshipLabel('Partner', to, from) || 'Partner';
                      const description = `${fullName(from)} · ${relation} · ${fullName(to)}`;
                      const linkId = `${edge.kind}-${edge.fromId}-${edge.toId}`;
                      const nodeRelated =
                        activeLinkNodeId === edge.fromId ||
                        activeLinkNodeId === edge.toId ||
                        ((edge.kind === 'parent' || edge.kind === 'partner') && highlightedAncestorIds.has(edge.fromId) && highlightedAncestorIds.has(edge.toId));
                      const linkHighlighted = highlightedLink?.key === linkId;
                      const storedPartnerRelation = edge.kind === 'partner' ? partnerRelationship(from, to?.id) || partnerRelationship(to, from?.id) : '';
                      const genderedPartnerPair = (from?.gender === 'male' && to?.gender === 'female') || (from?.gender === 'female' && to?.gender === 'male');
                      const usesDefaultPartnerRole = ['', 'Husband', 'Wife', 'Spouse'].includes(storedPartnerRelation);
                      const visibleRelation =
                        edge.kind === 'custom'
                          ? edge.label
                          : edge.kind === 'sibling'
                            ? 'Sibling'
                            : edge.kind === 'partner' && genderedPartnerPair && usesDefaultPartnerRole
                              ? 'Husband · Wife'
                              : storedPartnerRelation || `${relation} · ${reverseRelation}`;
                      const relationLabelPoint = linkLabelPoint(edge, visibleRelation, connectorNodePositions, connectorLabelPositions, false);
                      return (
                        <g key={`${linkId}-${i}`} className={`relationship-link ${linkHighlighted ? 'is-highlighted' : ''} ${nodeRelated ? 'is-node-related' : ''}`}>
                          <path
                            className="connector-hit"
                            d={d}
                            tabIndex="0"
                            aria-label={description}
                            onPointerEnter={() => setHighlightedLink({ key: linkId, ids: [edge.fromId, edge.toId] })}
                            onPointerLeave={() => setHighlightedLink(null)}
                            onFocus={() => setHighlightedLink({ key: linkId, ids: [edge.fromId, edge.toId] })}
                            onBlur={() => setHighlightedLink(null)}
                          />
                          <path
                            className={`connector ${edge.kind}`}
                            d={d}
                            markerStart={`url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})`}
                            markerEnd={`url(#${linkHighlighted || nodeRelated ? 'smooth-link-highlight-dot' : 'smooth-link-dot'})`}
                          />
                          <text className="connector-relation" x={relationLabelPoint.x} y={relationLabelPoint.y} textAnchor="middle" dominantBaseline="central">
                            <title>
                              {fullName(from)} · {visibleRelation} · {fullName(to)}
                            </title>
                            {visibleRelation}
                          </text>
                        </g>
                      );
                    })}
                </svg>
                {treePeople.map((person) => {
                  const pos = layout.positions.get(person.id);
                  const isDetailsVisible = detailsOpen && selectedId === person.id;
                  return (
                    <div
                      key={person.id}
                      data-person-id={person.id}
                      className={`tree-person gender-${person.gender || 'unspecified'} ${person.deathDate ? 'is-deceased' : ''} ${highlightedLink?.ids?.includes(person.id) ? 'link-highlighted' : ''} ${highlightedNetworkIds.has(person.id) ? 'link-path-node' : ''} ${selectedId === person.id || selectedNodeIds.includes(person.id) ? 'selected' : ''} ${familyColorsEnabled && familyColors.has(person.id) ? `family-colored family-color-${familyColors.get(person.id)}` : ''}`}
                      style={{ left: pos.x, top: pos.y }}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== 'touch') setHighlightedNodeId(person.id);
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType !== 'touch') {
                          setHighlightedNodeId((current) => (current === person.id ? '' : current));
                        }
                      }}
                      onPointerDown={(e) => {
                        if (e.pointerType === 'touch') startDrag(e, person, pos);
                      }}
                      onPointerUp={(e) => {
                        if (e.pointerType === 'touch' && drag.current?.id === person.id && !drag.current.moved) {
                          setHighlightedNodeId((current) => (current === person.id ? '' : person.id));
                        }
                      }}
                      onMouseDown={(e) => startDrag(e, person, pos)}
                    >
                      <button
                        className="tree-person-card"
                        aria-label={`Select ${fullName(person)}; drag to move; press and hold to open details`}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={(e) => {
                          if (e.detail === 0) openPersonDetails(person.id);
                        }}
                      >
                        <PersonAvatar person={person} size="large" />
                        <span className="tree-person-copy">
                          <strong>{fullName(person)}</strong>
                          <small>
                            {person.maidenName ? `Born: ${person.maidenName} · ` : ''}
                            {year(person.birthDate)}
                            {person.deathDate ? ` — ${year(person.deathDate)}` : ' —'}
                          </small>
                        </span>
                        <span className="drag-grip">⠿</span>
                      </button>
                      <div className={`tree-node-quick-add ${quickAddForId === person.id ? 'is-open' : ''}`}>
                        <button
                          type="button"
                          className="tree-node-quick-add-button"
                          aria-label={`Quickly add a relative of ${fullName(person)}`}
                          aria-expanded={quickAddForId === person.id}
                          title="Add relative"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setQuickAddForId((current) => (current === person.id ? '' : person.id));
                          }}
                        >
                          <Plus size={16} />
                        </button>
                        {quickAddForId === person.id && (
                          <div className="tree-node-quick-add-menu" role="menu" aria-label={`Add relative of ${fullName(person)}`}>
                            {[
                              ['father', 'Father'],
                              ['mother', 'Mother'],
                              ['brother', 'Brother'],
                              ['sister', 'Sister'],
                              ['son', 'Son'],
                              ['daughter', 'Daughter'],
                              ['partner', 'Partner'],
                            ].map(([kind, label]) => (
                              <button
                                type="button"
                                role="menuitem"
                                key={kind}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openQuickAdd(person, kind);
                                }}
                              >
                                <Plus size={12} />
                                Add {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="tree-node-edit"
                        title={`Edit ${fullName(person)}`}
                        aria-label={`Edit ${fullName(person)}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPersonEditor(person);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="tree-node-info"
                        title={isDetailsVisible ? `Hide ${fullName(person)} details` : `View ${fullName(person)} details`}
                        aria-label={isDetailsVisible ? `Hide ${fullName(person)} details` : `View ${fullName(person)} details`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDetailsVisible) {
                            setDetailsOpen(false);
                            setMobileDetailsOpen(false);
                          } else openPersonDetails(person.id);
                        }}
                      >
                        {isDetailsVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <div
                        className={`tree-node-about-wrap ${aboutTooltipId === person.id ? 'is-open' : ''} ${dismissedAboutTooltipId === person.id ? 'is-dismissed' : ''}`}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== 'touch' && dismissedAboutTooltipId === person.id) {
                            setDismissedAboutTooltipId('');
                          }
                        }}
                      >
                        <button
                          className="tree-node-about"
                          aria-label={`Information about ${fullName(person)}`}
                          aria-describedby={`tree-person-tooltip-${person.id}`}
                          aria-expanded={aboutTooltipId === person.id}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (aboutTooltipId === person.id) {
                              setDismissedAboutTooltipId(person.id);
                              setAboutTooltipId('');
                            } else {
                              setDismissedAboutTooltipId('');
                              setAboutTooltipId(person.id);
                            }
                          }}
                        >
                          <Info size={13} />
                        </button>
                        <div
                          id={`tree-person-tooltip-${person.id}`}
                          className="tree-node-about-tooltip"
                          role="tooltip"
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="tree-node-about-heading">
                            <span>PERSON DETAILS</span>
                            <strong>{fullName(person)}</strong>
                          </div>
                          <div className="tree-node-about-facts">
                            <div className="tree-node-about-fact">
                              <span>Gender</span>
                              <strong>{person.gender && person.gender !== 'unspecified' ? `${person.gender[0].toUpperCase()}${person.gender.slice(1)}` : 'Not specified'}</strong>
                            </div>
                            <div className="tree-node-about-fact">
                              <span>Born</span>
                              <strong>{person.birthDate ? year(person.birthDate) : 'Not added'}</strong>
                            </div>
                            {person.birthPlace && (
                              <div className="tree-node-about-fact">
                                <span>Birthplace</span>
                                <strong>{person.birthPlace}</strong>
                              </div>
                            )}
                            {person.occupation && (
                              <div className="tree-node-about-fact">
                                <span>Occupation</span>
                                <strong>{person.occupation}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        className="tree-node-delete"
                        title={`Delete ${fullName(person)}`}
                        aria-label={`Delete ${fullName(person)}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(person.id);
                          setSelectedNodeIds([]);
                          setConfirmDelete(true);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {marqueeRect && <div className="marquee-selection" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} aria-hidden="true" />}
          </div>
          {apiState === 'checking' && (!hasMongoSnapshot || !people.length) ? (
            <div className="tree-loading" role="status" aria-live="polite">
              <span className="loading-spinner" />
              <span>Loading your family tree…</span>
            </div>
          ) : (
            !treePeople.length && (
              <div className="tree-empty">
                <div className="tree-empty-icon">
                  <GitFork size={26} />
                </div>
                {apiState === 'error' ? (
                  <>
                    <h2>Couldn’t load your family tree</h2>
                    <p>Check that the API and MongoDB are running, then try again.</p>
                    <button className="add-person-button" onClick={refreshFromDatabase} disabled={isRefreshing}>
                      {isRefreshing ? 'Refreshing…' : 'Try again'}
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Start your family tree</h2>
                    <p>Add a person, then link parents and partners to build the branches.</p>
                    <button className="add-person-button" onClick={() => openAddPersonForm()}>
                      <Plus size={16} />
                      Add first person
                    </button>
                  </>
                )}
              </div>
            )
          )}
          <div className="canvas-zoom-controls">
            <button onClick={() => zoomTo(Math.min(maxCanvasZoom, +(zoomValue.current + 0.1).toFixed(2)))} aria-label="Zoom in">
              <Plus size={17} />
            </button>
            <button onClick={() => zoomTo(Math.max(0.1, +(zoomValue.current - 0.1).toFixed(2)))} aria-label="Zoom out">
              <span>−</span>
            </button>
          </div>
          <div className={`mobile-tree-style-control ${treeStyleMenuOpen ? 'is-open' : ''}`} ref={treeStyleControlRef}>
            {treeStyleMenuOpen && (
              <div className="tree-style-selection" role="menu" aria-label="Select tree style">
                {[
                  ['dashboard', 'Dashboard cards'],
                  ['classic', 'Classic cards'],
                  ['atlas', 'Family atlas'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={treeVisualStyle === value}
                    className={treeVisualStyle === value ? 'active' : ''}
                    onClick={() => {
                      setTreeVisualStyle(value);
                      setTreeStyleMenuOpen(false);
                    }}
                  >
                    <i aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="tree-style-fab" aria-label="Choose tree style" aria-expanded={treeStyleMenuOpen} title="Tree style" onClick={() => setTreeStyleMenuOpen((open) => !open)}>
              <Network size={18} />
            </button>
          </div>
        </section>
      </main>
      {mobileDetailsOpen && <button className="details-scrim" onClick={clearSelection} aria-label="Close person details and clear selection" />}
      {detailsOpen && (
        <aside className={`simple-details ${mobileDetailsOpen ? 'show-mobile' : ''} ${modal?.inline ? 'editing-person' : ''}`}>
          <div
            className="details-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize details panel"
            aria-valuenow={detailsWidth}
            tabIndex={0}
            onKeyDown={handleDetailsResizeKey}
            onPointerDown={beginDetailsResize}
            onPointerMove={moveDetailsResize}
            onPointerUp={endDetailsResize}
            onPointerCancel={endDetailsResize}
          />
          {modal?.inline && (!modal.person || modal.person.id === selected?.id) ? (
            <PersonModal
              key={modal.person?.id || modal.kind || 'new'}
              modal={modal}
              people={people}
              onClose={() => {
                setModal(null);
                if (!selected) {
                  setDetailsOpen(false);
                  setMobileDetailsOpen(false);
                }
              }}
              onSave={saveMember}
            />
          ) : selected ? (
            <>
              <div className="details-heading">
                <span>PERSON DETAILS</span>
                <div>
                  <button className="family-links-edit-button" onClick={() => setModal({ person: selected, inline: true })} aria-label="Edit person" title="Edit person">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              <div className="selected-profile">
                <PersonAvatar person={selected} size="profile" />
                <h2>{fullName(selected)}</h2>
                <span className="person-years">
                  {year(selected.birthDate)}
                  {selected.deathDate ? ` — ${year(selected.deathDate)}` : ' —'}
                </span>
              </div>
              <div className="details-fields">
                <div className="detail-field">
                  <CalendarDays size={15} />
                  <span>
                    <small>Born</small>
                    <strong>{formatLongDate(selected.birthDate)}</strong>
                  </span>
                </div>
                <div className="detail-field">
                  <MapPin size={15} />
                  <span>
                    <small>Birthplace</small>
                    <strong>{selected.birthPlace || 'Not added'}</strong>
                  </span>
                </div>
                {selected.deathDate && (
                  <div className="detail-field">
                    <CalendarDays size={15} />
                    <span>
                      <small>Died</small>
                      <strong>
                        {new Date(`${selected.deathDate}T00:00:00`).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>
                  </div>
                )}
                {selected.occupation && (
                  <div className="detail-field">
                    <Heart size={15} />
                    <span>
                      <small>Occupation</small>
                      <strong>{selected.occupation}</strong>
                    </span>
                  </div>
                )}
              </div>
              <div className="details-bio">
                <label>ABOUT</label>
                <p>{selected.bio || 'Add a short story or memory about this person.'}</p>
              </div>
              <div className="details-links">
                <div className="details-links-heading">
                  <label>FAMILY LINKS</label>
                  <button className="family-links-edit-button" onClick={openLinkEditor} aria-label="Edit family links" title="Edit family links">
                    <Pencil size={13} />
                  </button>
                </div>
                {familyLinkGroups.length ? (
                  <div className="details-link-groups">
                    {familyLinkGroups.map((group) => (
                      <section className="details-link-group" key={group.key} aria-labelledby={`family-link-group-${group.key}`}>
                        <h3 id={`family-link-group-${group.key}`}>
                          <span>{group.label}</span>
                          <small>{group.links.length}</small>
                        </h3>
                        {group.links.map((link) => {
                          const person = byId(link.id);
                          return (
                            <button
                              className="details-link-row"
                              key={`${group.key}-${link.id}`}
                              onClick={() => {
                                openPersonDetails(link.id);
                                focusPersonInTree(link.id);
                              }}
                            >
                              <PersonAvatar person={person} />
                              <span className="details-link-person">
                                <strong>{fullName(person)}</strong>
                              </span>
                              <small className="details-link-role">{link.label || relationshipLabel(link.role, person, selected)}</small>
                            </button>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="details-links-empty">No family links added yet.</p>
                )}
                <div className="details-actions-row">
                  <button
                    className="details-cancel-button"
                    onClick={() => {
                      setModal(null);
                      setDetailsOpen(false);
                      setMobileDetailsOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="remove-person-button" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Remove person
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="details-empty">
              <UsersRound size={23} />
              <p>Select a person in the tree to see details.</p>
            </div>
          )}
        </aside>
      )}
      {modal && !modal.inline && <PersonModal key={modal.person?.id || modal.kind || 'new'} modal={modal} people={people} onClose={() => setModal(null)} onSave={saveMember} />}
      {pendingImport && (
        <div
          className="simple-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isImporting) setPendingImport(null);
          }}
        >
          <div className="delete-dialog import-data-dialog" role="dialog" aria-modal="true" aria-labelledby="import-data-title">
            <div className="arrange-dialog-icon" aria-hidden="true">
              <Upload size={20} />
            </div>
            <h2 id="import-data-title">Import family data?</h2>
            <p>
              <strong>{pendingImport.filename}</strong> contains {pendingImport.people.length} {pendingImport.people.length === 1 ? 'person' : 'people'}.
            </p>
            <p>Matching IDs will be updated. New IDs will be added. Existing people missing from the file will remain in the tree.</p>
            <div>
              <button type="button" onClick={() => setPendingImport(null)} disabled={isImporting}>
                Cancel
              </button>
              <button type="button" className="arrange-action" onClick={confirmDataImport} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Import data'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && selected && (
        <div className="simple-modal-backdrop">
          <div className="delete-dialog">
            <h2>{selectedNodeIds.length > 1 ? `Remove ${selectedNodeIds.length} selected people?` : `Remove ${fullName(selected)}?`}</h2>
            <p>
              {selectedNodeIds.length > 1
                ? 'This will permanently remove the selected family members and their links.'
                : deleteDescendants
                  ? `This will also delete ${selectedDescendants.length} descendant${selectedDescendants.length === 1 ? '' : 's'} and their links.`
                  : 'This also removes their links from the tree.'}
            </p>
            {selectedNodeIds.length <= 1 && (
              <label className="delete-descendants-option">
                <input type="checkbox" checked={deleteDescendants} onChange={(e) => setDeleteDescendants(e.target.checked)} />
                <span>Also delete all descendants ({selectedDescendants.length})</span>
              </label>
            )}
            <div>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="danger-action" onClick={removePerson}>
                Remove {selectedNodeIds.length > 1 ? 'selected people' : 'person'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmArrange && (
        <div
          className="simple-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isArranging) setConfirmArrange(false);
          }}
        >
          <div className="delete-dialog arrange-dialog" role="dialog" aria-modal="true" aria-labelledby="arrange-family-title">
            <div className="arrange-dialog-icon" aria-hidden="true">
              <GitFork size={20} />
            </div>
            <h2 id="arrange-family-title">Arrange this family?</h2>
            <p>The visible family will be placed in clear generation rows with partners and siblings together. The new positions will be saved for every device.</p>
            <div>
              <button onClick={() => setConfirmArrange(false)} disabled={isArranging}>
                Cancel
              </button>
              <button className="arrange-action" onClick={arrangeFamily} disabled={isArranging}>
                {isArranging ? 'Arranging…' : 'Arrange family'}
              </button>
            </div>
          </div>
        </div>
      )}
      {savedLayoutsOpen && (
        <div
          className="simple-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingLayout && !applyingLayoutId) setSavedLayoutsOpen(false);
          }}
        >
          <div className="delete-dialog saved-layouts-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-layouts-title">
            <button className="saved-layouts-close" onClick={() => setSavedLayoutsOpen(false)} aria-label="Close saved tree views">
              <X size={17} />
            </button>
            <div className="arrange-dialog-icon" aria-hidden="true">
              <Bookmark size={20} />
            </div>
            <h2 id="saved-layouts-title">Favorite tree views</h2>
            <p>Save this family’s current node positions with a name. Restoring a view also saves it as the active layout on every device.</p>
            <form className="save-layout-form" onSubmit={saveNamedLayout}>
              <label htmlFor="saved-layout-name">View name</label>
              <div>
                <input id="saved-layout-name" value={layoutName} onChange={(event) => setLayoutName(event.target.value)} maxLength={60} placeholder="Example: My favorite layout" autoFocus />
                <button type="submit" className="arrange-action" disabled={!layoutName.trim() || isSavingLayout}>
                  <Save size={14} />
                  {isSavingLayout ? 'Saving…' : 'Save current'}
                </button>
              </div>
            </form>
            <div className="saved-layout-list" aria-label="Saved tree views">
              <div className="saved-layout-list-heading">
                <span>Saved views</span>
                <small>{savedLayouts.length}</small>
              </div>
              {savedLayouts.length ? (
                savedLayouts.map((savedLayout) => (
                  <div className="saved-layout-row" key={savedLayout._id}>
                    <div>
                      <strong>{savedLayout.name}</strong>
                      <small>
                        {savedLayout.positions?.length || 0} people · {new Date(savedLayout.updatedAt).toLocaleDateString()}
                      </small>
                    </div>
                    <div className="saved-layout-actions">
                      {confirmLayoutDeleteId === savedLayout._id ? (
                        <>
                          <button type="button" onClick={() => setConfirmLayoutDeleteId('')} disabled={deletingLayoutId === savedLayout._id}>
                            Cancel
                          </button>
                          <button className="remove-saved-layout-confirm" type="button" onClick={() => removeNamedLayout(savedLayout)} disabled={deletingLayoutId === savedLayout._id}>
                            {deletingLayoutId === savedLayout._id ? 'Removing…' : 'Remove'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => applyNamedLayout(savedLayout)} disabled={Boolean(applyingLayoutId || deletingLayoutId)}>
                            <FolderOpen size={14} />
                            {applyingLayoutId === savedLayout._id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            className="remove-saved-layout"
                            type="button"
                            onClick={() => setConfirmLayoutDeleteId(savedLayout._id)}
                            disabled={Boolean(applyingLayoutId || deletingLayoutId)}
                            aria-label={`Remove saved view ${savedLayout.name}`}
                            title="Remove saved view"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="saved-layout-empty">
                  <Bookmark size={18} />
                  <span>No favorite views saved for this family yet.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {toast && <div className="simple-toast">{toast}</div>}
    </div>
  );
}

const relationshipOptionGroups = [
  { label: 'Parents', options: ['Father', 'Mother', 'Parent'] },
  { label: 'Partners', options: ['Husband', 'Wife', 'Boyfriend', 'Girlfriend', 'Fiancé', 'Partner', 'Spouse'] },
  { label: 'Children', options: ['Son', 'Daughter', 'Child'] },
  { label: 'Siblings', options: ['Brother', 'Sister', 'Sibling'] },
  { label: 'Other relationships', options: ['Other'] },
];
const relationshipOptions = relationshipOptionGroups.flatMap((group) => group.options);

function relationshipCategory(role) {
  return relationshipOptionGroups.find((group) => group.options.includes(role))?.label || 'Uncategorized';
}
function defaultPartnerLabel(gender) {
  return gender === 'male' ? 'Husband' : gender === 'female' ? 'Wife' : 'Spouse';
}
function RelationshipEditor({ people, relationships, onChange, excludeId }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const selectedIds = relationships.map((link) => link.personId);
  const groupedRelationships = relationshipOptionGroups
    .map((group) => ({
      ...group,
      links: relationships.map((link, index) => ({ link, index })).filter(({ link }) => relationshipCategory(link.role) === group.label),
    }))
    .concat({
      label: 'Uncategorized',
      options: [],
      links: relationships.map((link, index) => ({ link, index })).filter(({ link }) => relationshipCategory(link.role) === 'Uncategorized'),
    })
    .filter((group) => group.links.length > 0);
  const results = people.filter((person) => person.id !== excludeId && !selectedIds.includes(person.id) && fullName(person).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);
  function add(id) {
    onChange([...relationships, { personId: id, role: '', customLabel: '' }]);
    setQuery('');
  }
  function update(index, changes) {
    if (changes.role && ['Father', 'Mother', 'Parent'].includes(changes.role)) {
      const parentCount = relationships.filter((link, rowIndex) => rowIndex !== index && ['Father', 'Mother', 'Parent'].includes(link.role)).length;
      if (parentCount >= 2) {
        setError('A person can have at most two parents.');
        return;
      }
    }
    if (changes.role && ['Son', 'Daughter', 'Child'].includes(changes.role)) {
      const relatedPerson = people.find((person) => person.id === relationships[index]?.personId);
      if (relatedPerson && relatedPerson.parentIds?.length >= 2 && !relatedPerson.parentIds.includes(excludeId)) {
        setError('This person already has two parents.');
        return;
      }
    }
    setError('');
    onChange(relationships.map((link, rowIndex) => (rowIndex === index ? { ...link, ...changes } : link)));
  }
  return (
    <div className="relationship-editor">
      {relationships.length > 0 && (
        <div className="relationship-list">
          {groupedRelationships.map((group) => (
            <section className="relationship-group" key={group.label}>
              <h4>
                <span>{group.label}</span>
                <small>{group.links.length}</small>
              </h4>
              <div className="relationship-group-rows">
                {group.links.map(({ link, index }) => {
                  const person = people.find((item) => item.id === link.personId);
                  if (!person) return null;
                  return (
                    <div className="relationship-row" key={`${link.personId}-${index}`}>
                      <div className="relationship-person" title={fullName(person)}>
                        <span className="relationship-person-avatar" aria-hidden="true">
                          {initials(person)}
                        </span>
                        <strong>{fullName(person)}</strong>
                      </div>
                      <select
                        aria-label={`Relationship with ${fullName(person)}`}
                        value={link.role}
                        required
                        onChange={(e) => update(index, { role: e.target.value, customLabel: e.target.value === 'Other' ? link.customLabel : '' })}
                      >
                        <option value="" disabled>
                          Select relationship
                        </option>
                        {relationshipOptionGroups.map((optionGroup) => (
                          <optgroup key={optionGroup.label} label={optionGroup.label}>
                            {optionGroup.options.map((option) => (
                              <option key={option} value={option}>
                                {option === 'Other' ? 'Custom…' : option}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {link.role === 'Other' && (
                        <input
                          className="custom-relationship-input"
                          aria-label={`Custom relationship with ${fullName(person)}`}
                          value={link.customLabel}
                          onChange={(e) => update(index, { customLabel: e.target.value })}
                          placeholder="Describe relationship"
                          required
                        />
                      )}
                      <button
                        type="button"
                        className="remove-link-button"
                        onClick={() => onChange(relationships.filter((_, rowIndex) => rowIndex !== index))}
                        aria-label={`Remove relationship with ${fullName(person)}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <label className="link-search relationship-search">
        <Search size={13} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search and add a family relationship" />
      </label>
      {query && (
        <div className="link-search-results">
          {results.map((person) => (
            <button type="button" key={person.id} onClick={() => add(person.id)}>
              {fullName(person)}
            </button>
          ))}
          {!results.length && <span>No matching people</span>}
        </div>
      )}
      {error && (
        <small className="relationship-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

function PersonModal({ modal, people, onClose, onSave }) {
  const p = modal.person;
  const familyLinksRef = useRef(null);
  const [form, setForm] = useState({
    firstName: p?.firstName || modal.defaults?.firstName || '',
    lastName: p?.lastName || modal.defaults?.lastName || '',
    maidenName: p?.maidenName || modal.defaults?.maidenName || '',
    gender: p?.gender || modal.defaults?.gender || 'unspecified',
    birthDate: p?.birthDate?.slice(0, 10) || '',
    deathDate: p?.deathDate?.slice(0, 10) || '',
    birthPlace: p?.birthPlace || '',
    photoUrl: p?.photoUrl || '',
    occupation: p?.occupation || '',
    bio: p?.bio || '',
    notes: p?.notes || '',
  });
  const [relationships, setRelationships] = useState(() => {
    if (!p) return modal.initialRelationships || [];
    const rows = [];
    const add = (personId, role, customLabel = '') => {
      if (personId !== p.id && people.some((person) => person.id === personId) && !rows.some((link) => link.personId === personId)) rows.push({ personId, role, customLabel });
    };
    (p.parentIds || []).forEach((id) => {
      const parent = people.find((person) => person.id === id);
      add(id, parent?.gender === 'male' ? 'Father' : parent?.gender === 'female' ? 'Mother' : 'Parent');
    });
    people.filter((person) => (person.parentIds || []).includes(p.id)).forEach((child) => add(child.id, child.gender === 'male' ? 'Son' : child.gender === 'female' ? 'Daughter' : 'Child'));
    (p.partnerIds || []).forEach((id) => {
      const stored = partnerRelationship(p, id);
      const fallback = defaultPartnerLabel(people.find((person) => person.id === id)?.gender);
      const role = relationshipOptions.includes(stored) ? stored : relationshipOptions.includes(fallback) ? fallback : 'Spouse';
      add(id, stored && !relationshipOptions.includes(stored) ? 'Other' : role, stored && !relationshipOptions.includes(stored) ? stored : '');
    });
    const relatedSiblings = new Set(p.siblingIds || []);
    people.filter((person) => person.id !== p.id && (person.parentIds || []).some((parentId) => (p.parentIds || []).includes(parentId))).forEach((person) => relatedSiblings.add(person.id));
    relatedSiblings.forEach((id) => add(id, 'Sibling'));
    (p.relationshipLinks || []).forEach((link) => add(link.personId, 'Other', link.label));
    return rows;
  });
  useEffect(() => {
    if (!modal.focusLinks) return;
    const frame = requestAnimationFrame(() => familyLinksRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [modal.focusLinks]);
  const change = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  function submit(e) {
    e.preventDefault();
    const byRole = (roles) => relationships.filter((link) => roles.includes(link.role)).map((link) => link.personId);
    const partnerIds = byRole(['Husband', 'Wife', 'Boyfriend', 'Girlfriend', 'Fiancé', 'Fiancée', 'Partner', 'Spouse', 'Former spouse', 'Former partner']);
    const partnerRelationships = relationships.filter((link) => partnerIds.includes(link.personId)).map((link) => ({ partnerId: link.personId, label: link.role }));
    const relationshipLinks = relationships.filter((link) => link.role === 'Other' && link.customLabel.trim()).map((link) => ({ personId: link.personId, label: link.customLabel.trim() }));
    onSave({
      ...form,
      parentIds: byRole(['Father', 'Mother', 'Parent']),
      partnerIds,
      partnerRelationships,
      siblingIds: byRole(['Brother', 'Sister', 'Sibling']),
      relationshipLinks,
      childIds: byRole(['Son', 'Daughter', 'Child']),
      childRelationships: relationships.filter((link) => ['Son', 'Daughter', 'Child'].includes(link.role)).map(({ personId, role }) => ({ personId, role })),
    });
  }
  const title = p ? 'Edit person' : 'Add a person';
  const editor = (
    <form className={modal.inline ? 'inline-person-editor' : 'simple-person-modal'} onSubmit={submit}>
      <header>
        <div>
          <small>FAMILY MEMBER</small>
          <h2>{title}</h2>
        </div>
        <button type="button" className="plain-icon" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="person-form-body">
        <label className="photo-url">
          <Camera size={15} />
          <span>Photo URL</span>
          <input value={form.photoUrl} onChange={(e) => change('photoUrl', e.target.value)} placeholder="https://…" />
        </label>
        <div className="simple-form-grid person-basic-grid">
          <div className="person-form-row two-field-row">
            <label>
              First name *
              <input required value={form.firstName} onChange={(e) => change('firstName', e.target.value)} placeholder="First name" />
            </label>
            <label>
              Last name
              <input value={form.lastName} onChange={(e) => change('lastName', e.target.value)} placeholder="Last name" />
            </label>
          </div>
          <div className="person-form-row one-field-row maiden-name-row">
            <label>
              Maiden name
              <input value={form.maidenName} onChange={(e) => change('maidenName', e.target.value)} placeholder="Birth surname" />
            </label>
          </div>
          <div className="person-form-row three-field-row">
            <label>
              Born
              <input type="date" value={form.birthDate} onChange={(e) => change('birthDate', e.target.value)} />
            </label>
            <label>
              Died
              <input type="date" value={form.deathDate} onChange={(e) => change('deathDate', e.target.value)} />
            </label>
            <label>
              Gender
              <select value={form.gender} onChange={(e) => change('gender', e.target.value)}>
                <option value="unspecified">Not specified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Nonbinary</option>
              </select>
            </label>
          </div>
          <div className="person-form-row two-field-row">
            <label>
              Birthplace
              <input value={form.birthPlace} onChange={(e) => change('birthPlace', e.target.value)} placeholder="City, country" />
            </label>
            <label>
              Occupation
              <input value={form.occupation} onChange={(e) => change('occupation', e.target.value)} placeholder="Occupation" />
            </label>
          </div>
        </div>
        <div className="simple-link-fields" ref={familyLinksRef}>
          <div className="simple-link-field relationship-field">
            <strong>Relationships</strong>
            <p className="relationship-help">Add a person, then choose how they are related.</p>
            <RelationshipEditor people={people} relationships={relationships} onChange={setRelationships} excludeId={p?.id} />
          </div>
        </div>
        <div className="simple-form-grid person-story-grid">
          <label className="wide-form-field">
            About
            <textarea rows="2" value={form.bio} onChange={(e) => change('bio', e.target.value)} placeholder="A little about this person" />
          </label>
          <label className="wide-form-field">
            Family notes
            <textarea rows="2" value={form.notes} onChange={(e) => change('notes', e.target.value)} placeholder="Notes for the family archive" />
          </label>
        </div>
      </div>
      <footer>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="save-person-button">
          {p ? 'Save changes' : 'Add person'}
        </button>
      </footer>
    </form>
  );
  return modal.inline ? (
    editor
  ) : (
    <div
      className="simple-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {editor}
    </div>
  );
}
