import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, required: true, trim: true, maxlength: 30 },
    normalizedUsername: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    normalizedEmail: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, default: undefined, select: false },
    googleSubject: { type: String, default: undefined, unique: true, sparse: true, index: true },
    avatarUrl: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('User', UserSchema);
