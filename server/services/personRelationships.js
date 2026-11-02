import mongoose from 'mongoose';
import Person from '../models/Person.js';
export async function sanitizeOwnedRelationships(values, treeId, currentPersonId = null) {
  const allowedFields = ['firstName', 'lastName', 'maidenName', 'gender', 'birthDate', 'deathDate', 'birthPlace', 'photoUrl', 'bio', 'occupation', 'notes', 'seedKey', 'treeX', 'treeY', 'parentIds', 'partnerIds', 'siblingIds', 'partnerRelationships', 'relationshipLinks'];
  const safeValues = Object.fromEntries(allowedFields.filter(field => Object.hasOwn(values, field)).map(field => [field, values[field]]));
  const relationshipIds = [...(Array.isArray(values.parentIds) ? values.parentIds : []), ...(Array.isArray(values.partnerIds) ? values.partnerIds : []), ...(Array.isArray(values.siblingIds) ? values.siblingIds : []), ...(Array.isArray(values.partnerRelationships) ? values.partnerRelationships.map(link => link?.partnerId) : []), ...(Array.isArray(values.relationshipLinks) ? values.relationshipLinks.map(link => link?.personId) : [])].filter(id => mongoose.isValidObjectId(id) && String(id) !== String(currentPersonId || ''));
  const ownedIds = new Set((await Person.find({
    treeId,
    deletedAt: null,
    _id: {
      $in: relationshipIds
    }
  }).select('_id').lean()).map(person => String(person._id)));
  const filterIds = ids => [...new Set(ids.filter(id => ownedIds.has(String(id))).map(String))];
  if (Array.isArray(values.parentIds)) safeValues.parentIds = filterIds(values.parentIds).slice(0, 2);
  if (Array.isArray(values.partnerIds)) safeValues.partnerIds = filterIds(values.partnerIds);
  if (Array.isArray(values.siblingIds)) safeValues.siblingIds = filterIds(values.siblingIds);
  if (Array.isArray(values.partnerRelationships)) {
    safeValues.partnerRelationships = values.partnerRelationships.filter(link => ownedIds.has(String(link?.partnerId))).map(link => ({
      partnerId: link.partnerId,
      label: String(link.label || '').trim()
    }));
  }
  if (Array.isArray(values.relationshipLinks)) {
    safeValues.relationshipLinks = values.relationshipLinks.filter(link => ownedIds.has(String(link?.personId)) && String(link?.label || '').trim()).map(link => ({
      personId: link.personId,
      label: String(link.label || '').trim()
    }));
  }
  return safeValues;
}
export async function syncPartners(person, treeId) {
  await Person.updateMany({
    treeId,
    $or: [{
      partnerIds: person._id
    }, {
      'partnerRelationships.partnerId': person._id
    }]
  }, {
    $pull: {
      partnerIds: person._id,
      partnerRelationships: {
        partnerId: person._id
      }
    }
  });
  await Promise.all(person.partnerIds.map(async partnerId => {
    const label = person.partnerRelationships.find(link => String(link.partnerId) === String(partnerId))?.label || '';
    await Person.updateOne({
      _id: partnerId,
      treeId
    }, {
      $addToSet: {
        partnerIds: person._id
      },
      $pull: {
        partnerRelationships: {
          partnerId: person._id
        }
      }
    });
    if (label) await Person.updateOne({
      _id: partnerId,
      treeId
    }, {
      $push: {
        partnerRelationships: {
          partnerId: person._id,
          label
        }
      }
    });
  }));
}
export async function syncSiblings(person, treeId) {
  await Person.updateMany({
    treeId,
    siblingIds: person._id
  }, {
    $pull: {
      siblingIds: person._id
    }
  });
  await Promise.all((person.siblingIds || []).map(siblingId => Person.updateOne({
    _id: siblingId,
    treeId
  }, {
    $addToSet: {
      siblingIds: person._id
    }
  })));
}
export async function syncRelationshipLinks(person, treeId) {
  await Person.updateMany({
    treeId,
    'relationshipLinks.personId': person._id
  }, {
    $pull: {
      relationshipLinks: {
        personId: person._id
      }
    }
  });
  await Promise.all((person.relationshipLinks || []).map(link => Person.updateOne({
    _id: link.personId,
    treeId
  }, {
    $push: {
      relationshipLinks: {
        personId: person._id,
        label: link.label
      }
    }
  })));
}
