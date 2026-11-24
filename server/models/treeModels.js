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
export const PersonMergeInvitation = mongoose.model('PersonMergeInvitation', new mongoose.Schema({
  sourceTreeId: {
    type: id,
    required: true,
    ref: 'FamilyTree'
  },
  sourcePersonId: {
    type: id,
    required: true,
    ref: 'Person'
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
  acceptedBy: {
    type: id,
    ref: 'User'
  },
  revokedAt: Date,
  invitedBy: {
    type: id,
    required: true,
    ref: 'User'
  }
}, {
  timestamps: true
}));
const linkedFamilyMemberSchema = new mongoose.Schema({
  sourcePersonId: { type: id, required: true, ref: 'Person' },
  destinationPersonId: { type: id, required: true, ref: 'Person' },
}, { _id: false });
export const TreeFamilyLink = mongoose.model('TreeFamilyLink', new mongoose.Schema({
  sourceTreeId: { type: id, required: true, ref: 'FamilyTree' },
  destinationTreeId: { type: id, required: true, ref: 'FamilyTree' },
  sourcePersonId: { type: id, required: true, ref: 'Person' },
  targetPersonId: { type: id, required: true, ref: 'Person' },
  relationType: { type: String, enum: ['matched', 'parent'], required: true },
  members: { type: [linkedFamilyMemberSchema], default: [] },
  isActive: { type: Boolean, default: true },
  lastSyncedAt: Date,
  createdBy: { type: id, required: true, ref: 'User' },
}, { timestamps: true }).index({ destinationTreeId: 1, sourceTreeId: 1, sourcePersonId: 1 }, { unique: true }));
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
