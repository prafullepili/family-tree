import mongoose from 'mongoose';
import { FamilyTree, TreeMembership } from '../models/treeModels.js';
import { canWrite } from '../services/treeService.js';
export async function requireTree(req, res, next) {
  try {
    const treeId = req.params.treeId || req.get('x-tree-id');
    if (!mongoose.isValidObjectId(treeId)) return res.status(400).json({
      error: 'Select a family tree first.'
    });
    const membership = await TreeMembership.findOne({
      treeId,
      userId: req.user._id
    });
    if (!membership) return res.status(403).json({
      error: 'You do not have access to this tree.'
    });
    const tree = await FamilyTree.findById(treeId);
    if (!tree) return res.status(404).json({
      error: 'Tree not found.'
    });
    req.tree = tree;
    req.treeRole = membership.role;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !canWrite(membership.role)) return res.status(403).json({
      error: 'This tree is read-only. Ask its owner for Editor access.'
    });
    next();
  } catch (error) {
    next(error);
  }
}
export function ownerOnly(req, res, next) {
  if (req.treeRole !== 'owner') return res.status(403).json({
    error: 'Only the tree owner can manage members.'
  });
  next();
}
