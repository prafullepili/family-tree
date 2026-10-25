// Work in persisted canvas coordinates, independent of zoom or screen size.
export function relationshipPlacement(people, values, prior, positions) {
  const previousChildren = prior ? people.filter((person) => (person.parentIds || []).includes(prior.id)).map((person) => person.id) : [];
  const previousSiblings = prior ? [...(prior.siblingIds || []), ...people.filter((person) => person.id !== prior.id &&
    ((person.siblingIds || []).includes(prior.id) || (person.parentIds || []).some((id) => (prior.parentIds || []).includes(id)))).map((person) => person.id)] : [];
  const groups = [
    { kind: 'child', ids: values.parentIds || [], previous: prior?.parentIds || [] },
    { kind: 'partner', ids: values.partnerIds || [], previous: prior?.partnerIds || [] },
    { kind: 'parent', ids: values.childIds || [], previous: previousChildren },
    { kind: 'sibling', ids: values.siblingIds || [], previous: previousSiblings },
    { kind: 'custom', ids: (values.relationshipLinks || []).map((link) => link.personId), previous: (prior?.relationshipLinks || []).map((link) => link.personId) },
  ];
  const group = groups.find((entry) => entry.ids.some((id) => id !== prior?.id && positions.has(id) && !entry.previous.includes(id)));
  if (!group) return null;
  const anchors = group.ids.filter((id) => id !== prior?.id && positions.has(id)).map((id) => positions.get(id));
  const width = 196;
  const height = 76;
  const step = width + (group.kind === 'partner' ? 184 : 120);
  const vertical = group.kind === 'child' || group.kind === 'parent';
  const x = vertical ? anchors.reduce((sum, anchor) => sum + anchor.rawX, 0) / anchors.length : anchors[0].rawX + step;
  const y = group.kind === 'child' ? Math.max(...anchors.map((anchor) => anchor.rawY)) + 190
    : group.kind === 'parent' ? Math.min(...anchors.map((anchor) => anchor.rawY)) - 190 : anchors[0].rawY;
  const occupied = [...positions.entries()].filter(([id]) => id !== prior?.id).map(([, position]) => position);
  // Search sideways on the correct generation instead of spilling into another row.
  const candidates = [x, ...occupied.flatMap((position) => [position.rawX - step, position.rawX + step])]
    .sort((a, b) => Math.abs(a - x) - Math.abs(b - x) || a - b);
  const treeX = candidates.find((candidate) => occupied.every((position) =>
    candidate + width + 18 <= position.rawX || candidate >= position.rawX + position.w + 18 ||
    y + height + 18 <= position.rawY || y >= position.rawY + position.h + 18));
  return { treeX, treeY: y };
}
