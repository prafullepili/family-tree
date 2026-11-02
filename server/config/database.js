import Person from '../models/Person.js';
import TreeLayout from '../models/TreeLayout.js';
import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';
import { FamilyTree, TreeMembership, TreeInvitation, TreeActivity } from '../models/treeModels.js';
export async function initializeDatabase() {
  await Promise.all([User.init(), AuthSession.init(), Person.init(), FamilyTree.init(), TreeMembership.init(), TreeInvitation.init(), TreeActivity.init()]);
  const indexes = await TreeLayout.collection.indexes().catch(error => {
    if (error?.code === 26) return [];
    throw error;
  });
  const legacyLayoutIndex = indexes.find(index => index.unique && index.key?.familyId === 1 && index.key?.normalizedName === 1 && !Object.hasOwn(index.key, 'treeId'));
  if (legacyLayoutIndex) await TreeLayout.collection.dropIndex(legacyLayoutIndex.name);
  await TreeLayout.createIndexes();
}
