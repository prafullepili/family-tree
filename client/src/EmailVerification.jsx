import { useEffect, useState } from 'react';
import { apiUrl } from './apiClient.js';

export default function EmailVerification({ email, initialError, onVerify, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(initialError ? 0 : 60);
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function verify(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onVerify({ email, code }); }
    catch (e) { setError(e.message || 'Could not verify the code.'); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(apiUrl('/api/auth/resend-verification'), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not request a code.');
      setMessage(result.message); setCooldown(60); setCode('');
    } catch (e) { setError(e.message || 'Could not reach the account service.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="auth-form-heading"><span>VERIFY YOUR EMAIL</span><h2>Check your inbox</h2><p>Enter the 6-digit code for {email}. Codes expire after 5 minutes.</p></div>
    <form className="auth-form" onSubmit={verify}>
      <label className="auth-field"><span>Verification code</span><span className="auth-input-wrap">
        <input aria-label="6-digit verification code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus />
      </span></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {message && <p role="status">{message}</p>}
      <button className="auth-submit" disabled={busy || code.length !== 6}>{busy ? 'Please wait…' : 'Verify and continue'}</button>
    </form>
    <p className="auth-mode-switch"><button type="button" disabled={busy || cooldown > 0} onClick={resend}>{cooldown ? `Request another code in ${cooldown}s` : 'Request another code'}</button></p>
    <p className="auth-mode-switch"><button type="button" disabled={busy} onClick={onBack}>Back to sign in</button></p>
  </>;
}
