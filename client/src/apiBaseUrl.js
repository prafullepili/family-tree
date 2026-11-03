export function resolveApiBaseUrl({ hostname = '', configuredUrl = '', production = false } = {}) {
  const host = hostname.toLowerCase();
  // Locally served builds must use the same API as the local login cookie.
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) return '';
  return String(configuredUrl || (production ? 'https://family-tree-t6j3.onrender.com' : '')).replace(/\/$/, '');
}
