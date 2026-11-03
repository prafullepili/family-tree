export default function createPersonNavigation({
  setSelectedId,
  setSelectedNodeIds,
  readOnly,
  notify,
  setModal,
  setDetailsOpen,
  setSidebarOpen,
  setMobileDetailsOpen,
  people,
  setQuickAddForId,
  selected,
  setHighlightedNodeId,
}) {
  function selectPerson(personId) {
    setSelectedId(personId);
    setSelectedNodeIds([]);
  }
  function openAddPersonForm() {
    if (readOnly) return notify('This tree is read-only.');
    setModal({ inline: true });
    setDetailsOpen(true);
    if (window.innerWidth <= 1050) {
      setSidebarOpen(false);
      setMobileDetailsOpen(true);
    }
  }
  function openQuickAdd(person, kind) {
    if (readOnly) return notify('This tree is read-only.');
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
    if (readOnly) return;
    openPersonDetails(person.id);
    setModal({ person, inline: true });
  }
  function openLinkEditor() {
    if (readOnly) return;
    if (selected) setModal({ person: selected, inline: true, focusLinks: true });
  }
  function clearSelection() {
    setSelectedId('');
    setSelectedNodeIds([]);
    setHighlightedNodeId('');
    setDetailsOpen(false);
    setMobileDetailsOpen(false);
  }
  return { selectPerson, openAddPersonForm, openQuickAdd, openPersonDetails, openPersonEditor, openLinkEditor, clearSelection };
}

