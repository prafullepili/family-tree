import mongoose from 'mongoose';

const AuthSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    csrfToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSeenAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);

export default mongoose.model('AuthSession', AuthSessionSchema);
