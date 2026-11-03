import { useMemo } from 'react';
import { fullName } from './appHelpers.js';

export default function useFamilyMemberSearch(familyPeople, query, memberFamilyFilter) {
  const memberFamilyOptions = useMemo(() => {
    const groups = new Map();
    familyPeople.forEach((person) => {
      const surname = person.lastName?.trim();
      const key = surname?.toLocaleLowerCase() || '__other__';
      if (!groups.has(key)) groups.set(key, { key, name: surname ? `${surname} family` : 'Other family members', count: 0 });
      groups.get(key).count += 1;
    });
    return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [familyPeople]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return familyPeople.filter((person) => {
      const surnameKey = person.lastName?.trim().toLocaleLowerCase() || '__other__';
      const matchesGroup = memberFamilyFilter === '__all__' || surnameKey === memberFamilyFilter;
      const matchesName = !normalizedQuery || fullName(person).toLocaleLowerCase().includes(normalizedQuery);
      return matchesGroup && matchesName;
    });
  }, [query, familyPeople, memberFamilyFilter]);
  const sidebarMemberGroups = useMemo(() => {
    const groups = new Map();
    filtered.forEach((person) => {
      const surname = person.lastName?.trim();
      const key = surname?.toLocaleLowerCase() || '__other__';
      if (!groups.has(key)) groups.set(key, { name: surname ? `${surname} family` : 'Other family members', people: [] });
      groups.get(key).people.push(person);
    });
    return [...groups.values()]
      .map((group) => ({ ...group, people: [...group.people].sort((a, b) => fullName(a).localeCompare(fullName(b))) }))
      .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
  }, [filtered]);
  return { memberFamilyOptions, filtered, sidebarMemberGroups };
}

