import './config/environment.js';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { workspaceDir } from './config/environment.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createTreeRouter } from './routes/treeRoutes.js';
import { createPersonRouter } from './routes/personRoutes.js';
import { createLayoutRouter } from './routes/layoutRoutes.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { requireAuth } from './middleware/auth.js';
import { requireTree } from './middleware/treeAccess.js';
import { createCorsMiddleware, securityHeaders, auditChanges, errorHandler } from './middleware/http.js';
export const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || (process.env.NODE_ENV === 'production' ? 1 : 0)));
app.use(createCorsMiddleware());
app.use(express.json({
  limit: '2mb'
}));
app.use('/api', securityHeaders);
app.use('/api/health', createHealthRouter());
app.use('/api/auth', createAuthRouter());
app.use('/api/trees', createTreeRouter());
app.use(['/api/people', '/api/layouts'], requireAuth, requireTree, auditChanges);
app.use('/api/people', createPersonRouter());
app.use('/api/layouts', createLayoutRouter());
const distDir = path.join(workspaceDir, 'client', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}
app.use(errorHandler);
