import mongoose from 'mongoose';
import { pipeline } from 'node:stream/promises';
import Person from '../models/Person.js';
import { TreeMembership } from '../models/treeModels.js';
import { MAX_PHOTO_BYTES, detectPhotoType, photoBucket, photoPath } from '../services/personPhotoService.js';

export async function uploadPhoto(req, res, next) {
  try {
    const type = detectPhotoType(req.body);
    if (!type || !req.body.length) return res.status(415).json({ error: 'Choose a JPEG, PNG, or WebP image.' });
    if (req.body.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'The uploaded photo must be 1 MB or smaller.' });
    const upload = photoBucket().openUploadStream(`person-photo.${type.split('/')[1]}`, {
      metadata: { treeId: req.tree._id, uploadedBy: req.user._id, contentType: type },
    });
    await new Promise((resolve, reject) => {
      upload.once('finish', resolve); upload.once('error', reject); upload.end(req.body);
    });
    res.status(201).json({ photoUrl: photoPath(upload.id) });
  } catch (error) { next(error); }
}

export async function getPhoto(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
    const bucket = photoBucket();
    const file = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.id) }).next();
    if (!file) return res.status(404).end();
    const membership = await TreeMembership.exists({ treeId: file.metadata.treeId, userId: req.user._id });
    if (!membership) return res.status(403).end();
    res.setHeader('Content-Type', file.metadata.contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    await pipeline(bucket.openDownloadStream(file._id), res);
  } catch (error) { if (!res.headersSent) next(error); }
}

export async function removeUnusedPhoto(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
    const bucket = photoBucket();
    const file = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.id), 'metadata.treeId': req.tree._id }).next();
    if (!file) return res.status(404).end();
    if (await Person.exists({ photoUrl: photoPath(file._id) })) return res.status(409).json({ error: 'This photo is still used by a family member.' });
    await bucket.delete(file._id);
    res.status(204).end();
  } catch (error) { next(error); }
}
