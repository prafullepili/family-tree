import mongoose from 'mongoose';

const PersonSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    treeId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyTree', default: null, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    maidenName: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['female', 'male', 'nonbinary', 'unspecified'], default: 'unspecified' },
    birthDate: { type: Date, default: null },
    deathDate: { type: Date, default: null },
    birthPlace: { type: String, trim: true, default: '' },
    photoUrl: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    occupation: { type: String, trim: true, default: '' },
    parentIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }], validate: [(v) => v.length <= 2, 'A person can have at most two parents'] },
    partnerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    siblingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    partnerRelationships: [
      {
        partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
        label: { type: String, trim: true, default: '' },
      },
    ],
    relationshipLinks: [
      {
        personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
        label: { type: String, trim: true, required: true },
      },
    ],
    notes: { type: String, trim: true, default: '' },
    seedKey: { type: String, default: undefined, index: true },
    treeX: { type: Number, default: null },
    treeY: { type: Number, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('Person', PersonSchema);
