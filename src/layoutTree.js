function connectRectangles(from, to) {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  let dx = toCenter.x - fromCenter.x;
  let dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) dy = 1;
  const fromScaleX = from.w / 2 / Math.max(Math.abs(dx), 0.001);
  const fromScaleY = from.h / 2 / Math.max(Math.abs(dy), 0.001);
  const toScaleX = to.w / 2 / Math.max(Math.abs(dx), 0.001);
  const toScaleY = to.h / 2 / Math.max(Math.abs(dy), 0.001);
  const fromHorizontal = fromScaleX < fromScaleY;
  const toHorizontal = toScaleX < toScaleY;
  const fromScale = Math.min(fromScaleX, fromScaleY);
  const toScale = Math.min(toScaleX, toScaleY);
  const x1 = fromCenter.x + dx * fromScale;
  const y1 = fromCenter.y + dy * fromScale;
  const x2 = toCenter.x - dx * toScale;
  const y2 = toCenter.y - dy * toScale;
  const fromSide = fromHorizontal ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
  const toSide = toHorizontal ? (dx > 0 ? 'left' : 'right') : dy > 0 ? 'top' : 'bottom';
  const normals = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
  const reach = Math.max(24, Math.min(100, Math.hypot(dx, dy) * 0.32));
  const [fromNX, fromNY] = normals[fromSide];
  const [toNX, toNY] = normals[toSide];
  const c1x = x1 + fromNX * reach;
  const c1y = y1 + fromNY * reach;
  const c2x = x2 + toNX * reach;
  const c2y = y2 + toNY * reach;
  const t = 0.5;
  const u = 1 - t;
  const labelX = u ** 3 * x1 + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * x2;
  const labelY = u ** 3 * y1 + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * y2 - 9;
  return { x1, y1, x2, y2, c1x, c1y, c2x, c2y, fromSide, toSide, labelX, labelY };
}

function connectParentChild(parent, child) {
  return connectRectangles(parent, child);
}

const NODE_COLLISION_GAP = 18;

function hasNodeCollision(candidate, placed) {
  return placed.some(
    (other) =>
      candidate.x < other.x + other.w + NODE_COLLISION_GAP &&
      candidate.x + candidate.w + NODE_COLLISION_GAP > other.x &&
      candidate.y < other.y + other.h + NODE_COLLISION_GAP &&
      candidate.y + candidate.h + NODE_COLLISION_GAP > other.y,
  );
}

export function resolveNodeOverlaps(movingPositions, stationaryPositions) {
  const placed = stationaryPositions.map((position) => ({ ...position }));
  return movingPositions.map((position) => {
    const candidate = { ...position };
    if (!hasNodeCollision(candidate, placed)) {
      placed.push(candidate);
      return candidate;
    }

    const step = NODE_COLLISION_GAP;
    let resolved = null;
    for (let radius = 1; radius <= 160 && !resolved; radius += 1) {
      const offsets = [];
      for (let x = -radius; x <= radius; x += 1) {
        for (let y = -radius; y <= radius; y += 1) {
          if (Math.max(Math.abs(x), Math.abs(y)) === radius) offsets.push({ x, y });
        }
      }
      offsets.sort((a, b) => Math.abs(a.y) - Math.abs(b.y) || Math.abs(a.x) - Math.abs(b.x) || b.x - a.x || b.y - a.y);
      for (const offset of offsets) {
        const spot = { ...candidate, x: candidate.x + offset.x * step, y: candidate.y + offset.y * step };
        if (!hasNodeCollision(spot, placed)) {
          resolved = spot;
          break;
        }
      }
    }

    if (!resolved) {
      resolved = { ...candidate, y: candidate.y + (candidate.h + NODE_COLLISION_GAP) * placed.length };
      while (hasNodeCollision(resolved, placed)) resolved.y += resolved.h + NODE_COLLISION_GAP;
    }
    placed.push(resolved);
    return resolved;
  });
}

export function layoutTree(people, { nodeWidth = 196, nodeHeight = 76 } = {}) {
  const representative = new Map(people.map((person) => [person.id, person.id]));
  function find(id) {
    const parent = representative.get(id);
    if (!parent || parent === id) return parent;
    const root = find(parent);
    representative.set(id, root);
    return root;
  }
  function unite(a, b) {
    if (!representative.has(a) || !representative.has(b)) return;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) representative.set(rootB, rootA);
  }
  // A person can have several partners. Treating every partner edge as one
  // connected component puts every partner on one row and makes long links
  // run through unrelated cards. Build primary couple units from shared
  // children first, then pair remaining unclaimed partners where possible.
  const personById = new Map(people.map((person) => [person.id, person]));
  const personOrder = new Map(people.map((person, index) => [person.id, index]));
  const partnerPairs = new Map();
  people.forEach((person) =>
    (person.partnerIds || []).forEach((partnerId) => {
      if (!personById.has(partnerId) || partnerId === person.id) return;
      const ids = [person.id, partnerId].sort((a, b) => personOrder.get(a) - personOrder.get(b));
      const key = ids.join(':');
      if (!partnerPairs.has(key)) {
        const left = personById.get(ids[0]);
        const right = personById.get(ids[1]);
        const leftChildren = new Set(people.filter((child) => (child.parentIds || []).includes(left.id)).map((child) => child.id));
        const sharedChildren = people.filter((child) => leftChildren.has(child.id) && (child.parentIds || []).includes(right.id)).length;
        partnerPairs.set(key, { ids, sharedChildren });
      }
    }),
  );
  const claimedPartners = new Set();
  [...partnerPairs.values()]
    .sort((a, b) => b.sharedChildren - a.sharedChildren || personOrder.get(a.ids[0]) - personOrder.get(b.ids[0]) || personOrder.get(a.ids[1]) - personOrder.get(b.ids[1]))
    .forEach(({ ids: [first, second] }) => {
      if (claimedPartners.has(first) || claimedPartners.has(second)) return;
      unite(first, second);
      claimedPartners.add(first);
      claimedPartners.add(second);
    });

  const components = new Map();
  const componentOf = new Map();
  people.forEach((person) => {
    const id = find(person.id);
    if (!components.has(id)) components.set(id, { id, members: [] });
    components.get(id).members.push(person);
    componentOf.set(person.id, id);
  });
  const componentParents = new Map();
  const componentPartners = new Map([...components.keys()].map((id) => [id, new Set()]));
  people.forEach((person) =>
    (person.partnerIds || []).forEach((partnerId) => {
      const from = componentOf.get(person.id);
      const to = componentOf.get(partnerId);
      if (from && to && from !== to) {
        componentPartners.get(from).add(to);
        componentPartners.get(to).add(from);
      }
    }),
  );
  components.forEach((component) => {
    const parents = new Set();
    component.members.forEach((person) =>
      (person.parentIds || []).forEach((parentId) => {
        const parentComponent = componentOf.get(parentId);
        if (parentComponent && parentComponent !== component.id) parents.add(parentComponent);
      }),
    );
    componentParents.set(component.id, [...parents]);
  });

  const levels = new Map();
  function getLevel(id, path = new Set()) {
    if (levels.has(id)) return levels.get(id);
    if (path.has(id)) return 0;
    const nextPath = new Set(path).add(id);
    const parents = componentParents.get(id) || [];
    const level = parents.length ? Math.max(...parents.map((parentId) => getLevel(parentId, nextPath))) + 1 : 0;
    levels.set(id, level);
    return level;
  }
  components.forEach((component) => getLevel(component.id));

  // Partner groups without parent links (for example a second partner and
  // their spouse) belong beside the generation they connect to, not at the
  // top of the entire canvas. Keep their separate couple units, while giving
  // every unit in the connected partner network the deepest family level.
  const visitedPartnerComponents = new Set();
  components.forEach((component) => {
    if (visitedPartnerComponents.has(component.id)) return;
    const network = [];
    const pending = [component.id];
    let networkLevel = 0;
    while (pending.length) {
      const id = pending.pop();
      if (visitedPartnerComponents.has(id)) continue;
      visitedPartnerComponents.add(id);
      network.push(id);
      networkLevel = Math.max(networkLevel, levels.get(id) || 0);
      (componentPartners.get(id) || []).forEach((partnerId) => {
        if (!visitedPartnerComponents.has(partnerId)) pending.push(partnerId);
      });
    }
    network.forEach((id) => levels.set(id, networkLevel));
  });

  const rows = new Map();
  components.forEach((component) => {
    const level = levels.get(component.id) || 0;
    rows.set(level, [...(rows.get(level) || []), component]);
  });

  // Leave room for the fixed relationship labels at both ends of partner links.
  const partnerGap = 184;
  const siblingGap = 120;
  const familyGap = 56;
  const generationGap = 190;
  const canonical = new Map();
  const maxLevel = Math.max(0, ...levels.values());

  for (let level = 0; level <= maxLevel; level++) {
    const groupsByParents = new Map();
    (rows.get(level) || []).forEach((component) => {
      const parents = componentParents.get(component.id) || [];
      const key = parents.length ? [...parents].sort().join('|') : `root:${component.id}`;
      if (!groupsByParents.has(key)) groupsByParents.set(key, { parents, components: [] });
      groupsByParents.get(key).components.push(component);
    });

    const groups = [...groupsByParents.values()]
      .map((group) => {
        const anchors = group.parents.map((parentId) => canonical.get(parentId)?.center).filter(Number.isFinite);
        if (!anchors.length) {
          group.components.forEach((component) => {
            (componentPartners.get(component.id) || []).forEach((partnerId) => {
              const partnerAnchor = canonical.get(partnerId)?.center;
              if (Number.isFinite(partnerAnchor)) anchors.push(partnerAnchor);
              else
                (componentParents.get(partnerId) || []).forEach((parentId) => {
                  const parentAnchor = canonical.get(parentId)?.center;
                  if (Number.isFinite(parentAnchor)) anchors.push(parentAnchor);
                });
            });
          });
        }
        const anchor = anchors.length ? anchors.reduce((sum, x) => sum + x, 0) / anchors.length : null;
        const widths = group.components.map((component) => component.members.length * nodeWidth + Math.max(0, component.members.length - 1) * partnerGap);
        const width = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, widths.length - 1) * siblingGap;
        return { ...group, anchor, widths, width };
      })
      .sort((a, b) => {
        if (a.anchor === null && b.anchor !== null) return -1;
        if (a.anchor !== null && b.anchor === null) return 1;
        return (a.anchor ?? 0) - (b.anchor ?? 0);
      });

    let cursor = 0;
    const placedGroups = [];
    groups.forEach((group) => {
      const desiredLeft = group.anchor === null ? cursor : group.anchor - group.width / 2;
      let left = desiredLeft;
      const hasSpace = (candidate) => placedGroups.every((placed) => candidate + group.width + familyGap <= placed.left || candidate >= placed.right + familyGap);
      if (group.anchor === null) {
        while (!hasSpace(left)) left += group.width + familyGap;
      } else if (!hasSpace(left)) {
        const step = group.width + familyGap;
        for (let distance = 1; distance <= placedGroups.length + groups.length + 2; distance++) {
          const leftCandidate = desiredLeft - step * distance;
          const rightCandidate = desiredLeft + step * distance;
          if (hasSpace(leftCandidate)) {
            left = leftCandidate;
            break;
          }
          if (hasSpace(rightCandidate)) {
            left = rightCandidate;
            break;
          }
        }
        while (!hasSpace(left)) left -= step;
      }
      placedGroups.push({ left, right: left + group.width });
      let x = left;
      group.components.forEach((component, index) => {
        const width = group.widths[index];
        canonical.set(component.id, { x, y: level * generationGap, width, center: x + width / 2 });
        x += width + siblingGap;
      });
      cursor = left + group.width + familyGap;
    });
  }

  const positions = new Map();
  people.forEach((person) => {
    const component = components.get(componentOf.get(person.id));
    const automatic = canonical.get(component.id);
    const memberIndex = component.members.indexOf(person);
    const level = levels.get(component.id) || 0;
    const automaticX = automatic.x + memberIndex * (nodeWidth + partnerGap);
    const hasNoParents = !(componentParents.get(component.id) || []).length;
    const hasPartnerInFamily = [...(componentPartners.get(component.id) || [])].some((partnerId) => (componentParents.get(partnerId) || []).length > 0);
    const partnerBranchOffset = hasNoParents && hasPartnerInFamily ? -Math.round(generationGap * 0.65) : 0;
    const automaticY = level * generationGap + partnerBranchOffset;
    const rawX = Number.isFinite(person.treeX) ? person.treeX : automaticX;
    const rawY = Number.isFinite(person.treeY) ? person.treeY : automaticY;
    positions.set(person.id, { x: rawX, y: rawY, rawX, rawY, automaticX, automaticY, w: nodeWidth, h: nodeHeight, person });
  });

  const collisionSafe = resolveNodeOverlaps(
    [...positions.values()].sort((a, b) => a.rawY - b.rawY || a.rawX - b.rawX || a.person.id.localeCompare(b.person.id)).map((position) => ({ ...position, x: position.rawX, y: position.rawY })),
    [],
  );
  collisionSafe.forEach((position) => {
    const original = positions.get(position.person.id);
    original.rawX = position.x;
    original.rawY = position.y;
  });

  // Keep the canvas origin based on the automatic layout. Including manually
  // moved nodes here cancels their movement whenever they cross x/y = 0.
  const minX = Math.min(0, ...[...positions.values()].map((position) => position.automaticX));
  const minY = Math.min(0, ...[...positions.values()].map((position) => position.automaticY));
  const originX = 60 - minX;
  const originY = 56 - minY;
  positions.forEach((position) => {
    position.x = position.rawX + originX;
    position.y = position.rawY + originY;
  });

  const edges = [];
  const seenPartners = new Set();
  const partnerRouteLanes = new Map();
  people.forEach((person) => {
    (person.parentIds || []).forEach((parentId) => {
      const parent = positions.get(parentId);
      const child = positions.get(person.id);
      if (parent && child) edges.push({ kind: 'parent', fromId: parentId, toId: person.id, ...connectParentChild(parent, child) });
    });
    (person.partnerIds || []).forEach((partnerId) => {
      const partner = positions.get(partnerId);
      const current = positions.get(person.id);
      const key = [partnerId, person.id].sort().join(':');
      if (!partner || !current || seenPartners.has(key)) return;
      seenPartners.add(key);
      const from = partner.x + partner.w / 2 < current.x + current.w / 2 ? partner : current;
      const to = from === current ? partner : current;
      const left = Math.min(from.x + from.w / 2, to.x + to.w / 2);
      const right = Math.max(from.x + from.w / 2, to.x + to.w / 2);
      const row = Math.round((from.y + to.y) / 2);
      const blockers = [...positions.values()].some(
        (position) =>
          position.person.id !== from.person.id &&
          position.person.id !== to.person.id &&
          Math.abs(position.y - from.y) < nodeHeight / 2 &&
          position.x + position.w / 2 > left &&
          position.x + position.w / 2 < right,
      );
      let connection = connectRectangles(from, to);
      if (blockers && Math.abs(from.y - to.y) < nodeHeight / 2) {
        const lanes = partnerRouteLanes.get(row) || [];
        const interval = [left, right];
        let lane = lanes.findIndex((existing) => existing.every(([start, end]) => right + 24 <= start || left >= end + 24));
        if (lane < 0) lane = lanes.length;
        if (!lanes[lane]) lanes[lane] = [];
        lanes[lane].push(interval);
        partnerRouteLanes.set(row, lanes);
        const x1 = from.x + from.w / 2;
        const y1 = from.y;
        const x2 = to.x + to.w / 2;
        const y2 = to.y;
        const laneY = Math.min(y1, y2) - 26 - lane * 22;
        connection = {
          ...connection,
          x1,
          y1,
          x2,
          y2,
          c1x: x1,
          c1y: laneY,
          c2x: x2,
          c2y: laneY,
          labelX: (x1 + x2) / 2,
          labelY: laneY - 8,
          path: `M${x1} ${y1} C${x1} ${laneY} ${x2} ${laneY} ${x2} ${y2}`,
        };
      }
      edges.push({ kind: 'partner', fromId: from === current ? person.id : partnerId, toId: from === current ? partnerId : person.id, ...connection });
    });
  });

  const siblingGroups = new Map();
  const siblingEdgeKeys = new Set();
  const inferredSiblingPairs = new Set();
  const addSiblingEdge = (firstId, secondId) => {
    if (!positions.has(firstId) || !positions.has(secondId) || firstId === secondId) return;
    const key = [firstId, secondId].sort().join(':');
    if (siblingEdgeKeys.has(key)) return;
    siblingEdgeKeys.add(key);
    const first = positions.get(firstId);
    const second = positions.get(secondId);
    edges.push({ kind: 'sibling', fromId: firstId, toId: secondId, ...connectRectangles(first, second) });
  };
  people.forEach((person) => {
    const parentKey = [...(person.parentIds || [])]
      .filter((id) => positions.has(id))
      .sort()
      .join('|');
    if (!parentKey) return;
    if (!siblingGroups.has(parentKey)) siblingGroups.set(parentKey, []);
    siblingGroups.get(parentKey).push(person);
  });
  siblingGroups.forEach((siblings) => {
    const ordered = siblings.sort((a, b) => positions.get(a.id).x - positions.get(b.id).x);
    for (let first = 0; first < ordered.length; first++) {
      for (let second = first + 1; second < ordered.length; second++) {
        inferredSiblingPairs.add([ordered[first].id, ordered[second].id].sort().join(':'));
      }
    }
    for (let index = 0; index < ordered.length - 1; index++) {
      addSiblingEdge(ordered[index].id, ordered[index + 1].id);
    }
  });
  people.forEach((person) =>
    (person.siblingIds || []).forEach((siblingId) => {
      const key = [person.id, siblingId].sort().join(':');
      if (!inferredSiblingPairs.has(key)) addSiblingEdge(person.id, siblingId);
    }),
  );

  const customEdgeKeys = new Set();
  people.forEach((person) =>
    (person.relationshipLinks || []).forEach((link) => {
      const personId = link.personId?.id || link.personId;
      if (!positions.has(person.id) || !positions.has(personId)) return;
      const key = [person.id, personId].sort().join(':');
      if (customEdgeKeys.has(key) || edges.some((edge) => [edge.fromId, edge.toId].sort().join(':') === key)) return;
      customEdgeKeys.add(key);
      edges.push({ kind: 'custom', fromId: person.id, toId: personId, label: link.label || 'Related', ...connectRectangles(positions.get(person.id), positions.get(personId)) });
    }),
  );

  const childrenByParents = new Map();
  people.forEach((person) => {
    const parentIds = [...(person.parentIds || [])].filter((id) => positions.has(id)).sort();
    if (!parentIds.length) return;
    const key = parentIds.join('|');
    if (!childrenByParents.has(key)) childrenByParents.set(key, { parentIds, children: [] });
    childrenByParents.get(key).children.push(person);
  });
  const familyBranches = [...childrenByParents.values()].map(({ parentIds, children }) => {
    const parents = parentIds.map((id) => positions.get(id));
    const orderedChildren = children.map((person) => positions.get(person.id)).sort((a, b) => a.x - b.x);
    const partnerEdge = edges.find((edge) => edge.kind === 'partner' && parentIds.includes(edge.fromId) && parentIds.includes(edge.toId));
    const sourceX = partnerEdge ? (partnerEdge.x1 + partnerEdge.x2) / 2 : parents.reduce((sum, parent) => sum + parent.x + parent.w / 2, 0) / parents.length;
    const sourceY = partnerEdge ? (partnerEdge.y1 + partnerEdge.y2) / 2 : parents.length > 1 ? parents.reduce((sum, parent) => sum + parent.y + parent.h / 2, 0) / parents.length : parents[0].y + nodeHeight;
    const childTop = Math.min(...orderedChildren.map((child) => child.y));
    const childrenAreAbove = orderedChildren.every((child) => child.y + child.h <= sourceY);
    return {
      parentIds,
      children: children
        .slice()
        .sort((a, b) => positions.get(a.id).x - positions.get(b.id).x)
        .map((person) => person.id),
      sourceX,
      sourceY,
      sourceTopY: Math.min(...parents.map((parent) => parent.y)),
      sourceBottomY: Math.max(...parents.map((parent) => parent.y + parent.h)),
      // Keep the child bus comfortably clear of the partner connector and its label.
      branchY: childrenAreAbove ? Math.max(...orderedChildren.map((child) => child.y + child.h)) + 24 : Math.min(childTop - 24, sourceY + 60),
      childXs: orderedChildren.map((child) => child.x + child.w / 2),
      childTops: orderedChildren.map((child) => child.y),
      childBottoms: orderedChildren.map((child) => child.y + child.h),
    };
  });

  const width = Math.max(800, ...[...positions.values()].map((position) => position.x + position.w + 60));
  const height = Math.max(300, ...[...positions.values()].map((position) => position.y + position.h + 100));
  return { positions, edges, familyBranches, width, height, originX, originY, generationCount: maxLevel + 1 };
}
