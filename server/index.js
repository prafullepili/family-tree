import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Person from './models/Person.js';
import TreeLayout from './models/TreeLayout.js';
import AuthSession from './models/AuthSession.js';
import User from './models/User.js';
import { createAuthRouter, requireAuth } from './authRoutes.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(serverDir, '..');
dotenv.config({ path: [path.join(serverDir, '.env'), path.join(workspaceDir, '.env')] });

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || (process.env.NODE_ENV === 'production' ? 1 : 0)));
const configuredOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const developmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+):5173$/i;
      const allowed = !origin || configuredOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && developmentOrigin.test(origin));
      callback(null, allowed);
    },
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    configured: Boolean(process.env.MONGODB_URI),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.readyState === 1 ? mongoose.connection.name : null,
    authentication: 'required',
    googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
  }),
);
app.use('/api/auth', createAuthRouter());
app.use(['/api/people', '/api/layouts'], requireAuth);
app.get('/api/layouts', async (req, res, next) => {
  try {
    const familyId = String(req.query.familyId || '').trim();
    if (!familyId) return res.status(400).json({ error: 'A family id is required.' });
    const personIds = String(req.query.personIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.isValidObjectId(id));
    const filter = personIds.length
      ? { ownerId: req.user._id, $or: [{ familyId }, { 'positions.personId': { $in: personIds } }] }
      : { ownerId: req.user._id, familyId };
    res.json(await TreeLayout.find(filter).sort({ updatedAt: -1 }));
  } catch (e) {
    next(e);
  }
});
app.post('/api/layouts', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const familyId = String(req.body?.familyId || '').trim();
    const requestedPositions = (Array.isArray(req.body?.positions) ? req.body.positions : [])
      .filter((position) => mongoose.isValidObjectId(position.personId) && Number.isFinite(position.treeX) && Number.isFinite(position.treeY))
      .map((position) => ({ personId: position.personId, treeX: position.treeX, treeY: position.treeY }));
    if (!name) return res.status(400).json({ error: 'A layout name is required.' });
    if (!familyId) return res.status(400).json({ error: 'A family id is required.' });
    if (!requestedPositions.length) return res.status(400).json({ error: 'At least one person position is required.' });
    const ownedPersonIds = new Set(
      (await Person.find({ ownerId: req.user._id, _id: { $in: requestedPositions.map((position) => position.personId) } }).select('_id').lean()).map((person) => String(person._id)),
    );
    const positions = requestedPositions.filter((position) => ownedPersonIds.has(String(position.personId)));
    if (!positions.length) return res.status(400).json({ error: 'The layout does not contain any people from your tree.' });
    const normalizedName = name.toLocaleLowerCase();
    const personIds = positions.map((position) => position.personId);
    const existing = await TreeLayout.findOne({
      ownerId: req.user._id,
      normalizedName,
      $or: [{ familyId }, { 'positions.personId': { $in: personIds } }],
    });
    const values = { ownerId: req.user._id, name, normalizedName, familyId, familyName: String(req.body?.familyName || '').trim(), positions };
    const layout = existing
      ? await TreeLayout.findByIdAndUpdate(existing._id, { $set: values }, { new: true, runValidators: true })
      : await TreeLayout.create(values);
    res.status(201).json(layout);
  } catch (e) {
    next(e);
  }
});
app.delete('/api/layouts/:id', async (req, res, next) => {
  try {
    const layout = await TreeLayout.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
    if (!layout) return res.status(404).json({ error: 'Saved tree view not found.' });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
app.get('/api/people', async (req, res, next) => {
  try {
    res.json(await Person.find({ ownerId: req.user._id }).sort({ birthDate: 1 }));
  } catch (e) {
    next(e);
  }
});
app.get('/api/people/:id', async (req, res, next) => {
  try {
    const person = await Person.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (e) {
    next(e);
  }
});
app.patch('/api/people/layout/reset', async (req, res, next) => {
  try {
    const result = await Person.updateMany({ ownerId: req.user._id }, { $set: { treeX: null, treeY: null } });
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
        updateOne: { filter: { _id: position.id, ownerId: req.user._id }, update: { $set: { treeX: position.treeX, treeY: position.treeY } } },
      }));
    if (operations.length) await Person.bulkWrite(operations);
    res.json({ modifiedCount: operations.length });
  } catch (e) {
    next(e);
  }
});
app.delete('/api/people/batch', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.filter((id) => mongoose.isValidObjectId(id)))] : [];
    if (!ids.length) return res.status(400).json({ error: 'At least one person id is required.' });
    const ownedIds = (await Person.find({ _id: { $in: ids }, ownerId: req.user._id }).select('_id').lean()).map((person) => person._id);
    const result = await Person.deleteMany({ _id: { $in: ownedIds }, ownerId: req.user._id });
    await Person.updateMany(
      { ownerId: req.user._id, $or: [{ parentIds: { $in: ownedIds } }, { partnerIds: { $in: ownedIds } }, { siblingIds: { $in: ownedIds } }, { 'partnerRelationships.partnerId': { $in: ownedIds } }, { 'relationshipLinks.personId': { $in: ownedIds } }] },
      { $pull: { parentIds: { $in: ownedIds }, partnerIds: { $in: ownedIds }, siblingIds: { $in: ownedIds }, partnerRelationships: { partnerId: { $in: ownedIds } }, relationshipLinks: { personId: { $in: ownedIds } } } },
    );
    await TreeLayout.updateMany({ ownerId: req.user._id }, { $pull: { positions: { personId: { $in: ownedIds } } } });
    res.json({ deletedCount: result.deletedCount });
  } catch (e) {
    next(e);
  }
});
app.post('/api/people/import', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.people) ? req.body.people.slice(0, 5000) : [];
    if (!rows.length) return res.status(400).json({ error: 'The import contains no people.' });
    const validRows = rows.filter((row) => String(row.firstName || '').trim());
    if (!validRows.length) return res.status(400).json({ error: 'Every imported person needs a first name.' });

    const referencedIds = new Set();
    validRows.forEach((row) => {
      [row.sourceId, ...(row.parentIds || []), ...(row.partnerIds || []), ...(row.siblingIds || []), ...(row.partnerRelationships || []).map((link) => link.partnerId), ...(row.relationshipLinks || []).map((link) => link.personId)]
        .filter((id) => mongoose.isValidObjectId(id))
        .forEach((id) => referencedIds.add(String(id)));
    });
    const existingIds = new Set((await Person.find({ ownerId: req.user._id, _id: { $in: [...referencedIds] } }).select('_id').lean()).map((person) => String(person._id)));
    const idMap = new Map();
    validRows.forEach((row, index) => {
      const sourceId = String(row.sourceId || `row-${index + 1}`);
      if (!idMap.has(sourceId)) idMap.set(sourceId, existingIds.has(sourceId) ? new mongoose.Types.ObjectId(sourceId) : new mongoose.Types.ObjectId());
    });
    const remapId = (id) => {
      const key = String(id || '');
      if (idMap.has(key)) return idMap.get(key);
      return existingIds.has(key) ? new mongoose.Types.ObjectId(key) : null;
    };
    const cleanDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const operations = validRows.map((row, index) => {
      const sourceId = String(row.sourceId || `row-${index + 1}`);
      const targetId = idMap.get(sourceId);
      const values = {
        ownerId: req.user._id,
        firstName: String(row.firstName || '').trim(),
        lastName: String(row.lastName || '').trim(),
        maidenName: String(row.maidenName || '').trim(),
        gender: ['female', 'male', 'nonbinary', 'unspecified'].includes(row.gender) ? row.gender : 'unspecified',
        birthDate: cleanDate(row.birthDate),
        deathDate: cleanDate(row.deathDate),
        birthPlace: String(row.birthPlace || '').trim(),
        occupation: String(row.occupation || '').trim(),
        bio: String(row.bio || '').trim(),
        notes: String(row.notes || '').trim(),
        photoUrl: String(row.photoUrl || '').trim(),
        parentIds: [...new Set((row.parentIds || []).map(remapId).filter(Boolean).map(String))].slice(0, 2),
        partnerIds: [...new Set((row.partnerIds || []).map(remapId).filter(Boolean).map(String))],
        siblingIds: [...new Set((row.siblingIds || []).map(remapId).filter(Boolean).map(String))],
        partnerRelationships: (row.partnerRelationships || []).map((link) => ({ partnerId: remapId(link.partnerId), label: String(link.label || '').trim() })).filter((link) => link.partnerId),
        relationshipLinks: (row.relationshipLinks || []).map((link) => ({ personId: remapId(link.personId), label: String(link.label || '').trim() })).filter((link) => link.personId && link.label),
        treeX: Number.isFinite(row.treeX) ? row.treeX : null,
        treeY: Number.isFinite(row.treeY) ? row.treeY : null,
      };
      return { updateOne: { filter: { _id: targetId, ownerId: req.user._id }, update: { $set: values }, upsert: true } };
    });
    await Person.bulkWrite(operations, { ordered: false });
    res.json({ importedCount: operations.length });
  } catch (e) {
    next(e);
  }
});
async function sanitizeOwnedRelationships(values, ownerId, currentPersonId = null) {
  const allowedFields = [
    'firstName',
    'lastName',
    'maidenName',
    'gender',
    'birthDate',
    'deathDate',
    'birthPlace',
    'photoUrl',
    'bio',
    'occupation',
    'notes',
    'seedKey',
    'treeX',
    'treeY',
    'parentIds',
    'partnerIds',
    'siblingIds',
    'partnerRelationships',
    'relationshipLinks',
  ];
  const safeValues = Object.fromEntries(allowedFields.filter((field) => Object.hasOwn(values, field)).map((field) => [field, values[field]]));
  const relationshipIds = [
    ...(Array.isArray(values.parentIds) ? values.parentIds : []),
    ...(Array.isArray(values.partnerIds) ? values.partnerIds : []),
    ...(Array.isArray(values.siblingIds) ? values.siblingIds : []),
    ...(Array.isArray(values.partnerRelationships) ? values.partnerRelationships.map((link) => link?.partnerId) : []),
    ...(Array.isArray(values.relationshipLinks) ? values.relationshipLinks.map((link) => link?.personId) : []),
  ].filter((id) => mongoose.isValidObjectId(id) && String(id) !== String(currentPersonId || ''));
  const ownedIds = new Set((await Person.find({ ownerId, _id: { $in: relationshipIds } }).select('_id').lean()).map((person) => String(person._id)));
  const filterIds = (ids) => [...new Set(ids.filter((id) => ownedIds.has(String(id))).map(String))];
  if (Array.isArray(values.parentIds)) safeValues.parentIds = filterIds(values.parentIds).slice(0, 2);
  if (Array.isArray(values.partnerIds)) safeValues.partnerIds = filterIds(values.partnerIds);
  if (Array.isArray(values.siblingIds)) safeValues.siblingIds = filterIds(values.siblingIds);
  if (Array.isArray(values.partnerRelationships)) {
    safeValues.partnerRelationships = values.partnerRelationships
      .filter((link) => ownedIds.has(String(link?.partnerId)))
      .map((link) => ({ partnerId: link.partnerId, label: String(link.label || '').trim() }));
  }
  if (Array.isArray(values.relationshipLinks)) {
    safeValues.relationshipLinks = values.relationshipLinks
      .filter((link) => ownedIds.has(String(link?.personId)) && String(link?.label || '').trim())
      .map((link) => ({ personId: link.personId, label: String(link.label || '').trim() }));
  }
  return safeValues;
}

async function syncPartners(person, ownerId) {
  await Person.updateMany(
    { ownerId, $or: [{ partnerIds: person._id }, { 'partnerRelationships.partnerId': person._id }] },
    { $pull: { partnerIds: person._id, partnerRelationships: { partnerId: person._id } } },
  );
  await Promise.all(
    person.partnerIds.map(async (partnerId) => {
      const label = person.partnerRelationships.find((link) => String(link.partnerId) === String(partnerId))?.label || '';
      await Person.updateOne({ _id: partnerId, ownerId }, { $addToSet: { partnerIds: person._id }, $pull: { partnerRelationships: { partnerId: person._id } } });
      if (label) await Person.updateOne({ _id: partnerId, ownerId }, { $push: { partnerRelationships: { partnerId: person._id, label } } });
    }),
  );
}
async function syncSiblings(person, ownerId) {
  await Person.updateMany({ ownerId, siblingIds: person._id }, { $pull: { siblingIds: person._id } });
  await Promise.all((person.siblingIds || []).map((siblingId) => Person.updateOne({ _id: siblingId, ownerId }, { $addToSet: { siblingIds: person._id } })));
}
async function syncRelationshipLinks(person, ownerId) {
  await Person.updateMany({ ownerId, 'relationshipLinks.personId': person._id }, { $pull: { relationshipLinks: { personId: person._id } } });
  await Promise.all((person.relationshipLinks || []).map((link) => Person.updateOne({ _id: link.personId, ownerId }, { $push: { relationshipLinks: { personId: person._id, label: link.label } } })));
}
app.post('/api/people', async (req, res, next) => {
  try {
    const values = await sanitizeOwnedRelationships(req.body || {}, req.user._id);
    const person = await Person.create({ ...values, ownerId: req.user._id });
    await syncPartners(person, req.user._id);
    await syncSiblings(person, req.user._id);
    await syncRelationshipLinks(person, req.user._id);
    res.status(201).json(person);
  } catch (e) {
    next(e);
  }
});
app.patch('/api/people/:id', async (req, res, next) => {
  try {
    const values = await sanitizeOwnedRelationships(req.body || {}, req.user._id, req.params.id);
    const person = await Person.findOneAndUpdate({ _id: req.params.id, ownerId: req.user._id }, values, { new: true, runValidators: true });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    await syncPartners(person, req.user._id);
    await syncSiblings(person, req.user._id);
    await syncRelationshipLinks(person, req.user._id);
    res.json(person);
  } catch (e) {
    next(e);
  }
});
app.delete('/api/people/:id', async (req, res, next) => {
  try {
    const person = await Person.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    await Person.updateMany(
      { ownerId: req.user._id, $or: [{ parentIds: person._id }, { partnerIds: person._id }, { siblingIds: person._id }, { 'partnerRelationships.partnerId': person._id }, { 'relationshipLinks.personId': person._id }] },
      { $pull: { parentIds: person._id, partnerIds: person._id, siblingIds: person._id, partnerRelationships: { partnerId: person._id }, relationshipLinks: { personId: person._id } } },
    );
    await TreeLayout.updateMany({ ownerId: req.user._id }, { $pull: { positions: { personId: person._id } } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
const distDir = path.join(workspaceDir, 'client', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.name === 'ValidationError' ? 400 : 500).json({ error: err.message || 'Server error' });
});
const port = process.env.PORT || 4000;
async function initializeDatabase() {
  await Promise.all([User.init(), AuthSession.init(), Person.init()]);
  const indexes = await TreeLayout.collection.indexes().catch((error) => {
    if (error?.code === 26) return [];
    throw error;
  });
  const legacyLayoutIndex = indexes.find(
    (index) => index.unique && index.key?.familyId === 1 && index.key?.normalizedName === 1 && !Object.hasOwn(index.key, 'ownerId'),
  );
  if (legacyLayoutIndex) await TreeLayout.collection.dropIndex(legacyLayoutIndex.name);
  await TreeLayout.createIndexes();
}
if (process.env.MONGODB_URI)
  mongoose
    .connect(process.env.MONGODB_URI, { dbName: 'familytree' })
    .then(async () => {
      await initializeDatabase();
      console.log(`MongoDB connected to ${mongoose.connection.name}`);
    })
    .catch((err) => console.error('MongoDB connection failed:', err.message));
app.listen(port, () => console.log(`VanshLink API listening on ${port}`));
