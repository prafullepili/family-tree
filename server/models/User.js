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
    passwordVersion: { type: Number, default: 0 },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationRequired: { type: Boolean, default: false },
    verificationHash: { type: String, select: false },
    verificationExpiresAt: { type: Date },
    verificationSentAt: { type: Date },
    verificationAttempts: { type: Number, default: 0 },
    verificationWindowAt: { type: Date },
    verificationSendCount: { type: Number, default: 0 },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    resetRequestedAt: { type: Date, select: false },
    recoveryHash: { type: String, select: false },
    recoveryExpiresAt: { type: Date },
    recoverySentAt: { type: Date },
    recoveryAttempts: { type: Number, default: 0 },
    recoveryWindowAt: { type: Date },
    recoverySendCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('User', UserSchema);
