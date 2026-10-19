import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Person from './models/Person.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    configured: Boolean(process.env.MONGODB_URI),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.readyState === 1 ? mongoose.connection.name : null,
  }),
);
app.use('/api/people', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'MongoDB is not connected. Set MONGODB_URI and restart the API.' });
  next();
});
app.get('/api/people', async (_req, res, next) => {
  try {
    res.json(await Person.find().sort({ birthDate: 1 }));
  } catch (e) {
    next(e);
  }
});
app.get('/api/people/:id', async (req, res, next) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (e) {
    next(e);
  }
});
app.patch('/api/people/layout/reset', async (_req, res, next) => {
  try {
    const result = await Person.updateMany({}, { $set: { treeX: null, treeY: null } });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (e) {
    next(e);
  }
});
app.patch('/api/people/layout/positions', async (req, res, next) => {
  try {
    const positions = Array.isArray(req.body?.positions) ? req.body.positions : [];
    const operations = positions
      .filter((position) => position.id && Number.isFinite(position.treeX) && Number.isFinite(position.treeY))
      .map((position) => ({
        updateOne: { filter: { _id: position.id }, update: { $set: { treeX: position.treeX, treeY: position.treeY } } },
      }));
    if (operations.length) await Person.bulkWrite(operations);
    res.json({ modifiedCount: operations.length });
  } catch (e) {
    next(e);
  }
});
app.delete('/api/people/batch', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.filter(Boolean))] : [];
    if (!ids.length) return res.status(400).json({ error: 'At least one person id is required.' });
    const result = await Person.deleteMany({ _id: { $in: ids } });
    await Person.updateMany(
      { $or: [{ parentIds: { $in: ids } }, { partnerIds: { $in: ids } }, { 'partnerRelationships.partnerId': { $in: ids } }] },
      { $pull: { parentIds: { $in: ids }, partnerIds: { $in: ids }, partnerRelationships: { partnerId: { $in: ids } } } },
    );
    res.json({ deletedCount: result.deletedCount });
  } catch (e) {
    next(e);
  }
});
async function syncPartners(person) {
  await Person.updateMany(
    { $or: [{ partnerIds: person._id }, { 'partnerRelationships.partnerId': person._id }] },
    { $pull: { partnerIds: person._id, partnerRelationships: { partnerId: person._id } } },
  );
  await Promise.all(
    person.partnerIds.map(async (partnerId) => {
      const label = person.partnerRelationships.find((link) => String(link.partnerId) === String(partnerId))?.label || '';
      await Person.updateOne({ _id: partnerId }, { $addToSet: { partnerIds: person._id }, $pull: { partnerRelationships: { partnerId: person._id } } });
      if (label) await Person.updateOne({ _id: partnerId }, { $push: { partnerRelationships: { partnerId: person._id, label } } });
    }),
  );
}
app.post('/api/people', async (req, res, next) => {
  try {
    const person = await Person.create(req.body);
    await syncPartners(person);
    res.status(201).json(person);
  } catch (e) {
    next(e);
  }
});
app.patch('/api/people/:id', async (req, res, next) => {
  try {
    const person = await Person.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    await syncPartners(person);
    res.json(person);
  } catch (e) {
    next(e);
  }
});
app.delete('/api/people/:id', async (req, res, next) => {
  try {
    const person = await Person.findByIdAndDelete(req.params.id);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    await Person.updateMany(
      { $or: [{ parentIds: person._id }, { partnerIds: person._id }, { 'partnerRelationships.partnerId': person._id }] },
      { $pull: { parentIds: person._id, partnerIds: person._id, partnerRelationships: { partnerId: person._id } } },
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message || 'Server error' });
});
const port = process.env.PORT || 4000;
if (process.env.MONGODB_URI)
  mongoose
    .connect(process.env.MONGODB_URI, { dbName: 'familytree' })
    .then(() => console.log(`MongoDB connected to ${mongoose.connection.name}`))
    .catch((err) => console.error('MongoDB connection failed:', err.message));
app.listen(port, () => console.log(`Kinfolk API listening on ${port}`));
