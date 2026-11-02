import Person from '../models/Person.js';
import TreeLayout from '../models/TreeLayout.js';
import { FamilyTree, TreeMembership, TreeActivity } from '../models/treeModels.js';
export async function recordActivity(req, action, detail = '') {
  await TreeActivity.create({
    treeId: req.tree._id,
    actorId: req.user._id,
    actorName: req.user.displayName,
    action,
    detail
  });
}
export async function ensurePersonalTree(user) {
  let tree;
  try {
    tree = await FamilyTree.findOneAndUpdate({
      legacyOwnerId: user._id
    }, {
      $setOnInsert: {
        name: `${user.displayName}'s family`,
        createdBy: user._id,
        legacyOwnerId: user._id
      }
    }, {
      upsert: true,
      new: true
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    tree = await FamilyTree.findOne({
      legacyOwnerId: user._id
    });
  }
  await TreeMembership.updateOne({
    treeId: tree._id,
    userId: user._id
  }, {
    $setOnInsert: {
      role: 'owner'
    }
  }, {
    upsert: true
  });
  await Promise.all([Person.updateMany({
    ownerId: user._id,
    treeId: null
  }, {
    $set: {
      treeId: tree._id
    }
  }), TreeLayout.updateMany({
    ownerId: user._id,
    treeId: null
  }, {
    $set: {
      treeId: tree._id
    }
  })]);
  return tree;
}
export function canWrite(role) {
  return role === 'owner' || role === 'editor';
}
