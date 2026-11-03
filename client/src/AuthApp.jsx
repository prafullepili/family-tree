import { useCallback, useEffect, useRef, useState } from 'react';
import TreeWorkspace from './TreeWorkspace.jsx';
import LoginPage from './LoginPage.jsx';
import { apiUrl, resetFamilyDataRequest, setAuthCsrfToken } from './apiClient.js';

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Error(body?.error || 'Something went wrong. Please try again.');
  return body;
}

export default function AuthApp() {
  const authRequestVersion = useRef(0);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('checking');
  const [authError, setAuthError] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reset-password') || '');
  function clearResetLink() {
    setResetToken('');
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', url);
  }
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('kinfolk-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
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
    authRequestVersion.current += 1;
    setAuthCsrfToken('');
    resetFamilyDataRequest();
    setSession(null);
    setStatus('signed-out');
    setAuthError(message);
  }, []);

  const acceptSession = useCallback((payload) => {
    authRequestVersion.current += 1;
    setAuthCsrfToken(payload.csrfToken);
    resetFamilyDataRequest();
    setSession(payload);
    setAuthError('');
    setVerificationEmail('');
    setStatus('signed-in');
  }, []);

  const checkSession = useCallback(async () => {
    const requestVersion = ++authRequestVersion.current;
    setStatus('checking');
    setAuthError('');
    try {
      const [configResult, sessionResult] = await Promise.allSettled([
        fetch(apiUrl('/api/auth/config'), { credentials: 'include', cache: 'no-store' }).then(readJson),
        fetch(apiUrl('/api/auth/me'), { credentials: 'include', cache: 'no-store' }).then(readJson),
      ]);
      if (requestVersion !== authRequestVersion.current) return;
      if (configResult.status === 'fulfilled') setGoogleClientId(configResult.value.googleClientId || '');
      if (sessionResult.status === 'fulfilled') acceptSession(sessionResult.value);
      else clearSession(sessionResult.reason?.message === 'Please sign in to continue.' ? '' : sessionResult.reason?.message || '');
    } catch (error) {
      if (requestVersion !== authRequestVersion.current) return;
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
    // A pending startup check must never replace a newer sign-in result.
    const requestVersion = ++authRequestVersion.current;
    setAuthError('');
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const payload = await response.json().catch(() => null);
    if (requestVersion !== authRequestVersion.current) return;
    if (payload?.verificationRequired) {
      setVerificationEmail(payload.email);
      setAuthError(payload.error || '');
      return;
    }
    if (!response.ok || !payload?.user) throw Error(payload?.error || 'Could not sign in.');
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

  if (resetToken || status !== 'signed-in' || !session?.user) {
    return (
      <LoginPage
        verificationEmail={verificationEmail}
        onVerifyEmail={(values) => authenticate('/api/auth/verify-email', values)}
        onExitVerification={() => { setVerificationEmail(''); setAuthError(''); }}
        resetToken={resetToken}
        onResetComplete={() => {
          clearSession();
          const url = new URL(window.location.href);
          url.hash = '';
          window.history.replaceState(null, '', url);
        }}
        onExitRecovery={clearResetLink}
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
