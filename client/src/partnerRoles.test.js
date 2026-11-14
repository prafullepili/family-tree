import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePartnerRole } from '../../shared/partnerRoles.js';
import { partnerDisplayLabel } from './appHelpers.js';
import createPersonActions from './createPersonActions.js';
import { layoutTree } from './layoutTree.js';

test('legacy copied spouse labels describe the linked person rather than the person being edited', () => {
  const chandru = { id: 'chandru', gender: 'male' };
  const sayama = { id: 'sayama', gender: 'female', partnerRelationships: [{ partnerId: 'chandru', label: 'Wife' }] };
  assert.equal(partnerDisplayLabel(sayama, chandru), 'Husband');
  assert.equal(partnerDisplayLabel(chandru, sayama), 'Wife');
  assert.equal(partnerDisplayLabel({ gender: 'male' }, chandru), 'Husband');
  assert.equal(normalizePartnerRole('Wife', 'unspecified'), 'Spouse');
});

test('neutral and custom partner labels are preserved, and gendered partner families normalize consistently', () => {
  assert.equal(normalizePartnerRole('Spouse', 'male'), 'Spouse');
  assert.equal(normalizePartnerRole('Partner', 'female'), 'Partner');
  assert.equal(normalizePartnerRole('Life partner', 'female'), 'Life partner');
  assert.equal(normalizePartnerRole('Girlfriend', 'male'), 'Boyfriend');
  assert.equal(normalizePartnerRole('Fiancé', 'female'), 'Fiancée');
});

test('local saves store Husband on the wife record and Wife on the husband record', async () => {
  const chandru = { id: 'chandru', firstName: 'Chandru', gender: 'male', treeX: 0, treeY: 0, partnerIds: ['sayama'], partnerRelationships: [{ partnerId: 'sayama', label: 'Wife' }] };
  const sayama = { id: 'sayama', firstName: 'Sayama', gender: 'female', treeX: 450, treeY: 0, partnerIds: ['chandru'], partnerRelationships: [{ partnerId: 'chandru', label: 'Wife' }] };
  let rows;
  const noop = () => {};
  const actions = createPersonActions({ readOnly: false, notify: noop, modal: { person: sayama }, people: [chandru, sayama], layout: layoutTree([chandru, sayama]), apiState: 'demo', setPeople: value => { rows = value; }, setSelectedId: noop, setModal: noop, setDetailsOpen: noop, setMobileDetailsOpen: noop });
  await actions.saveMember({ ...sayama, partnerRelationships: [{ partnerId: 'chandru', label: 'Husband' }] });
  assert.equal(rows.find(p => p.id === 'sayama').partnerRelationships[0].label, 'Husband');
  assert.equal(rows.find(p => p.id === 'chandru').partnerRelationships[0].label, 'Wife');
});
