import './config/environment.js';
import mongoose from 'mongoose';
import { app } from './app.js';
import { initializeDatabase } from './config/database.js';
export { app, initializeDatabase };
const port = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test' && process.env.MONGODB_URI) mongoose.connect(process.env.MONGODB_URI, {
  dbName: 'familytree'
}).then(async () => {
  await initializeDatabase();
  console.log(`MongoDB connected to ${mongoose.connection.name}`);
}).catch(err => console.error('MongoDB connection failed:', err.message));
if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`VanshLink API listening on ${port}`));
