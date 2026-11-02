import Person from '../models/Person.js';
import { FamilyTree, TreeMembership, TreeInvitation, TreeActivity } from '../models/treeModels.js';
import { ensurePersonalTree, recordActivity } from '../services/treeService.js';
import { hashToken, randomToken, normalizeIdentity, isValidEmail } from '../authSecurity.js';
export const listTrees = async (req, res, next) => {
  try {
    await ensurePersonalTree(req.user);
    const memberships = await TreeMembership.find({
      userId: req.user._id
    }).populate('treeId');
    res.json(memberships.filter(m => m.treeId).map(m => ({
      id: m.treeId.id,
      name: m.treeId.name,
      role: m.role
    })));
  } catch (error) {
    next(error);
  }
};
export const createTree = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({
      error: 'Enter a tree name.'
    });
    const tree = await FamilyTree.create({
      name,
      createdBy: req.user._id
    });
    await TreeMembership.create({
      treeId: tree._id,
      userId: req.user._id,
      role: 'owner'
    });
    req.tree = tree;
    await recordActivity(req, 'Created tree', name);
    res.status(201).json({
      id: tree.id,
      name,
      role: 'owner'
    });
  } catch (error) {
    next(error);
  }
};
export const acceptInvitation = async (req, res, next) => {
  try {
    const invitation = await TreeInvitation.findOneAndUpdate({
      tokenHash: hashToken(String(req.body?.token || '')),
      email: req.user.normalizedEmail,
      expiresAt: {
        $gt: new Date()
      },
      acceptedAt: null,
      revokedAt: null
    }, {
      $set: {
        acceptedAt: new Date()
      }
    }, {
      new: true
    });
    if (!invitation) return res.status(400).json({
      error: 'Invitation is expired, already used, or belongs to another email address.'
    });
    try {
      await TreeMembership.updateOne({
        treeId: invitation.treeId,
        userId: req.user._id
      }, {
        $setOnInsert: {
          role: invitation.role
        }
      }, {
        upsert: true
      });
    } catch (error) {
      await TreeInvitation.updateOne({
        _id: invitation._id
      }, {
        $unset: {
          acceptedAt: 1
        }
      });
      throw error;
    }
    req.tree = {
      _id: invitation.treeId
    };
    await recordActivity(req, 'Joined tree', invitation.role);
    res.json({
      treeId: String(invitation.treeId)
    });
  } catch (error) {
    next(error);
  }
};
export const listMembers = async (req, res, next) => {
  try {
    const members = await TreeMembership.find({
      treeId: req.tree._id
    }).populate('userId', 'displayName email');
    res.json(members.map(m => ({
      id: m.id,
      userId: m.userId?.id,
      name: m.userId?.displayName || 'Former member',
      email: req.treeRole === 'owner' ? m.userId?.email : undefined,
      role: m.role
    })));
  } catch (error) {
    next(error);
  }
};
export const updateMember = async (req, res, next) => {
  try {
    if (!['editor', 'viewer'].includes(req.body?.role)) return res.status(400).json({
      error: 'Choose Editor or Viewer.'
    });
    const member = await TreeMembership.findOneAndUpdate({
      _id: req.params.memberId,
      treeId: req.tree._id,
      role: {
        $ne: 'owner'
      }
    }, {
      $set: {
        role: req.body.role
      }
    }, {
      new: true
    });
    if (!member) return res.status(404).json({
      error: 'Member not found or owner cannot be changed.'
    });
    await recordActivity(req, 'Changed member role', req.body.role);
    res.json({
      role: member.role
    });
  } catch (error) {
    next(error);
  }
};
export const removeMember = async (req, res, next) => {
  try {
    const member = await TreeMembership.findOneAndDelete({
      _id: req.params.memberId,
      treeId: req.tree._id,
      role: {
        $ne: 'owner'
      }
    });
    if (!member) return res.status(404).json({
      error: 'Member not found or owner cannot be removed.'
    });
    await recordActivity(req, 'Removed member');
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};
export const listInvitations = async (req, res, next) => {
  try {
    res.json(await TreeInvitation.find({
      treeId: req.tree._id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: {
        $gt: new Date()
      }
    }).select('email role expiresAt'));
  } catch (error) {
    next(error);
  }
};
export const createInvitation = async (req, res, next) => {
  try {
    const email = normalizeIdentity(req.body?.email);
    const role = req.body?.role;
    if (!isValidEmail(email) || !['editor', 'viewer'].includes(role)) return res.status(400).json({
      error: 'Enter an email and choose Editor or Viewer.'
    });
    const token = randomToken();
    await TreeInvitation.create({
      treeId: req.tree._id,
      email,
      role,
      tokenHash: hashToken(token),
      invitedBy: req.user._id,
      expiresAt: new Date(Date.now() + 7 * 86400000)
    });
    await recordActivity(req, 'Invited member', `${email} (${role})`);
    res.status(201).json({
      token,
      email,
      role
    });
  } catch (error) {
    next(error);
  }
};
export const revokeInvitation = async (req, res, next) => {
  try {
    const result = await TreeInvitation.updateOne({
      _id: req.params.invitationId,
      treeId: req.tree._id,
      acceptedAt: null
    }, {
      $set: {
        revokedAt: new Date()
      }
    });
    if (!result.matchedCount) return res.status(404).json({
      error: 'Invitation not found.'
    });
    await recordActivity(req, 'Revoked invitation');
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};
export const listActivity = async (req, res, next) => {
  try {
    res.json(await TreeActivity.find({
      treeId: req.tree._id
    }).sort({
      createdAt: -1,
      _id: -1
    }).limit(100));
  } catch (error) {
    next(error);
  }
};
export const listDeletedPeople = async (req, res, next) => {
  try {
    res.json(await Person.find({
      treeId: req.tree._id,
      deletedAt: {
        $ne: null
      }
    }).sort({
      deletedAt: -1
    }));
  } catch (error) {
    next(error);
  }
};
export const restorePerson = async (req, res, next) => {
  try {
    const person = await Person.findOneAndUpdate({
      _id: req.params.personId,
      treeId: req.tree._id,
      deletedAt: {
        $ne: null
      }
    }, {
      $set: {
        deletedAt: null,
        deletedBy: null
      }
    }, {
      new: true
    });
    if (!person) return res.status(404).json({
      error: 'Deleted person not found.'
    });
    await recordActivity(req, 'Restored person', `${person.firstName} ${person.lastName}`);
    res.json(person);
  } catch (error) {
    next(error);
  }
};
