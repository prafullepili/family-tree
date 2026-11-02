import mongoose from 'mongoose';
const id = mongoose.Schema.Types.ObjectId;
export const FamilyTree = mongoose.model('FamilyTree', new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 80
  },
  createdBy: {
    type: id,
    required: true,
    ref: 'User'
  },
  legacyOwnerId: {
    type: id,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
}));
const membershipSchema = new mongoose.Schema({
  treeId: {
    type: id,
    required: true,
    ref: 'FamilyTree'
  },
  userId: {
    type: id,
    required: true,
    ref: 'User'
  },
  role: {
    type: String,
    enum: ['owner', 'editor', 'viewer'],
    required: true
  }
}, {
  timestamps: true
});
membershipSchema.index({
  treeId: 1,
  userId: 1
}, {
  unique: true
});
export const TreeMembership = mongoose.model('TreeMembership', membershipSchema);
export const TreeInvitation = mongoose.model('TreeInvitation', new mongoose.Schema({
  treeId: {
    type: id,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['editor', 'viewer'],
    required: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedAt: Date,
  revokedAt: Date,
  invitedBy: {
    type: id,
    required: true
  }
}, {
  timestamps: true
}));
export const TreeActivity = mongoose.model('TreeActivity', new mongoose.Schema({
  treeId: {
    type: id,
    required: true,
    index: true
  },
  actorId: {
    type: id,
    ref: 'User'
  },
  actorName: String,
  action: String,
  detail: String
}, {
  timestamps: true
}));
