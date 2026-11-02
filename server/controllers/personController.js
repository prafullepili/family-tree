import mongoose from 'mongoose';
import Person from '../models/Person.js';
import { sanitizeOwnedRelationships, syncPartners, syncSiblings, syncRelationshipLinks } from '../services/personRelationships.js';
export const listPeople = async (req, res, next) => {
  try {
    res.json(await Person.find({
      treeId: req.tree._id,
      deletedAt: null
    }).sort({
      birthDate: 1
    }));
  } catch (e) {
    next(e);
  }
};
export const getPerson = async (req, res, next) => {
  try {
    const person = await Person.findOne({
      _id: req.params.id,
      treeId: req.tree._id,
      deletedAt: null
    });
    if (!person) return res.status(404).json({
      error: 'Person not found'
    });
    res.json(person);
  } catch (e) {
    next(e);
  }
};
export const resetPositions = async (req, res, next) => {
  try {
    const result = await Person.updateMany({
      treeId: req.tree._id,
      deletedAt: null
    }, {
      $set: {
        treeX: null,
        treeY: null
      }
    });
    res.json({
      modifiedCount: result.modifiedCount
    });
  } catch (e) {
    next(e);
  }
};
export const savePositions = async (req, res, next) => {
  try {
    const positions = Array.isArray(req.body?.positions) ? req.body.positions : [];
    const operations = positions.filter(position => position.id && Number.isFinite(position.treeX) && Number.isFinite(position.treeY)).map(position => ({
      updateOne: {
        filter: {
          _id: position.id,
          treeId: req.tree._id,
          deletedAt: null
        },
        update: {
          $set: {
            treeX: position.treeX,
            treeY: position.treeY
          }
        }
      }
    }));
    if (operations.length) await Person.bulkWrite(operations);
    res.json({
      modifiedCount: operations.length
    });
  } catch (e) {
    next(e);
  }
};
export const deletePeople = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.filter(id => mongoose.isValidObjectId(id)))] : [];
    if (!ids.length) return res.status(400).json({
      error: 'At least one person id is required.'
    });
    const ownedIds = (await Person.find({
      _id: {
        $in: ids
      },
      treeId: req.tree._id
    }).select('_id').lean()).map(person => person._id);
    const result = await Person.updateMany({
      _id: {
        $in: ownedIds
      },
      treeId: req.tree._id,
      deletedAt: null
    }, {
      $set: {
        deletedAt: new Date(),
        deletedBy: req.user._id
      }
    });
    res.json({
      deletedCount: result.modifiedCount
    });
  } catch (e) {
    next(e);
  }
};
export const importPeople = async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.people) ? req.body.people.slice(0, 5000) : [];
    if (!rows.length) return res.status(400).json({
      error: 'The import contains no people.'
    });
    const validRows = rows.filter(row => String(row.firstName || '').trim());
    if (!validRows.length) return res.status(400).json({
      error: 'Every imported person needs a first name.'
    });
    const referencedIds = new Set();
    validRows.forEach(row => {
      [row.sourceId, ...(row.parentIds || []), ...(row.partnerIds || []), ...(row.siblingIds || []), ...(row.partnerRelationships || []).map(link => link.partnerId), ...(row.relationshipLinks || []).map(link => link.personId)].filter(id => mongoose.isValidObjectId(id)).forEach(id => referencedIds.add(String(id)));
    });
    const existingIds = new Set((await Person.find({
      treeId: req.tree._id,
      _id: {
        $in: [...referencedIds]
      }
    }).select('_id').lean()).map(person => String(person._id)));
    const idMap = new Map();
    validRows.forEach((row, index) => {
      const sourceId = String(row.sourceId || `row-${index + 1}`);
      if (!idMap.has(sourceId)) idMap.set(sourceId, existingIds.has(sourceId) ? new mongoose.Types.ObjectId(sourceId) : new mongoose.Types.ObjectId());
    });
    const remapId = id => {
      const key = String(id || '');
      if (idMap.has(key)) return idMap.get(key);
      return existingIds.has(key) ? new mongoose.Types.ObjectId(key) : null;
    };
    const cleanDate = value => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const operations = validRows.map((row, index) => {
      const sourceId = String(row.sourceId || `row-${index + 1}`);
      const targetId = idMap.get(sourceId);
      const values = {
        treeId: req.tree._id,
        firstName: String(row.firstName || '').trim(),
        lastName: String(row.lastName || '').trim(),
        maidenName: String(row.maidenName || '').trim(),
        gender: ['female', 'male', 'nonbinary', 'unspecified'].includes(row.gender) ? row.gender : 'unspecified',
        birthDate: cleanDate(row.birthDate),
        deathDate: cleanDate(row.deathDate),
        birthPlace: String(row.birthPlace || '').trim(),
        occupation: String(row.occupation || '').trim(),
        bio: String(row.bio || '').trim(),
        notes: String(row.notes || '').trim(),
        photoUrl: String(row.photoUrl || '').trim(),
        parentIds: [...new Set((row.parentIds || []).map(remapId).filter(Boolean).map(String))].slice(0, 2),
        partnerIds: [...new Set((row.partnerIds || []).map(remapId).filter(Boolean).map(String))],
        siblingIds: [...new Set((row.siblingIds || []).map(remapId).filter(Boolean).map(String))],
        partnerRelationships: (row.partnerRelationships || []).map(link => ({
          partnerId: remapId(link.partnerId),
          label: String(link.label || '').trim()
        })).filter(link => link.partnerId),
        relationshipLinks: (row.relationshipLinks || []).map(link => ({
          personId: remapId(link.personId),
          label: String(link.label || '').trim()
        })).filter(link => link.personId && link.label),
        treeX: Number.isFinite(row.treeX) ? row.treeX : null,
        treeY: Number.isFinite(row.treeY) ? row.treeY : null
      };
      return {
        updateOne: {
          filter: {
            _id: targetId,
            treeId: req.tree._id
          },
          update: {
            $set: values
          },
          upsert: true
        }
      };
    });
    await Person.bulkWrite(operations, {
      ordered: false
    });
    res.json({
      importedCount: operations.length
    });
  } catch (e) {
    next(e);
  }
};
export const createPerson = async (req, res, next) => {
  try {
    const values = await sanitizeOwnedRelationships(req.body || {}, req.tree._id);
    const person = await Person.create({
      ...values,
      treeId: req.tree._id
    });
    await syncPartners(person, req.tree._id);
    await syncSiblings(person, req.tree._id);
    await syncRelationshipLinks(person, req.tree._id);
    res.status(201).json(person);
  } catch (e) {
    next(e);
  }
};
export const updatePerson = async (req, res, next) => {
  try {
    const values = await sanitizeOwnedRelationships(req.body || {}, req.tree._id, req.params.id);
    const person = await Person.findOneAndUpdate({
      _id: req.params.id,
      treeId: req.tree._id,
      deletedAt: null
    }, values, {
      new: true,
      runValidators: true
    });
    if (!person) return res.status(404).json({
      error: 'Person not found'
    });
    await syncPartners(person, req.tree._id);
    await syncSiblings(person, req.tree._id);
    await syncRelationshipLinks(person, req.tree._id);
    res.json(person);
  } catch (e) {
    next(e);
  }
};
export const deletePerson = async (req, res, next) => {
  try {
    const person = await Person.findOneAndUpdate({
      _id: req.params.id,
      treeId: req.tree._id,
      deletedAt: null
    }, {
      $set: {
        deletedAt: new Date(),
        deletedBy: req.user._id
      }
    });
    if (!person) return res.status(404).json({
      error: 'Person not found'
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};
