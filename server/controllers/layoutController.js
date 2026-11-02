import mongoose from 'mongoose';
import Person from '../models/Person.js';
import TreeLayout from '../models/TreeLayout.js';
export const listLayouts = async (req, res, next) => {
  try {
    const familyId = String(req.query.familyId || '').trim();
    if (!familyId) return res.status(400).json({
      error: 'A family id is required.'
    });
    const personIds = String(req.query.personIds || '').split(',').map(id => id.trim()).filter(id => mongoose.isValidObjectId(id));
    const filter = personIds.length ? {
      treeId: req.tree._id,
      $or: [{
        familyId
      }, {
        'positions.personId': {
          $in: personIds
        }
      }]
    } : {
      treeId: req.tree._id,
      familyId
    };
    res.json(await TreeLayout.find(filter).sort({
      updatedAt: -1
    }));
  } catch (e) {
    next(e);
  }
};
export const saveLayout = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const familyId = String(req.body?.familyId || '').trim();
    const requestedPositions = (Array.isArray(req.body?.positions) ? req.body.positions : []).filter(position => mongoose.isValidObjectId(position.personId) && Number.isFinite(position.treeX) && Number.isFinite(position.treeY)).map(position => ({
      personId: position.personId,
      treeX: position.treeX,
      treeY: position.treeY
    }));
    if (!name) return res.status(400).json({
      error: 'A layout name is required.'
    });
    if (!familyId) return res.status(400).json({
      error: 'A family id is required.'
    });
    if (!requestedPositions.length) return res.status(400).json({
      error: 'At least one person position is required.'
    });
    const ownedPersonIds = new Set((await Person.find({
      treeId: req.tree._id,
      _id: {
        $in: requestedPositions.map(position => position.personId)
      }
    }).select('_id').lean()).map(person => String(person._id)));
    const positions = requestedPositions.filter(position => ownedPersonIds.has(String(position.personId)));
    if (!positions.length) return res.status(400).json({
      error: 'The layout does not contain any people from your tree.'
    });
    const normalizedName = name.toLocaleLowerCase();
    const personIds = positions.map(position => position.personId);
    const existing = await TreeLayout.findOne({
      treeId: req.tree._id,
      normalizedName,
      $or: [{
        familyId
      }, {
        'positions.personId': {
          $in: personIds
        }
      }]
    });
    const values = {
      treeId: req.tree._id,
      name,
      normalizedName,
      familyId,
      familyName: String(req.body?.familyName || '').trim(),
      positions
    };
    const layout = existing ? await TreeLayout.findByIdAndUpdate(existing._id, {
      $set: values
    }, {
      new: true,
      runValidators: true
    }) : await TreeLayout.create(values);
    res.status(201).json(layout);
  } catch (e) {
    next(e);
  }
};
export const deleteLayout = async (req, res, next) => {
  try {
    const layout = await TreeLayout.findOneAndDelete({
      _id: req.params.id,
      treeId: req.tree._id
    });
    if (!layout) return res.status(404).json({
      error: 'Saved tree view not found.'
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};
