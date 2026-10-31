import { useCallback, useEffect, useState } from 'react';
import TreeWorkspace from './TreeWorkspace.jsx';
import LoginPage from './LoginPage.jsx';
import { apiUrl, resetFamilyDataRequest, setAuthCsrfToken } from './apiClient.js';

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Error(body?.error || 'Something went wrong. Please try again.');
  return body;
}

export default function AuthApp() {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('checking');
  const [authError, setAuthError] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('kinfolk-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.getElementById('boot-screen')?.remove();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('kinfolk-theme', theme);
    } catch {
      // Theme still applies for this page when browser storage is disabled.
    }
  }, [theme]);

  const clearSession = useCallback((message = '') => {
    setAuthCsrfToken('');
    resetFamilyDataRequest();
    setSession(null);
    setStatus('signed-out');
    setAuthError(message);
  }, []);

  const acceptSession = useCallback((payload) => {
    setAuthCsrfToken(payload.csrfToken);
    resetFamilyDataRequest();
    setSession(payload);
    setAuthError('');
    setStatus('signed-in');
  }, []);

  const checkSession = useCallback(async () => {
    setStatus('checking');
    setAuthError('');
    try {
      const [configResult, sessionResult] = await Promise.allSettled([
        fetch(apiUrl('/api/auth/config'), { credentials: 'include', cache: 'no-store' }).then(readJson),
        fetch(apiUrl('/api/auth/me'), { credentials: 'include', cache: 'no-store' }).then(readJson),
      ]);
      if (configResult.status === 'fulfilled') setGoogleClientId(configResult.value.googleClientId || '');
      if (sessionResult.status === 'fulfilled') acceptSession(sessionResult.value);
      else clearSession(sessionResult.reason?.message === 'Please sign in to continue.' ? '' : sessionResult.reason?.message || '');
    } catch (error) {
      clearSession(error.message || 'Could not reach the account service.');
    }
  }, [acceptSession, clearSession]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession('Your session expired. Sign in again to continue.');
    window.addEventListener('kinfolk:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kinfolk:unauthorized', handleUnauthorized);
  }, [clearSession]);

  async function authenticate(path, values) {
    setAuthError('');
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const payload = await readJson(response);
    acceptSession(payload);
  }

  async function logout() {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': session?.csrfToken || '' },
      });
    } finally {
      window.google?.accounts?.id?.disableAutoSelect?.();
      clearSession();
    }
  }

  if (status === 'checking') {
    return (
      <main className="auth-loading" aria-live="polite">
        <span className="auth-loading-mark" aria-hidden="true">V</span>
        <div className="auth-loading-spinner" />
        <p>Opening your family archive…</p>
      </main>
    );
  }

  if (status !== 'signed-in' || !session?.user) {
    return (
      <LoginPage
        error={authError}
        googleClientId={googleClientId}
        theme={theme}
        onThemeChange={setTheme}
        onLogin={(values) => authenticate('/api/auth/login', values)}
        onRegister={(values) => authenticate('/api/auth/register', values)}
        onGoogle={(credential) => authenticate('/api/auth/google', { credential })}
        onRetry={checkSession}
      />
    );
  }

  return <TreeWorkspace key={session.user.id} user={session.user} onLogout={logout} />;
}
