export function familyGroupBounds(layout) {
  const groups = new Map();
  const add = (ids, primaryIds) => {
    const members = [...new Set(ids)].filter((id) => layout.positions.has(id)).sort();
    if (members.length < 2) return;
    groups.set(members.join('|'), { members, primaryIds: primaryIds.filter((id) => layout.positions.has(id)) });
  };
  const parentsWithChildren = new Set();
  for (const branch of layout.familyBranches || []) {
    add([...branch.parentIds, ...branch.children], branch.parentIds);
    branch.parentIds.forEach((id) => parentsWithChildren.add(id));
  }
  for (const edge of layout.edges || []) {
    if (edge.kind === 'partner' && !(parentsWithChildren.has(edge.fromId) && parentsWithChildren.has(edge.toId))) add([edge.fromId, edge.toId], [edge.fromId, edge.toId]);
  }
  return [...groups].map(([key, { members, primaryIds }]) => {
    const nodes = members.map((id) => layout.positions.get(id));
    const x = Math.min(...nodes.map((node) => node.x)) - 14;
    const y = Math.min(...nodes.map((node) => node.y)) - 14;
    return { key, primaryIds, x, y, width: Math.max(...nodes.map((node) => node.x + node.w)) + 14 - x,
      height: Math.max(...nodes.map((node) => node.y + node.h)) + 34 - y };
  }).sort((a, b) => b.width * b.height - a.width * a.height);
}
