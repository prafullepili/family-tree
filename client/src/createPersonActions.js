import { layoutTree } from './layoutTree.js';
import { relationshipPlacement } from './relationshipPlacement.js';
import { apiUrl } from './apiClient.js';
import { fromApi } from './appHelpers.js';

export default function createPersonActions({
  readOnly,
  notify,
  modal,
  people,
  layout,
  apiState,
  apiFetch,
  refreshPeople,
  setPeople,
  setSelectedId,
  setModal,
  setDetailsOpen,
  setMobileDetailsOpen,
  selected,
  selectedNodeIds,
  deleteDescendants,
  selectedDescendants,
  setSelectedNodeIds,
  setConfirmDelete,
}) {
  async function saveMember(values) {
    if (readOnly) return notify('This tree is read-only.');
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
            const response = await apiFetch(apiUrl('/api/people/layout/positions'), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ positions }),
            });
            if (!response.ok) throw Error('Could not preserve the family positions');
          }
        }
        const r = await apiFetch(apiUrl(prior ? `/api/people/${prior._id}` : '/api/people'), {
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
            const response = await apiFetch(apiUrl(`/api/people/${child._id}`), {
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
    if (readOnly) return notify('This tree is read-only.');
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
        const saved = await apiFetch(apiUrl('/api/people/layout/positions'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions }),
        });
        if (!saved.ok) throw Error('Could not preserve the current tree layout');
        const ids = removedPeople.filter((person) => person._id).map((person) => person._id);
        if (ids.length) {
          const response = await apiFetch(apiUrl('/api/people/batch'), {
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
  return { saveMember, removePerson };
}

