import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { hashPassword, hashToken } from '../authSecurity.js';


export async function applyPasswordReset(token, password) {
  const tokenHash = hashToken(token);
  const filter = { resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() } };
  if (!await User.exists(filter)) return null;
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate({ ...filter, resetTokenExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash }, $inc: { passwordVersion: 1 },
    $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1, resetRequestedAt: 1 },
  }, { new: true });
  if (!user) return null;
  await AuthSession.deleteMany({ userId: user._id });
  return user;
}
