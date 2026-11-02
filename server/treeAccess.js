// Compatibility exports for existing imports and integration tests.
export { FamilyTree, TreeMembership, TreeInvitation, TreeActivity } from './models/treeModels.js';
export { recordActivity, ensurePersonalTree, canWrite } from './services/treeService.js';
export { requireTree } from './middleware/treeAccess.js';
export { createTreeRouter } from './routes/treeRoutes.js';
