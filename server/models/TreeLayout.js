import mongoose from 'mongoose';

const TreeLayoutSchema = new mongoose.Schema(
  {
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

TreeLayoutSchema.index({ familyId: 1, normalizedName: 1 }, { unique: true });

export default mongoose.model('TreeLayout', TreeLayoutSchema);
