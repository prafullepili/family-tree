// A stored partner role describes the linked person, not the record containing it.
export function normalizePartnerRole(role, gender) {
  const value = String(role || '').trim();
  if (!value || ['Husband', 'Wife'].includes(value)) return gender === 'male' ? 'Husband' : gender === 'female' ? 'Wife' : 'Spouse';
  if (['Boyfriend', 'Girlfriend'].includes(value)) return gender === 'male' ? 'Boyfriend' : gender === 'female' ? 'Girlfriend' : 'Partner';
  if (['Fiancé', 'Fiancée'].includes(value)) return gender === 'female' ? 'Fiancée' : 'Fiancé';
  return value;
}
