const API_BASE_URL = String(import.meta.env?.VITE_API_URL || (import.meta.env?.PROD ? 'https://family-tree-t6j3.onrender.com' : '')).replace(/\/$/, '');

export const apiUrl = (path) => `${API_BASE_URL}${path}`;

let initialFamilyRequest;
let initialFamilyRequestKey = '';
let csrfToken = '';

export function setAuthCsrfToken(token) {
  csrfToken = String(token || '');
}

export function resetFamilyDataRequest() {
  initialFamilyRequest = undefined;
  initialFamilyRequestKey = '';
}

export async function apiFetch(input, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(input, { ...options, method, headers, credentials: 'include' });
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kinfolk:unauthorized'));
  return response;
}

async function parseResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw Error(body?.error || fallbackMessage);
  return body;
}

// React StrictMode runs mount effects twice in development. Keeping the
// bootstrap promise at module scope lets both effect runs share one network
// sequence while each run can still apply the result independently.
export function loadInitialFamilyData(sessionKey = '') {
  if (!initialFamilyRequest || initialFamilyRequestKey !== sessionKey) {
    initialFamilyRequestKey = sessionKey;
    initialFamilyRequest = (async () => {
      const healthResponse = await apiFetch(apiUrl('/api/health'), { cache: 'no-store' });
      const health = await parseResponse(healthResponse, 'Could not reach the family API');
      if (!health.configured) return { mode: 'demo', rows: [] };
      if (health.database !== 'connected') throw Error('MongoDB is currently disconnected');
      const peopleResponse = await apiFetch(apiUrl('/api/people'), { cache: 'no-store' });
      const rows = await parseResponse(peopleResponse, 'Could not load family data');
      return { mode: 'connected', rows };
    })();
  }
  return initialFamilyRequest;
}

export async function loadRemoteFamilyData() {
  const healthResponse = await apiFetch(apiUrl('/api/health'), { cache: 'no-store' });
  const health = await parseResponse(healthResponse, 'Could not reach the family API');
  if (!health.configured) throw Error('MongoDB is not configured for this app');
  if (health.database !== 'connected') throw Error('MongoDB is currently disconnected');
  const peopleResponse = await apiFetch(apiUrl('/api/people'), { cache: 'no-store' });
  return parseResponse(peopleResponse, 'Could not load family data');
}
