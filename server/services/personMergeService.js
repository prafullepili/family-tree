import mongoose from 'mongoose';
import Person from '../models/Person.js';
import { syncPartners, syncSiblings, syncRelationshipLinks } from './personRelationships.js';

const idOf = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value._id != null) return String(value._id);
  if (typeof value.id === 'string') return value.id;
  return String(value);
};

export function connectedFamily(people, anchorId) {
  const byId = new Map(people.map((person) => [idOf(person._id), person]));
  const links = new Map([...byId.keys()].map((id) => [id, new Set()]));
  const connect = (left, right) => {
    left = idOf(left);
    right = idOf(right);
    if (links.has(left) && links.has(right)) {
      links.get(left).add(right);
      links.get(right).add(left);
    }
  };
  people.forEach((person) => {
    (person.parentIds || []).forEach((id) => connect(person._id, id));
    (person.partnerIds || []).forEach((id) => connect(person._id, id));
    (person.siblingIds || []).forEach((id) => connect(person._id, id));
    (person.relationshipLinks || []).forEach((link) => connect(person._id, link.personId));
  });
  const anchor = idOf(anchorId);
  if (!byId.has(anchor)) return [];
  const included = new Set([anchor]);
  const pending = [anchor];
  while (pending.length) {
    const current = pending.pop();
    for (const linkedId of links.get(current) || []) {
      if (!included.has(linkedId)) {
        included.add(linkedId);
        pending.push(linkedId);
      }
    }
  }
  return people.filter((person) => included.has(idOf(person._id)));
}

const unionIds = (current = [], incoming = []) => [...new Set([...current.map(idOf), ...incoming.map(idOf)].filter(Boolean))];
function unionLinks(current = [], incoming = [], idKey) {
  const result = current.map((link) => ({ ...link, [idKey]: idOf(link[idKey]) }));
  incoming.forEach((link) => {
    const mapped = { ...link, [idKey]: idOf(link[idKey]) };
    if (!mapped[idKey]) return;
    if (!result.some((item) => item[idKey] === mapped[idKey] && (idKey !== 'personId' || item.label === mapped.label))) result.push(mapped);
  });
  return result;
}

export async function mergePersonFamily({ sourcePeople, sourcePersonId, targetPerson, targetTreeId }) {
  const family = connectedFamily(sourcePeople, sourcePersonId);
  if (!family.length) throw Error('The invited person is no longer available in the source tree.');
  if (family.length > 5000) throw Error('This connected family contains more than 5,000 people. Ask the source owner to create a smaller merge invitation.');
  const sourceRoot = family.find((person) => idOf(person._id) === idOf(sourcePersonId));
  const idMap = new Map(family.map((person) => [idOf(person._id), idOf(person._id) === idOf(sourcePersonId) ? targetPerson._id : new mongoose.Types.ObjectId()]));
  const remap = (value) => idMap.get(idOf(value)) || null;
  const siblings = (person) => [...new Set((person.siblingIds || []).map(remap).filter(Boolean).map(String))];
  const partnerIds = (person) => [...new Set((person.partnerIds || []).map(remap).filter(Boolean).map(String))];
  const parentIds = (person) => [...new Set((person.parentIds || []).map(remap).filter(Boolean).map(String))].slice(0, 2);
  const partnerRelationships = (person) => (person.partnerRelationships || []).map((link) => ({ partnerId: remap(link.partnerId), label: String(link.label || '').trim() })).filter((link) => link.partnerId);
  const relationshipLinks = (person) => (person.relationshipLinks || []).map((link) => ({ personId: remap(link.personId), label: String(link.label || '').trim() })).filter((link) => link.personId && link.label);
  const imported = family.filter((person) => idOf(person._id) !== idOf(sourcePersonId)).map((person) => ({
    _id: remap(person._id),
    treeId: targetTreeId,
    firstName: person.firstName,
    lastName: person.lastName,
    maidenName: person.maidenName || '',
    gender: person.gender || 'unspecified',
    birthDate: person.birthDate || null,
    deathDate: person.deathDate || null,
    birthPlace: person.birthPlace || '',
    occupation: person.occupation || '',
    bio: person.bio || '',
    notes: person.notes || '',
    photoUrl: person.photoUrl?.startsWith('/api/photos/') ? '' : person.photoUrl || '',
    parentIds: parentIds(person),
    partnerIds: partnerIds(person),
    siblingIds: siblings(person),
    partnerRelationships: partnerRelationships(person),
    relationshipLinks: relationshipLinks(person),
    treeX: null,
    treeY: null,
  }));
  const oldRelationships = {
    parentIds: targetPerson.parentIds || [],
    partnerIds: targetPerson.partnerIds || [],
    siblingIds: targetPerson.siblingIds || [],
    partnerRelationships: targetPerson.partnerRelationships || [],
    relationshipLinks: targetPerson.relationshipLinks || [],
  };
  let insertedIds = [];
  try {
    if (imported.length) {
      insertedIds = imported.map((person) => person._id);
      const inserted = await Person.insertMany(imported, { ordered: true });
    }
    const values = {
      parentIds: [...new Set([...oldRelationships.parentIds.map(idOf), ...parentIds(sourceRoot).map(idOf)])].slice(0, 2),
      partnerIds: unionIds(oldRelationships.partnerIds, partnerIds(sourceRoot)),
      siblingIds: unionIds(oldRelationships.siblingIds, siblings(sourceRoot)),
      partnerRelationships: unionLinks(oldRelationships.partnerRelationships, partnerRelationships(sourceRoot), 'partnerId'),
      relationshipLinks: unionLinks(oldRelationships.relationshipLinks, relationshipLinks(sourceRoot), 'personId'),
    };
    const updated = await Person.findOneAndUpdate({ _id: targetPerson._id, treeId: targetTreeId, deletedAt: null }, values, { new: true, runValidators: true });
    if (!updated) throw Error('The matching person is no longer available in your tree.');
    await syncPartners(updated, targetTreeId);
    await syncSiblings(updated, targetTreeId);
    await syncRelationshipLinks(updated, targetTreeId);
    return {
      importedCount: imported.length,
      linkedTo: idOf(updated._id),
      mapping: Object.fromEntries([...idMap].map(([sourceId, destinationId]) => [sourceId, idOf(destinationId)])),
    };
  } catch (error) {
    if (insertedIds.length) await Person.deleteMany({ _id: { $in: insertedIds }, treeId: targetTreeId }).catch(() => {});
    const restored = await Person.findOneAndUpdate({ _id: targetPerson._id, treeId: targetTreeId }, oldRelationships, { new: true }).catch(() => null);
    if (restored) {
      await syncPartners(restored, targetTreeId).catch(() => {});
      await syncSiblings(restored, targetTreeId).catch(() => {});
      await syncRelationshipLinks(restored, targetTreeId).catch(() => {});
    }
    throw error;
  }
}

export async function attachPersonFamilyAsParent({ sourcePeople, sourcePersonId, targetPerson, targetTreeId }) {
  const family = connectedFamily(sourcePeople, sourcePersonId);
  if (!family.length) throw Error('The invited person is no longer available in the source tree.');
  if (family.length > 5000) throw Error('This connected family contains more than 5,000 people. Ask the source owner to create a smaller merge invitation.');
  if ((targetPerson.parentIds || []).length >= 2) throw Error('The selected person already has two parents.');
  const idMap = new Map(family.map((person) => [idOf(person._id), new mongoose.Types.ObjectId()]));
  const remap = (value) => idMap.get(idOf(value)) || null;
  const imported = family.map((person) => ({
    _id: remap(person._id),
    treeId: targetTreeId,
    firstName: person.firstName,
    lastName: person.lastName,
    maidenName: person.maidenName || '',
    gender: person.gender || 'unspecified',
    birthDate: person.birthDate || null,
    deathDate: person.deathDate || null,
    birthPlace: person.birthPlace || '',
    occupation: person.occupation || '',
    bio: person.bio || '',
    notes: person.notes || '',
    photoUrl: person.photoUrl?.startsWith('/api/photos/') ? '' : person.photoUrl || '',
    parentIds: [...new Set((person.parentIds || []).map(remap).filter(Boolean).map(String))].slice(0, 2),
    partnerIds: [...new Set((person.partnerIds || []).map(remap).filter(Boolean).map(String))],
    siblingIds: [...new Set((person.siblingIds || []).map(remap).filter(Boolean).map(String))],
    partnerRelationships: (person.partnerRelationships || []).map((link) => ({ partnerId: remap(link.partnerId), label: String(link.label || '').trim() })).filter((link) => link.partnerId),
    relationshipLinks: (person.relationshipLinks || []).map((link) => ({ personId: remap(link.personId), label: String(link.label || '').trim() })).filter((link) => link.personId && link.label),
    treeX: null,
    treeY: null,
  }));
  const rootId = remap(sourcePersonId);
  const insertedIds = imported.map((person) => person._id);
  const oldParentIds = targetPerson.parentIds || [];
  try {
    await Person.insertMany(imported, { ordered: true });
    const updated = await Person.findOneAndUpdate({ _id: targetPerson._id, treeId: targetTreeId, deletedAt: null }, {
      parentIds: [...new Set([...oldParentIds.map(idOf), idOf(rootId)])],
    }, { new: true, runValidators: true });
    if (!updated) throw Error('The selected person is no longer available in your tree.');
    for (const person of imported) {
      const stored = await Person.findOne({ _id: person._id, treeId: targetTreeId });
      if (stored) {
        await syncPartners(stored, targetTreeId);
        await syncSiblings(stored, targetTreeId);
        await syncRelationshipLinks(stored, targetTreeId);
      }
    }
    return {
      importedCount: imported.length,
      linkedTo: idOf(updated._id),
      parentId: idOf(rootId),
      mapping: Object.fromEntries([...idMap].map(([sourceId, destinationId]) => [sourceId, idOf(destinationId)])),
    };
  } catch (error) {
    await Person.deleteMany({ _id: { $in: insertedIds }, treeId: targetTreeId }).catch(() => {});
    await Person.findOneAndUpdate({ _id: targetPerson._id, treeId: targetTreeId }, { parentIds: oldParentIds }, { new: true }).catch(() => {});
    throw error;
  }
}

export async function refreshLinkedFamily({ link, sourcePeople }) {
  const currentFamily = connectedFamily(sourcePeople, link.sourcePersonId);
  if (!currentFamily.length) throw Error('The linked source person is no longer active in the source tree.');
  if (currentFamily.length > 5000) throw Error('This connected family contains more than 5,000 people.');
  const mapping = new Map((link.members || []).map((member) => [idOf(member.sourcePersonId), member.destinationPersonId]));
  currentFamily.forEach((person) => {
    if (!mapping.has(idOf(person._id))) mapping.set(idOf(person._id), new mongoose.Types.ObjectId());
  });
  const sourceIds = [...mapping.keys()];
  const sourceById = new Map(sourcePeople.filter((person) => sourceIds.includes(idOf(person._id))).map((person) => [idOf(person._id), person]));
  const liveSourceIds = new Set(sourceById.keys());
  const remap = (value) => {
    const sourceId = idOf(value);
    return liveSourceIds.has(sourceId) ? mapping.get(sourceId) || null : null;
  };
  const linkedValues = (person) => ({
    firstName: person.firstName,
    lastName: person.lastName || '',
    maidenName: person.maidenName || '',
    gender: person.gender || 'unspecified',
    birthDate: person.birthDate || null,
    deathDate: person.deathDate || null,
    birthPlace: person.birthPlace || '',
    occupation: person.occupation || '',
    bio: person.bio || '',
    notes: person.notes || '',
    photoUrl: person.photoUrl?.startsWith('/api/photos/') ? '' : person.photoUrl || '',
    parentIds: (person.parentIds || []).map(remap).filter(Boolean).map(String).slice(0, 2),
    partnerIds: [...new Set((person.partnerIds || []).map(remap).filter(Boolean).map(String))],
    siblingIds: [...new Set((person.siblingIds || []).map(remap).filter(Boolean).map(String))],
    partnerRelationships: (person.partnerRelationships || []).map((item) => ({ partnerId: remap(item.partnerId), label: String(item.label || '').trim() })).filter((item) => item.partnerId),
    relationshipLinks: (person.relationshipLinks || []).map((item) => ({ personId: remap(item.personId), label: String(item.label || '').trim() })).filter((item) => item.personId && item.label),
  });
  const upserts = [];
  const operations = [];
  for (const [sourceId, destinationId] of mapping) {
    const source = sourceById.get(sourceId);
    const values = source ? linkedValues(source) : { parentIds: [], partnerIds: [], siblingIds: [], partnerRelationships: [], relationshipLinks: [] };
    if (!currentFamily.some((person) => idOf(person._id) === sourceId)) {
      const existing = await Person.findOne({ _id: destinationId, treeId: link.destinationTreeId }).select('treeX treeY').lean();
      if (!existing) continue;
      values.treeX = existing.treeX;
      values.treeY = existing.treeY;
    }
    if (!await Person.exists({ _id: destinationId, treeId: link.destinationTreeId })) {
      if (!source) continue;
      upserts.push({
        _id: destinationId,
        treeId: link.destinationTreeId,
        ...values,
        treeX: null,
        treeY: null,
      });
    } else {
      operations.push({ updateOne: { filter: { _id: destinationId, treeId: link.destinationTreeId }, update: { $set: values } } });
    }
  }
  const refreshedTarget = await Person.findOne({ _id: link.targetPersonId, treeId: link.destinationTreeId, deletedAt: null });
  const destinationRootId = mapping.get(idOf(link.sourcePersonId));
  if (!refreshedTarget || !destinationRootId) throw Error('The linked person or destination connection is no longer available.');
  const needsParentRestore = link.relationType === 'parent' && !(refreshedTarget.parentIds || []).some((id) => idOf(id) === idOf(destinationRootId));
  if (needsParentRestore && (refreshedTarget.parentIds || []).length >= 2) throw Error('The destination person already has two parents, so the linked parent relationship could not be restored.');
  const insertedIds = upserts.map((person) => person._id);
  try {
    if (upserts.length) await Person.insertMany(upserts, { ordered: true });
    if (operations.length) await Person.bulkWrite(operations, { ordered: true });
    for (const destinationId of [...mapping.values()]) {
      const person = await Person.findOne({ _id: destinationId, treeId: link.destinationTreeId });
      if (!person) continue;
      await syncPartners(person, link.destinationTreeId);
      await syncSiblings(person, link.destinationTreeId);
      await syncRelationshipLinks(person, link.destinationTreeId);
    }
    if (needsParentRestore) {
      const updated = await Person.findOneAndUpdate({ _id: refreshedTarget._id, treeId: link.destinationTreeId, deletedAt: null }, {
        parentIds: [...(refreshedTarget.parentIds || []).map(idOf), idOf(destinationRootId)],
      }, { new: true, runValidators: true });
      if (!updated) throw Error('The destination relationship could not be restored.');
    }
    link.members = [...mapping].map(([sourcePersonId, destinationPersonId]) => ({ sourcePersonId, destinationPersonId }));
    link.lastSyncedAt = new Date();
    await link.save();
    return { updatedCount: operations.length, addedCount: upserts.length, memberCount: mapping.size };
  } catch (error) {
    if (insertedIds.length) await Person.deleteMany({ _id: { $in: insertedIds }, treeId: link.destinationTreeId }).catch(() => {});
    throw error;
  }
}
