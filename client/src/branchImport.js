export function familyBranchPeople(people, sourceAnchorId) {
  const byId = new Map(people.map((person) => [String(person.sourceId), person]));
  const connected = new Map([...byId.keys()].map((id) => [id, new Set()]));
  const join = (left, right) => {
    left = String(left || '');
    right = String(right || '');
    if (connected.has(left) && connected.has(right)) {
      connected.get(left).add(right);
      connected.get(right).add(left);
    }
  };
  people.forEach((person) => {
    (person.parentIds || []).forEach((id) => join(person.sourceId, id));
    (person.partnerIds || []).forEach((id) => join(person.sourceId, id));
    (person.siblingIds || []).forEach((id) => join(person.sourceId, id));
    (person.relationshipLinks || []).forEach((link) => join(person.sourceId, link.personId));
  });
  const anchorId = String(sourceAnchorId || '');
  if (!byId.has(anchorId)) return [];
  const included = new Set([anchorId]);
  const pending = [anchorId];
  while (pending.length) {
    const id = pending.pop();
    [...(connected.get(id) || [])].forEach((nextId) => {
      const key = String(nextId);
      if (byId.has(key) && !included.has(key)) {
        included.add(key);
        pending.push(key);
      }
    });
  }
  return people.filter((person) => included.has(String(person.sourceId)));
}

export function prepareBranchImport(people, sourceAnchorId, targetId, suffix = Date.now()) {
  const branchPeople = familyBranchPeople(people, sourceAnchorId);
  const ids = branchPeople.map((person) => String(person.sourceId));
  const sourceIds = new Set(ids);
  if (sourceIds.size !== ids.length) throw Error('This file repeats a person ID. Export it again with unique IDs before connecting the branch.');
  const sourceAnchor = String(sourceAnchorId || '');
  if (!sourceIds.has(sourceAnchor)) throw Error('Choose a person from the imported branch.');
  const target = String(targetId || '');
  if (!target) throw Error('Choose the matching person in your tree.');
  if (branchPeople.length > 5000) throw Error('A family branch can contain up to 5,000 people. Select a closer relative to import a smaller branch.');
  const sourceToImportId = new Map([...sourceIds].map((id, index) => [id, id === sourceAnchor ? target : `merge-${suffix}-${index}`]));
  const remap = (id) => sourceToImportId.get(String(id || '')) || null;
  const root = branchPeople.find((person) => String(person.sourceId) === sourceAnchor);
  const mapList = (ids) => [...new Set((ids || []).map(remap).filter(Boolean))];
  const mapPartnerRelationships = (links) => (links || []).map((link) => ({ partnerId: remap(link.partnerId), label: link.label || '' })).filter((link) => link.partnerId);
  const mapRelationshipLinks = (links) => (links || []).map((link) => ({ personId: remap(link.personId), label: link.label || '' })).filter((link) => link.personId && link.label);
  const rows = branchPeople.filter((person) => String(person.sourceId) !== sourceAnchor).map((person) => ({
    ...person,
    sourceId: remap(person.sourceId),
    photoUrl: person.photoUrl?.startsWith('/api/photos/') ? '' : person.photoUrl,
    parentIds: mapList(person.parentIds).slice(0, 2),
    partnerIds: mapList(person.partnerIds),
    siblingIds: mapList(person.siblingIds),
    partnerRelationships: mapPartnerRelationships(person.partnerRelationships),
    relationshipLinks: mapRelationshipLinks(person.relationshipLinks),
    treeX: null,
    treeY: null,
  }));
  return {
    people: rows,
    sourceToImportId: Object.fromEntries(sourceToImportId),
    anchorRelationships: {
      parentIds: mapList(root.parentIds).slice(0, 2),
      partnerIds: mapList(root.partnerIds),
      siblingIds: mapList(root.siblingIds),
      partnerRelationships: mapPartnerRelationships(root.partnerRelationships),
      relationshipLinks: mapRelationshipLinks(root.relationshipLinks),
    },
  };
}
