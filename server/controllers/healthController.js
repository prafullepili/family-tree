import mongoose from 'mongoose';
export const getHealth = (_req, res) => res.json({
  status: 'ok',
  configured: Boolean(process.env.MONGODB_URI),
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  databaseName: mongoose.connection.readyState === 1 ? mongoose.connection.name : null,
  authentication: 'required',
  googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
});
