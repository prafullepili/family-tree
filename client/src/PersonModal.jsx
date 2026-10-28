import { useEffect, useRef, useState } from 'react';
import { Camera, Search, X } from 'lucide-react';

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unnamed person';
const initials = (person) => `${person?.firstName?.[0] || ''}${person?.lastName?.[0] || ''}`.toUpperCase() || '?';

const relationshipOptionGroups = [
  { label: 'Parents', options: ['Father', 'Mother', 'Parent'] },
  { label: 'Partners', options: ['Husband', 'Wife', 'Boyfriend', 'Girlfriend', 'Fiancé', 'Partner', 'Spouse'] },
  { label: 'Children', options: ['Son', 'Daughter', 'Child'] },
  { label: 'Siblings', options: ['Brother', 'Sister', 'Sibling'] },
  { label: 'Other relationships', options: ['Other'] },
];
const relationshipOptions = relationshipOptionGroups.flatMap((group) => group.options);

function relationshipCategory(role) {
  return relationshipOptionGroups.find((group) => group.options.includes(role))?.label || 'Uncategorized';
}

function defaultPartnerLabel(gender) {
  return gender === 'male' ? 'Husband' : gender === 'female' ? 'Wife' : 'Spouse';
}

function partnerRelationship(person, partnerId) {
  return (person?.partnerRelationships || []).find((link) => String(link.partnerId) === String(partnerId))?.label || '';
}

function RelationshipEditor({ people, relationships, onChange, excludeId }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const selectedIds = relationships.map((link) => link.personId);
  const groupedRelationships = relationshipOptionGroups
    .map((group) => ({
      ...group,
      links: relationships.map((link, index) => ({ link, index })).filter(({ link }) => relationshipCategory(link.role) === group.label),
    }))
    .concat({
      label: 'Uncategorized',
      options: [],
      links: relationships.map((link, index) => ({ link, index })).filter(({ link }) => relationshipCategory(link.role) === 'Uncategorized'),
    })
    .filter((group) => group.links.length > 0);
  const results = people.filter((person) => person.id !== excludeId && !selectedIds.includes(person.id) && fullName(person).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  function add(id) {
    onChange([...relationships, { personId: id, role: '', customLabel: '' }]);
    setQuery('');
  }

  function update(index, changes) {
    if (changes.role && ['Father', 'Mother', 'Parent'].includes(changes.role)) {
      const parentCount = relationships.filter((link, rowIndex) => rowIndex !== index && ['Father', 'Mother', 'Parent'].includes(link.role)).length;
      if (parentCount >= 2) {
        setError('A person can have at most two parents.');
        return;
      }
    }
    if (changes.role && ['Son', 'Daughter', 'Child'].includes(changes.role)) {
      const relatedPerson = people.find((person) => person.id === relationships[index]?.personId);
      if (relatedPerson && relatedPerson.parentIds?.length >= 2 && !relatedPerson.parentIds.includes(excludeId)) {
        setError('This person already has two parents.');
        return;
      }
    }
    setError('');
    onChange(relationships.map((link, rowIndex) => (rowIndex === index ? { ...link, ...changes } : link)));
  }

  return (
    <div className="relationship-editor">
      {relationships.length > 0 && (
        <div className="relationship-list">
          {groupedRelationships.map((group) => (
            <section className="relationship-group" key={group.label}>
              <h4>
                <span>{group.label}</span>
                <small>{group.links.length}</small>
              </h4>
              <div className="relationship-group-rows">
                {group.links.map(({ link, index }) => {
                  const person = people.find((item) => item.id === link.personId);
                  if (!person) return null;
                  return (
                    <div className="relationship-row" key={`${link.personId}-${index}`}>
                      <div className="relationship-person" title={fullName(person)}>
                        <span className="relationship-person-avatar" aria-hidden="true">{initials(person)}</span>
                        <strong>{fullName(person)}</strong>
                      </div>
                      <select
                        aria-label={`Relationship with ${fullName(person)}`}
                        value={link.role}
                        required
                        onChange={(event) => update(index, { role: event.target.value, customLabel: event.target.value === 'Other' ? link.customLabel : '' })}
                      >
                        <option value="" disabled>Select relationship</option>
                        {relationshipOptionGroups.map((optionGroup) => (
                          <optgroup key={optionGroup.label} label={optionGroup.label}>
                            {optionGroup.options.map((option) => <option key={option} value={option}>{option === 'Other' ? 'Custom…' : option}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      {link.role === 'Other' && (
                        <input
                          className="custom-relationship-input"
                          aria-label={`Custom relationship with ${fullName(person)}`}
                          value={link.customLabel}
                          onChange={(event) => update(index, { customLabel: event.target.value })}
                          placeholder="Describe relationship"
                          required
                        />
                      )}
                      <button
                        type="button"
                        className="remove-link-button"
                        onClick={() => onChange(relationships.filter((_, rowIndex) => rowIndex !== index))}
                        aria-label={`Remove relationship with ${fullName(person)}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <label className="link-search relationship-search">
        <Search size={13} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search and add a family relationship" />
      </label>
      {query && (
        <div className="link-search-results">
          {results.map((person) => <button type="button" key={person.id} onClick={() => add(person.id)}>{fullName(person)}</button>)}
          {!results.length && <span>No matching people</span>}
        </div>
      )}
      {error && <small className="relationship-error" role="alert">{error}</small>}
    </div>
  );
}

export default function PersonModal({ modal, people, onClose, onSave }) {
  const person = modal.person;
  const familyLinksRef = useRef(null);
  const [form, setForm] = useState({
    firstName: person?.firstName || modal.defaults?.firstName || '',
    lastName: person?.lastName || modal.defaults?.lastName || '',
    maidenName: person?.maidenName || modal.defaults?.maidenName || '',
    gender: person?.gender || modal.defaults?.gender || 'unspecified',
    birthDate: person?.birthDate?.slice(0, 10) || '',
    deathDate: person?.deathDate?.slice(0, 10) || '',
    birthPlace: person?.birthPlace || '',
    photoUrl: person?.photoUrl || '',
    occupation: person?.occupation || '',
    bio: person?.bio || '',
    notes: person?.notes || '',
  });
  const [relationships, setRelationships] = useState(() => {
    if (!person) return modal.initialRelationships || [];
    const rows = [];
    const add = (personId, role, customLabel = '') => {
      if (personId !== person.id && people.some((item) => item.id === personId) && !rows.some((link) => link.personId === personId)) rows.push({ personId, role, customLabel });
    };
    (person.parentIds || []).forEach((id) => {
      const parent = people.find((item) => item.id === id);
      add(id, parent?.gender === 'male' ? 'Father' : parent?.gender === 'female' ? 'Mother' : 'Parent');
    });
    people.filter((item) => (item.parentIds || []).includes(person.id)).forEach((child) => add(child.id, child.gender === 'male' ? 'Son' : child.gender === 'female' ? 'Daughter' : 'Child'));
    (person.partnerIds || []).forEach((id) => {
      const stored = partnerRelationship(person, id);
      const fallback = defaultPartnerLabel(people.find((item) => item.id === id)?.gender);
      const role = relationshipOptions.includes(stored) ? stored : relationshipOptions.includes(fallback) ? fallback : 'Spouse';
      add(id, stored && !relationshipOptions.includes(stored) ? 'Other' : role, stored && !relationshipOptions.includes(stored) ? stored : '');
    });
    const relatedSiblings = new Set(person.siblingIds || []);
    people.filter((item) => item.id !== person.id && (item.parentIds || []).some((parentId) => (person.parentIds || []).includes(parentId))).forEach((item) => relatedSiblings.add(item.id));
    relatedSiblings.forEach((id) => add(id, 'Sibling'));
    (person.relationshipLinks || []).forEach((link) => add(link.personId, 'Other', link.label));
    return rows;
  });

  useEffect(() => {
    if (!modal.focusLinks) return;
    const frame = requestAnimationFrame(() => familyLinksRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [modal.focusLinks]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event) {
    event.preventDefault();
    const byRole = (roles) => relationships.filter((link) => roles.includes(link.role)).map((link) => link.personId);
    const partnerIds = byRole(['Husband', 'Wife', 'Boyfriend', 'Girlfriend', 'Fiancé', 'Fiancée', 'Partner', 'Spouse', 'Former spouse', 'Former partner']);
    onSave({
      ...form,
      parentIds: byRole(['Father', 'Mother', 'Parent']),
      partnerIds,
      partnerRelationships: relationships.filter((link) => partnerIds.includes(link.personId)).map((link) => ({ partnerId: link.personId, label: link.role })),
      siblingIds: byRole(['Brother', 'Sister', 'Sibling']),
      relationshipLinks: relationships.filter((link) => link.role === 'Other' && link.customLabel.trim()).map((link) => ({ personId: link.personId, label: link.customLabel.trim() })),
      childIds: byRole(['Son', 'Daughter', 'Child']),
      childRelationships: relationships.filter((link) => ['Son', 'Daughter', 'Child'].includes(link.role)).map(({ personId, role }) => ({ personId, role })),
    });
  }

  const editor = (
    <form className={modal.inline ? 'inline-person-editor' : 'simple-person-modal'} onSubmit={submit}>
      <header>
        <div><small>FAMILY MEMBER</small><h2>{person ? 'Edit person' : 'Add a person'}</h2></div>
        <button type="button" className="plain-icon" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="person-form-body">
        <label className="photo-url"><Camera size={15} /><span>Photo URL</span><input value={form.photoUrl} onChange={(event) => change('photoUrl', event.target.value)} placeholder="https://…" /></label>
        <div className="simple-form-grid person-basic-grid">
          <div className="person-form-row two-field-row">
            <label>First name *<input required value={form.firstName} onChange={(event) => change('firstName', event.target.value)} placeholder="First name" /></label>
            <label>Last name<input value={form.lastName} onChange={(event) => change('lastName', event.target.value)} placeholder="Last name" /></label>
          </div>
          <div className="person-form-row one-field-row maiden-name-row"><label>Maiden name<input value={form.maidenName} onChange={(event) => change('maidenName', event.target.value)} placeholder="Birth surname" /></label></div>
          <div className="person-form-row three-field-row">
            <label>Born<input type="date" value={form.birthDate} onChange={(event) => change('birthDate', event.target.value)} /></label>
            <label>Died<input type="date" value={form.deathDate} onChange={(event) => change('deathDate', event.target.value)} /></label>
            <label>Gender<select value={form.gender} onChange={(event) => change('gender', event.target.value)}><option value="unspecified">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Nonbinary</option></select></label>
          </div>
          <div className="person-form-row two-field-row">
            <label>Birthplace<input value={form.birthPlace} onChange={(event) => change('birthPlace', event.target.value)} placeholder="City, country" /></label>
            <label>Occupation<input value={form.occupation} onChange={(event) => change('occupation', event.target.value)} placeholder="Occupation" /></label>
          </div>
        </div>
        <div className="simple-link-fields" ref={familyLinksRef}>
          <div className="simple-link-field relationship-field">
            <strong>Relationships</strong>
            <p className="relationship-help">Add a person, then choose how they are related.</p>
            <RelationshipEditor people={people} relationships={relationships} onChange={setRelationships} excludeId={person?.id} />
          </div>
        </div>
        <div className="simple-form-grid person-story-grid">
          <label className="wide-form-field">About<textarea rows="2" value={form.bio} onChange={(event) => change('bio', event.target.value)} placeholder="A little about this person" /></label>
          <label className="wide-form-field">Family notes<textarea rows="2" value={form.notes} onChange={(event) => change('notes', event.target.value)} placeholder="Notes for the family archive" /></label>
        </div>
      </div>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="save-person-button">{person ? 'Save changes' : 'Add person'}</button></footer>
    </form>
  );

  if (modal.inline) return editor;
  return <div className="simple-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>{editor}</div>;
}
