import { Router } from 'express';
import { listLayouts, saveLayout, deleteLayout } from '../controllers/layoutController.js';
export function createLayoutRouter() {
  const router = Router();
  router.get("/", listLayouts);
  router.post("/", saveLayout);
  router.delete("/:id", deleteLayout);
  return router;
}
