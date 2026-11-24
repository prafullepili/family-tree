import { Router } from 'express';
import { listPeople, getPerson, resetPositions, savePositions, deletePeople, importPeople, acceptPersonMergeInvitation, listLinkedFamilies, refreshLinkedFamilyController, disconnectLinkedFamilyController, createPerson, updatePerson, deletePerson } from '../controllers/personController.js';
export function createPersonRouter() {
  const router = Router();
  router.get('/linked-families', listLinkedFamilies);
  router.post('/linked-families/:linkId/refresh', refreshLinkedFamilyController);
  router.delete('/linked-families/:linkId', disconnectLinkedFamilyController);
  router.get("/", listPeople);
  router.get("/:id", getPerson);
  router.patch("/layout/reset", resetPositions);
  router.patch("/layout/positions", savePositions);
  router.delete("/batch", deletePeople);
  router.post("/import", importPeople);
  router.post("/accept-merge-invitation", acceptPersonMergeInvitation);
  router.post("/", createPerson);
  router.patch("/:id", updatePerson);
  router.delete("/:id", deletePerson);
  return router;
}
