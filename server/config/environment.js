import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const workspaceDir = path.resolve(serverDir, '..');
dotenv.config({
  path: [path.join(serverDir, '.env'), path.join(workspaceDir, '.env')]
});
