import { Router, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireTree } from '../middleware/treeAccess.js';
import { uploadPhoto, getPhoto, removeUnusedPhoto } from '../controllers/photoController.js';

export function createPhotoRouter() {
  const router = Router();
  const uploadLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many photo uploads. Please try again later.' } });
  router.post('/', requireTree, uploadLimit, raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '1mb' }), uploadPhoto);
  router.get('/:id', getPhoto);
  router.delete('/:id', requireTree, removeUnusedPhoto);
  return router;
}
