import cors from 'cors';
import { recordActivity } from '../services/treeService.js';
export function createCorsMiddleware() {
  const configuredOrigins = String(process.env.CLIENT_ORIGIN || '').split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean);
  return cors({
    credentials: true,
    origin(origin, callback) {
      const developmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+):5173$/i;
      const allowed = !origin || configuredOrigins.includes(origin) || process.env.NODE_ENV !== 'production' && developmentOrigin.test(origin);
      callback(null, allowed);
    }
  });
}
export const securityHeaders = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};
export const auditChanges = (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.on('finish', () => {
      const path = req.originalUrl.split('?')[0];
      const action = path.includes('/layouts') ? {
        POST: 'Saved view',
        DELETE: 'Removed saved view'
      }[req.method] || 'Updated view' : path.endsWith('/positions') ? 'Moved people' : path.endsWith('/reset') ? 'Reset positions' : path.endsWith('/import') ? 'Imported people' : {
        POST: 'Added person',
        PATCH: 'Updated person',
        DELETE: 'Moved people to recycle bin'
      }[req.method] || 'Updated tree';
      if (res.statusCode < 400) recordActivity(req, action, String(req.body?.firstName || req.body?.name || '')).catch(error => console.error('Activity log failed:', error.message));
    });
  }
  next();
};
export const errorHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(['ValidationError', 'CastError'].includes(err.name) ? 400 : 500).json({
    error: err.name === 'CastError' ? 'Invalid record identifier.' : err.message || 'Server error'
  });
};
