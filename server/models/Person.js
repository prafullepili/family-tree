import mongoose from 'mongoose';

const PersonSchema = new mongoose.Schema({
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
  parentIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }], validate: [v => v.length <= 2, 'A person can have at most two parents'] },
  partnerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
  notes: { type: String, trim: true, default: '' },
  treeX: { type: Number, default: null },
  treeY: { type: Number, default: null }
}, { timestamps: true });

export default mongoose.model('Person', PersonSchema);
