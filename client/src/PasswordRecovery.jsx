import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { apiUrl } from './apiClient.js';

export default function PasswordRecovery({ token, onBack, onResetComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const resetting = Boolean(token) || codeSent;
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function requestCode() {
    const response = await fetch(apiUrl('/api/auth/forgot-password'), {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Could not request a reset code.');
    setCodeSent(true); setCooldown(60); setCode('');
    return result;
  }
  async function resend() {
    setBusy(true); setError('');
    try { await requestCode(); }
    catch (e) { setError(e.message || 'Could not reach the account service.'); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (resetting && password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      if (!resetting) { await requestCode(); return; }
      const response = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token, password } : { email, code, password }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not complete password recovery.');
      setMessage(result.message);
      setPassword(''); setConfirmation('');
      onResetComplete();
    } catch (e) { setError(e.message || 'Could not reach the account service.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="auth-form-heading"><span>ACCOUNT RECOVERY</span><h2>{resetting ? 'Choose a new password' : 'Forgot your password?'}</h2><p>{resetting ? 'Use at least 8 characters. Your other sessions will be signed out.' : 'Enter the email address you used to create your account.'}</p></div>
    {!message && <form className="auth-form" onSubmit={submit}>
      {resetting ? <>
        {!token && <>
          <p role="status">If an account exists for {email}, a 6-digit code will arrive shortly. Check your inbox and spam folder. It expires after 5 minutes.</p>
          <label className="auth-field"><span>Reset code</span><span className="auth-input-wrap"><input aria-label="6-digit reset code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus /></span></label>
        </>}
        <label className="auth-field"><span>New password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required autoFocus /></span></label>
        <label className="auth-field"><span>Confirm new password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></span></label>
      </> : <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required autoFocus /></span></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}><span>{busy ? 'Please wait…' : resetting ? 'Update password' : 'Send reset code'}</span>{!busy && <ArrowRight size={17} />}</button>
      {codeSent && !token && <p className="auth-mode-switch"><button type="button" disabled={busy || cooldown > 0} onClick={resend}>{cooldown ? `Request another code in ${cooldown}s` : 'Request another code'}</button><button type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); setPassword(''); setConfirmation(''); setError(''); }}>Use a different email</button></p>}
    </form>}
    {message && <p className="auth-recovery-success" role="status">{message}</p>}
    <p className="auth-mode-switch"><button type="button" disabled={busy} onClick={onBack}>Back to sign in</button></p>
  </>;
}
