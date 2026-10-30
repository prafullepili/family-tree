const API_BASE_URL = String(import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export const apiUrl = (path) => `${API_BASE_URL}${path}`;

let initialFamilyRequest;

async function parseResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw Error(body?.error || fallbackMessage);
  return body;
}

// React StrictMode runs mount effects twice in development. Keeping the
// bootstrap promise at module scope lets both effect runs share one network
// sequence while each run can still apply the result independently.
export function loadInitialFamilyData() {
  if (!initialFamilyRequest) {
    initialFamilyRequest = (async () => {
      const healthResponse = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
      const health = await parseResponse(healthResponse, 'Could not reach the family API');
      if (!health.configured) return { mode: 'demo', rows: [] };
      if (health.database !== 'connected') throw Error('MongoDB is currently disconnected');
      const peopleResponse = await fetch(apiUrl('/api/people'), { cache: 'no-store' });
      const rows = await parseResponse(peopleResponse, 'Could not load family data');
      return { mode: 'connected', rows };
    })();
  }
  return initialFamilyRequest;
}

export async function loadRemoteFamilyData() {
  const healthResponse = await fetch(apiUrl('/api/health'), { cache: 'no-store' });
  const health = await parseResponse(healthResponse, 'Could not reach the family API');
  if (!health.configured) throw Error('MongoDB is not configured for this app');
  if (health.database !== 'connected') throw Error('MongoDB is currently disconnected');
  const peopleResponse = await fetch(apiUrl('/api/people'), { cache: 'no-store' });
  return parseResponse(peopleResponse, 'Could not load family data');
}
