import { useMemo } from 'react';
import { familyColorMap } from './appHelpers.js';

export default function useTreeHighlights(treePeople, highlightedNodeId, selectedId) {
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
  return { activeLinkNodeId, highlightedAncestorIds, highlightedNetworkIds, familyColors };
}

