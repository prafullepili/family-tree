import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
export function createHealthRouter() {
  const router = Router();
  router.get('/', getHealth);
  return router;
}
