import mongoose from 'mongoose';
import express from 'express';
import Person from './models/Person.js';
import TreeLayout from './models/TreeLayout.js';
import { requireAuth } from './authRoutes.js';
import { hashToken, randomToken, normalizeIdentity, isValidEmail } from './authSecurity.js';

const id = mongoose.Schema.Types.ObjectId;
export const FamilyTree = mongoose.model('FamilyTree', new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  createdBy: { type: id, required: true, ref: 'User' },
  legacyOwnerId: { type: id, unique: true, sparse: true },
}, { timestamps: true }));
const membershipSchema = new mongoose.Schema({
  treeId: { type: id, required: true, ref: 'FamilyTree' },
  userId: { type: id, required: true, ref: 'User' },
  role: { type: String, enum: ['owner', 'editor', 'viewer'], required: true },
}, { timestamps: true });
membershipSchema.index({ treeId: 1, userId: 1 }, { unique: true });
export const TreeMembership = mongoose.model('TreeMembership', membershipSchema);
export const TreeInvitation = mongoose.model('TreeInvitation', new mongoose.Schema({
  treeId: { type: id, required: true }, email: { type: String, required: true },
  role: { type: String, enum: ['editor', 'viewer'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }, acceptedAt: Date, revokedAt: Date,
  invitedBy: { type: id, required: true },
}, { timestamps: true }));
export const TreeActivity = mongoose.model('TreeActivity', new mongoose.Schema({
  treeId: { type: id, required: true, index: true }, actorId: { type: id, ref: 'User' },
  actorName: String, action: String, detail: String,
}, { timestamps: true }));

export async function recordActivity(req, action, detail = '') {
  await TreeActivity.create({ treeId: req.tree._id, actorId: req.user._id, actorName: req.user.displayName, action, detail });
}

// Repeatable migration: a user's old private tree becomes their first workspace.
export async function ensurePersonalTree(user) {
  let tree;
  try {
    tree = await FamilyTree.findOneAndUpdate({ legacyOwnerId: user._id }, {
      $setOnInsert: { name: `${user.displayName}'s family`, createdBy: user._id, legacyOwnerId: user._id },
    }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    tree = await FamilyTree.findOne({ legacyOwnerId: user._id });
  }
  await TreeMembership.updateOne({ treeId: tree._id, userId: user._id }, { $setOnInsert: { role: 'owner' } }, { upsert: true });
  await Promise.all([
    Person.updateMany({ ownerId: user._id, treeId: null }, { $set: { treeId: tree._id } }),
    TreeLayout.updateMany({ ownerId: user._id, treeId: null }, { $set: { treeId: tree._id } }),
  ]);
  return tree;
}

export function canWrite(role) { return role === 'owner' || role === 'editor'; }

export async function requireTree(req, res, next) {
  try {
    const treeId = req.params.treeId || req.get('x-tree-id');
    if (!mongoose.isValidObjectId(treeId)) return res.status(400).json({ error: 'Select a family tree first.' });
    const membership = await TreeMembership.findOne({ treeId, userId: req.user._id });
    if (!membership) return res.status(403).json({ error: 'You do not have access to this tree.' });
    const tree = await FamilyTree.findById(treeId);
    if (!tree) return res.status(404).json({ error: 'Tree not found.' });
    req.tree = tree;
    req.treeRole = membership.role;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !canWrite(membership.role)) return res.status(403).json({ error: 'This tree is read-only. Ask its owner for Editor access.' });
    next();
  } catch (error) { next(error); }
}
function ownerOnly(req, res, next) {
  if (req.treeRole !== 'owner') return res.status(403).json({ error: 'Only the tree owner can manage members.' });
  next();
}

export function createTreeRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', async (req, res, next) => {
    try {
      await ensurePersonalTree(req.user);
      const memberships = await TreeMembership.find({ userId: req.user._id }).populate('treeId');
      res.json(memberships.filter((m) => m.treeId).map((m) => ({ id: m.treeId.id, name: m.treeId.name, role: m.role })));
    } catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim().slice(0, 80);
      if (!name) return res.status(400).json({ error: 'Enter a tree name.' });
      const tree = await FamilyTree.create({ name, createdBy: req.user._id });
      await TreeMembership.create({ treeId: tree._id, userId: req.user._id, role: 'owner' });
      req.tree = tree;
      await recordActivity(req, 'Created tree', name);
      res.status(201).json({ id: tree.id, name, role: 'owner' });
    } catch (error) { next(error); }
  });
  router.post('/accept-invitation', async (req, res, next) => {
    try {
      const invitation = await TreeInvitation.findOneAndUpdate({ tokenHash: hashToken(String(req.body?.token || '')), email: req.user.normalizedEmail, expiresAt: { $gt: new Date() }, acceptedAt: null, revokedAt: null }, { $set: { acceptedAt: new Date() } }, { new: true });
      if (!invitation) return res.status(400).json({ error: 'Invitation is expired, already used, or belongs to another email address.' });
      try {
        await TreeMembership.updateOne({ treeId: invitation.treeId, userId: req.user._id }, { $setOnInsert: { role: invitation.role } }, { upsert: true });
      } catch (error) {
        await TreeInvitation.updateOne({ _id: invitation._id }, { $unset: { acceptedAt: 1 } });
        throw error;
      }
      req.tree = { _id: invitation.treeId };
      await recordActivity(req, 'Joined tree', invitation.role);
      res.json({ treeId: String(invitation.treeId) });
    } catch (error) { next(error); }
  });
  router.use('/:treeId', requireTree);
  router.get('/:treeId/members', async (req, res, next) => {
    try {
      const members = await TreeMembership.find({ treeId: req.tree._id }).populate('userId', 'displayName email');
      res.json(members.map((m) => ({ id: m.id, userId: m.userId?.id, name: m.userId?.displayName || 'Former member', email: req.treeRole === 'owner' ? m.userId?.email : undefined, role: m.role })));
    } catch (error) { next(error); }
  });
  router.patch('/:treeId/members/:memberId', ownerOnly, async (req, res, next) => {
    try {
      if (!['editor', 'viewer'].includes(req.body?.role)) return res.status(400).json({ error: 'Choose Editor or Viewer.' });
      const member = await TreeMembership.findOneAndUpdate({ _id: req.params.memberId, treeId: req.tree._id, role: { $ne: 'owner' } }, { $set: { role: req.body.role } }, { new: true });
      if (!member) return res.status(404).json({ error: 'Member not found or owner cannot be changed.' });
      await recordActivity(req, 'Changed member role', req.body.role);
      res.json({ role: member.role });
    } catch (error) { next(error); }
  });
  router.delete('/:treeId/members/:memberId', ownerOnly, async (req, res, next) => {
    try {
      const member = await TreeMembership.findOneAndDelete({ _id: req.params.memberId, treeId: req.tree._id, role: { $ne: 'owner' } });
      if (!member) return res.status(404).json({ error: 'Member not found or owner cannot be removed.' });
      await recordActivity(req, 'Removed member');
      res.sendStatus(204);
    } catch (error) { next(error); }
  });
  router.get('/:treeId/invitations', ownerOnly, async (req, res, next) => {
    try { res.json(await TreeInvitation.find({ treeId: req.tree._id, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).select('email role expiresAt')); }
    catch (error) { next(error); }
  });
  router.post('/:treeId/invitations', ownerOnly, async (req, res, next) => {
    try {
      const email = normalizeIdentity(req.body?.email);
      const role = req.body?.role;
      if (!isValidEmail(email) || !['editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Enter an email and choose Editor or Viewer.' });
      const token = randomToken();
      await TreeInvitation.create({ treeId: req.tree._id, email, role, tokenHash: hashToken(token), invitedBy: req.user._id, expiresAt: new Date(Date.now() + 7 * 86400000) });
      await recordActivity(req, 'Invited member', `${email} (${role})`);
      res.status(201).json({ token, email, role });
    } catch (error) { next(error); }
  });
  router.delete('/:treeId/invitations/:invitationId', ownerOnly, async (req, res, next) => {
    try {
      const result = await TreeInvitation.updateOne({ _id: req.params.invitationId, treeId: req.tree._id, acceptedAt: null }, { $set: { revokedAt: new Date() } });
      if (!result.matchedCount) return res.status(404).json({ error: 'Invitation not found.' });
      await recordActivity(req, 'Revoked invitation');
      res.sendStatus(204);
    } catch (error) { next(error); }
  });
  router.get('/:treeId/activity', async (req, res, next) => {
    try { res.json(await TreeActivity.find({ treeId: req.tree._id }).sort({ createdAt: -1, _id: -1 }).limit(100)); }
    catch (error) { next(error); }
  });
  router.get('/:treeId/recycle-bin', async (req, res, next) => {
    try { res.json(await Person.find({ treeId: req.tree._id, deletedAt: { $ne: null } }).sort({ deletedAt: -1 })); }
    catch (error) { next(error); }
  });
  router.post('/:treeId/recycle-bin/:personId/restore', async (req, res, next) => {
    try {
      const person = await Person.findOneAndUpdate({ _id: req.params.personId, treeId: req.tree._id, deletedAt: { $ne: null } }, { $set: { deletedAt: null, deletedBy: null } }, { new: true });
      if (!person) return res.status(404).json({ error: 'Deleted person not found.' });
      await recordActivity(req, 'Restored person', `${person.firstName} ${person.lastName}`);
      res.json(person);
    } catch (error) { next(error); }
  });
  return router;
}
