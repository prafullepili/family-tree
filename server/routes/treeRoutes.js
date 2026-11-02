import { Router } from 'express';
import { listTrees, createTree, acceptInvitation, listMembers, updateMember, removeMember, listInvitations, createInvitation, revokeInvitation, listActivity, listDeletedPeople, restorePerson } from '../controllers/treeController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireTree, ownerOnly } from '../middleware/treeAccess.js';
export function createTreeRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get("/", listTrees);
  router.post("/", createTree);
  router.post("/accept-invitation", acceptInvitation);
  router.use('/:treeId', requireTree);
  router.get("/:treeId/members", listMembers);
  router.patch("/:treeId/members/:memberId", ownerOnly, updateMember);
  router.delete("/:treeId/members/:memberId", ownerOnly, removeMember);
  router.get("/:treeId/invitations", ownerOnly, listInvitations);
  router.post("/:treeId/invitations", ownerOnly, createInvitation);
  router.delete("/:treeId/invitations/:invitationId", ownerOnly, revokeInvitation);
  router.get("/:treeId/activity", listActivity);
  router.get("/:treeId/recycle-bin", listDeletedPeople);
  router.post("/:treeId/recycle-bin/:personId/restore", restorePerson);
  return router;
}
