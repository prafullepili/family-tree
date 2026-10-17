function connectRectangles(from, to) {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  let dx = toCenter.x - fromCenter.x;
  let dy = toCenter.y - fromCenter.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) dy = 1;
  const fromScaleX = (from.w / 2) / Math.max(Math.abs(dx), 0.001);
  const fromScaleY = (from.h / 2) / Math.max(Math.abs(dy), 0.001);
  const toScaleX = (to.w / 2) / Math.max(Math.abs(dx), 0.001);
  const toScaleY = (to.h / 2) / Math.max(Math.abs(dy), 0.001);
  const fromHorizontal = fromScaleX < fromScaleY;
  const toHorizontal = toScaleX < toScaleY;
  const fromScale = Math.min(fromScaleX, fromScaleY);
  const toScale = Math.min(toScaleX, toScaleY);
  const x1 = fromCenter.x + dx * fromScale;
  const y1 = fromCenter.y + dy * fromScale;
  const x2 = toCenter.x - dx * toScale;
  const y2 = toCenter.y - dy * toScale;
  const fromSide = fromHorizontal ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  const toSide = toHorizontal ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom');
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

export function layoutTree(people) {
  const representative = new Map(people.map(person => [person.id, person.id]));
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
  people.forEach(person => (person.partnerIds || []).forEach(partnerId => unite(person.id, partnerId)));

  const components = new Map();
  const componentOf = new Map();
  people.forEach(person => {
    const id = find(person.id);
    if (!components.has(id)) components.set(id, { id, members: [] });
    components.get(id).members.push(person);
    componentOf.set(person.id, id);
  });
  const componentParents = new Map();
  components.forEach(component => {
    const parents = new Set();
    component.members.forEach(person => (person.parentIds || []).forEach(parentId => {
      const parentComponent = componentOf.get(parentId);
      if (parentComponent && parentComponent !== component.id) parents.add(parentComponent);
    }));
    componentParents.set(component.id, [...parents]);
  });

  const levels = new Map();
  function getLevel(id, path = new Set()) {
    if (levels.has(id)) return levels.get(id);
    if (path.has(id)) return 0;
    const nextPath = new Set(path).add(id);
    const parents = componentParents.get(id) || [];
    const level = parents.length ? Math.max(...parents.map(parentId => getLevel(parentId, nextPath))) + 1 : 0;
    levels.set(id, level);
    return level;
  }
  components.forEach(component => getLevel(component.id));

  const rows = new Map();
  components.forEach(component => {
    const level = levels.get(component.id) || 0;
    rows.set(level, [...(rows.get(level) || []), component]);
  });

  const nodeWidth = 196;
  const nodeHeight = 76;
  // Leave room for the fixed relationship labels at both ends of partner links.
  const partnerGap = 184;
  const siblingGap = 120;
  const familyGap = 56;
  const generationGap = 190;
  const canonical = new Map();
  const maxLevel = Math.max(0, ...levels.values());

  for (let level = 0; level <= maxLevel; level++) {
    const groupsByParents = new Map();
    (rows.get(level) || []).forEach(component => {
      const parents = componentParents.get(component.id) || [];
      const key = parents.length ? [...parents].sort().join('|') : `root:${component.id}`;
      if (!groupsByParents.has(key)) groupsByParents.set(key, { parents, components: [] });
      groupsByParents.get(key).components.push(component);
    });

    const groups = [...groupsByParents.values()].map(group => {
      const anchors = group.parents.map(parentId => canonical.get(parentId)?.center).filter(Number.isFinite);
      const anchor = anchors.length ? anchors.reduce((sum, x) => sum + x, 0) / anchors.length : null;
      const widths = group.components.map(component => component.members.length * nodeWidth + Math.max(0, component.members.length - 1) * partnerGap);
      const width = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, widths.length - 1) * siblingGap;
      return { ...group, anchor, widths, width };
    }).sort((a, b) => {
      if (a.anchor === null && b.anchor !== null) return -1;
      if (a.anchor !== null && b.anchor === null) return 1;
      return (a.anchor ?? 0) - (b.anchor ?? 0);
    });

    let cursor = 0;
    groups.forEach(group => {
      const desiredLeft = group.anchor === null ? cursor : group.anchor - group.width / 2;
      const left = Math.max(cursor, desiredLeft);
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
  people.forEach(person => {
    const component = components.get(componentOf.get(person.id));
    const automatic = canonical.get(component.id);
    const memberIndex = component.members.indexOf(person);
    const level = levels.get(component.id) || 0;
    const automaticX = automatic.x + memberIndex * (nodeWidth + partnerGap);
    const automaticY = level * generationGap;
    const rawX = Number.isFinite(person.treeX) ? person.treeX : automaticX;
    const rawY = Number.isFinite(person.treeY) ? person.treeY : automaticY;
    positions.set(person.id, { x: rawX, y: rawY, rawX, rawY, w: nodeWidth, h: nodeHeight, person });
  });

  const minX = Math.min(0, ...[...positions.values()].map(position => position.rawX));
  const minY = Math.min(0, ...[...positions.values()].map(position => position.rawY));
  const originX = 60 - minX;
  const originY = 56 - minY;
  positions.forEach(position => {
    position.x = position.rawX + originX;
    position.y = position.rawY + originY;
  });

  const edges = [];
  const seenPartners = new Set();
  people.forEach(person => {
    (person.parentIds || []).forEach(parentId => {
      const parent = positions.get(parentId);
      const child = positions.get(person.id);
      if (parent && child) edges.push({ kind: 'parent', fromId: parentId, toId: person.id, ...connectRectangles(parent, child) });
    });
    (person.partnerIds || []).forEach(partnerId => {
      const partner = positions.get(partnerId);
      const current = positions.get(person.id);
      const key = [partnerId, person.id].sort().join(':');
      if (!partner || !current || seenPartners.has(key)) return;
      seenPartners.add(key);
      const from = partner.x + partner.w / 2 < current.x + current.w / 2 ? partner : current;
      const to = from === current ? partner : current;
      edges.push({ kind: 'partner', fromId: from === current ? person.id : partnerId, toId: from === current ? partnerId : person.id, ...connectRectangles(from, to) });
    });
  });

  const siblingGroups = new Map();
  people.forEach(person => {
    const parentKey = [...(person.parentIds || [])].filter(id => positions.has(id)).sort().join('|');
    if (!parentKey) return;
    if (!siblingGroups.has(parentKey)) siblingGroups.set(parentKey, []);
    siblingGroups.get(parentKey).push(person);
  });
  siblingGroups.forEach(siblings => {
    const ordered = siblings.sort((a, b) => positions.get(a.id).x - positions.get(b.id).x);
    for (let index = 0; index < ordered.length - 1; index++) {
      const left = positions.get(ordered[index].id);
      const right = positions.get(ordered[index + 1].id);
      edges.push({ kind: 'sibling', fromId: ordered[index].id, toId: ordered[index + 1].id, ...connectRectangles(left, right) });
    }
  });

  const childrenByParents = new Map();
  people.forEach(person => {
    const parentIds = [...(person.parentIds || [])].filter(id => positions.has(id)).sort();
    if (!parentIds.length) return;
    const key = parentIds.join('|');
    if (!childrenByParents.has(key)) childrenByParents.set(key, { parentIds, children: [] });
    childrenByParents.get(key).children.push(person);
  });
  const familyBranches = [...childrenByParents.values()].map(({ parentIds, children }) => {
    const parents = parentIds.map(id => positions.get(id));
    const orderedChildren = children.map(person => positions.get(person.id)).sort((a, b) => a.x - b.x);
    const partnerEdge = edges.find(edge => edge.kind === 'partner' && parentIds.includes(edge.fromId) && parentIds.includes(edge.toId));
    const sourceX = partnerEdge
      ? (partnerEdge.x1 + partnerEdge.x2) / 2
      : parents.reduce((sum, parent) => sum + parent.x + parent.w / 2, 0) / parents.length;
    const sourceY = partnerEdge
      ? (partnerEdge.y1 + partnerEdge.y2) / 2
      : parents.length > 1
        ? parents.reduce((sum, parent) => sum + parent.y + parent.h / 2, 0) / parents.length
        : parents[0].y + 76;
    const childTop = Math.min(...orderedChildren.map(child => child.y));
    return {
      parentIds,
      children: children.slice().sort((a, b) => positions.get(a.id).x - positions.get(b.id).x).map(person => person.id),
      sourceX,
      sourceY,
      branchY: Math.min(childTop - 24, sourceY + 44),
      childXs: orderedChildren.map(child => child.x + child.w / 2),
      childTops: orderedChildren.map(child => child.y)
    };
  });

  const width = Math.max(800, ...[...positions.values()].map(position => position.x + position.w + 60));
  const height = Math.max(300, ...[...positions.values()].map(position => position.y + position.h + 100));
  return { positions, edges, familyBranches, width, height, originX, originY, generationCount: maxLevel + 1 };
}
