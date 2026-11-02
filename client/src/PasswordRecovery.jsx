import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { apiUrl } from './apiClient.js';

export default function PasswordRecovery({ token, onBack, onResetComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (token && password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(apiUrl(`/api/auth/${token ? 'reset-password' : 'forgot-password'}`), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token, password } : { email }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not complete password recovery.');
      setMessage(result.message);
      setPassword(''); setConfirmation('');
      if (token) onResetComplete();
    } catch (e) { setError(e.message || 'Could not reach the account service.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="auth-form-heading"><span>ACCOUNT RECOVERY</span><h2>{token ? 'Choose a new password' : 'Forgot your password?'}</h2><p>{token ? 'Use at least 8 characters. Your other sessions will be signed out.' : 'Enter the email address you used to create your account.'}</p></div>
    {!message && <form className="auth-form" onSubmit={submit}>
      {token ? <>
        <label className="auth-field"><span>New password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required autoFocus /></span></label>
        <label className="auth-field"><span>Confirm new password</span><span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></span></label>
      </> : <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required autoFocus /></span></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}><span>{busy ? 'Please wait…' : token ? 'Update password' : 'Send reset link'}</span>{!busy && <ArrowRight size={17} />}</button>
    </form>}
    {message && <p className="auth-recovery-success" role="status">{message}</p>}
    <p className="auth-mode-switch"><button type="button" disabled={busy} onClick={onBack}>Back to sign in</button></p>
  </>;
}
