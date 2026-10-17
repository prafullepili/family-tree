import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Person from './models/Person.js';
import { demoPeople, addedPeople } from '../src/demoFamily.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', configured: Boolean(process.env.MONGODB_URI), database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/people', (req, res, next) => { if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'MongoDB is not connected. Set MONGODB_URI and restart the API.' }); next(); });
app.get('/api/people', async (_req, res, next) => { try { res.json(await Person.find().sort({ birthDate: 1 })); } catch (e) { next(e); } });
app.post('/api/people/seed-extended', async (_req, res, next) => { try {
  const total = await Person.countDocuments();
  if (total === 0) {
    const ids = new Map(demoPeople.map(person => [person.id, new mongoose.Types.ObjectId()]));
    const extendedIds = new Set(addedPeople.map(person => person.id));
    const docs = demoPeople.map(({ id, ...person }) => ({
      ...person,
      _id: ids.get(id),
      parentIds: (person.parentIds || []).map(parentId => ids.get(parentId)).filter(Boolean),
      partnerIds: (person.partnerIds || []).map(partnerId => ids.get(partnerId)).filter(Boolean),
      ...(extendedIds.has(id) ? { seedKey: `ashford-extended-v1:${id}` } : {})
    }));
    await Person.insertMany(docs);
  } else {
    const keys = addedPeople.map(person => `ashford-extended-v1:${person.id}`);
    const existing = await Person.find({ seedKey: { $in: keys } }).select('seedKey');
    const ids = new Map(existing.map(person => [person.seedKey.slice('ashford-extended-v1:'.length), person._id]));
    addedPeople.forEach(person => { if (!ids.has(person.id)) ids.set(person.id, new mongoose.Types.ObjectId()); });
    const missing = addedPeople.filter(person => !existing.some(row => row.seedKey === `ashford-extended-v1:${person.id}`));
    if (missing.length) await Person.insertMany(missing.map(({ id, ...person }) => ({
      ...person,
      _id: ids.get(id),
      seedKey: `ashford-extended-v1:${id}`,
      parentIds: (person.parentIds || []).map(parentId => ids.get(parentId)).filter(Boolean),
      partnerIds: []
    })));
    const william = await Person.findOne({ firstName: 'William', lastName: 'Ashford', birthDate: new Date('1928-06-14') });
    const margaret = await Person.findOne({ firstName: 'Margaret', lastName: 'Ashford', birthDate: new Date('1931-02-08') });
    if (william) await Person.updateOne({ _id: william._id }, { $addToSet: { parentIds: ids.get('ashford-f-1') } });
    if (margaret) await Person.updateOne({ _id: margaret._id }, { $addToSet: { parentIds: ids.get('ashford-m-1') } });
  }
  res.json({ added: addedPeople.length, total: await Person.countDocuments() });
} catch (e) { next(e); } });
app.get('/api/people/:id', async (req, res, next) => { try { const person = await Person.findById(req.params.id); if (!person) return res.status(404).json({ error: 'Person not found' }); res.json(person); } catch (e) { next(e); } });
app.patch('/api/people/layout/reset', async (_req, res, next) => { try { const result = await Person.updateMany({}, { $set: { treeX: null, treeY: null } }); res.json({ modifiedCount: result.modifiedCount }); } catch (e) { next(e); } });
app.patch('/api/people/layout/positions', async (req, res, next) => { try {
  const positions = Array.isArray(req.body?.positions) ? req.body.positions : [];
  const operations = positions.filter(position => position.id && Number.isFinite(position.treeX) && Number.isFinite(position.treeY)).map(position => ({
    updateOne: { filter: { _id: position.id }, update: { $set: { treeX: position.treeX, treeY: position.treeY } } }
  }));
  if (operations.length) await Person.bulkWrite(operations);
  res.json({ modifiedCount: operations.length });
} catch (e) { next(e); } });
async function syncPartners(person) {
  await Person.updateMany({ partnerIds: person._id }, { $pull: { partnerIds: person._id } });
  if (person.partnerIds.length) await Person.updateMany({ _id: { $in: person.partnerIds } }, { $addToSet: { partnerIds: person._id } });
}
app.post('/api/people', async (req, res, next) => { try { const person = await Person.create(req.body); await syncPartners(person); res.status(201).json(person); } catch (e) { next(e); } });
app.patch('/api/people/:id', async (req, res, next) => { try { const person = await Person.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!person) return res.status(404).json({ error: 'Person not found' }); await syncPartners(person); res.json(person); } catch (e) { next(e); } });
app.delete('/api/people/:id', async (req, res, next) => { try { const person = await Person.findByIdAndDelete(req.params.id); if (!person) return res.status(404).json({ error: 'Person not found' }); await Person.updateMany({ $or: [{ parentIds: person._id }, { partnerIds: person._id }] }, { $pull: { parentIds: person._id, partnerIds: person._id } }); res.status(204).end(); } catch (e) { next(e); } });
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}
app.use((err, _req, res, _next) => { console.error(err); res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message || 'Server error' }); });
const port = process.env.PORT || 4000;
if (process.env.MONGODB_URI) mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB connected')).catch(err => console.error('MongoDB connection failed:', err.message));
app.listen(port, () => console.log(`Kinfolk API listening on ${port}`));
