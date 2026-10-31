import mongoose from 'mongoose';

const TreeLayoutSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    treeId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyTree', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    normalizedName: { type: String, required: true, trim: true },
    familyId: { type: String, required: true, trim: true },
    familyName: { type: String, trim: true, default: '' },
    positions: [
      {
        personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
        treeX: { type: Number, required: true },
        treeY: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true },
);

TreeLayoutSchema.index({ treeId: 1, familyId: 1, normalizedName: 1 }, { unique: true, partialFilterExpression: { treeId: { $type: 'objectId' } } });

export default mongoose.model('TreeLayout', TreeLayoutSchema);
