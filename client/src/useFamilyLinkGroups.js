import { useMemo } from 'react';
import { partnerDisplayLabel } from './appHelpers.js';

export default function useFamilyLinkGroups(people, selected) {
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
  return { familyLinkGroups };
}

