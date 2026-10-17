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
  const nodeHeight = 82;
  const partnerGap = 36;
  const siblingGap = 76;
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
      if (parent && child) edges.push({ kind: 'parent', fromId: parentId, toId: person.id, x1: parent.x + parent.w / 2, y1: parent.y + parent.h, x2: child.x + child.w / 2, y2: child.y });
    });
    (person.partnerIds || []).forEach(partnerId => {
      const partner = positions.get(partnerId);
      const current = positions.get(person.id);
      const key = [partnerId, person.id].sort().join(':');
      if (!partner || !current || seenPartners.has(key)) return;
      seenPartners.add(key);
      const left = partner.x < current.x ? partner : current;
      const right = partner.x < current.x ? current : partner;
      edges.push({ kind: 'partner', fromId: person.id, toId: partnerId, x1: left.x + left.w, y1: left.y + left.h / 2, x2: right.x, y2: right.y + right.h / 2 });
    });
  });

  const width = Math.max(800, ...[...positions.values()].map(position => position.x + position.w + 60));
  const height = Math.max(300, ...[...positions.values()].map(position => position.y + position.h + 100));
  return { positions, edges, width, height, originX, originY, generationCount: maxLevel + 1 };
}
