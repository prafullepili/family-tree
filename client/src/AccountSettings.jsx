import { useEffect, useRef, useState } from 'react';
import PasswordRecovery from './PasswordRecovery.jsx';
import { apiFetch, apiUrl } from './apiClient.js';

export default function AccountSettings({ user, onClose, onLogoutAll, onPasswordReset, onUserUpdated }) {
  const [recovering, setRecovering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saved, setSaved] = useState(false);
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector('button')?.focus();
    const escape = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', escape);
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const elements = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.current?.addEventListener('keydown', trap);
    const current = panel.current;
    return () => { window.removeEventListener('keydown', escape); current?.removeEventListener('keydown', trap); previous?.focus(); };
  }, [busy, onClose]);
  async function logoutAll() {
    setBusy(true); setError('');
    try { await onLogoutAll(); }
    catch (e) { setError(e.message || 'Could not log out. Try again.'); }
    finally { setBusy(false); }
  }
  async function savePassword(event) {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await apiFetch(apiUrl('/api/auth/set-password'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not set your password.');
      onUserUpdated(result.user); setPassword(''); setConfirmation(''); setSaved(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="account-settings-overlay">
    <button className="workspace-scrim" aria-label="Close account settings" disabled={busy} onClick={onClose} tabIndex={-1} />
    <section ref={panel} className="workspace-panel account-settings-panel" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
      <header><h2 id="account-settings-title">Account settings</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close account settings">×</button></header>
      {recovering ? <PasswordRecovery initialEmail={user.email} backLabel="Back to account settings" onBack={() => setRecovering(false)} onResetComplete={onPasswordReset} /> : <>
        <h3>{user.displayName}</h3><p>{user.email}</p>
        {user.googleConnected && !user.hasPassword && <>
          <h3>Set a password (optional)</h3><p>Your Google account is verified. Add a password to also sign in with your email or username. You can skip this and keep using Google.</p>
          <form onSubmit={savePassword}>
            <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} /></label>
            <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
          </form>
        </>}
        {saved && <p role="status">Password saved. You can now sign in with Google or your email/username and password.</p>}
        {user.googleConnected && <p>If you forget your password, use Google sign-in to access your account. Email reset codes may be unavailable on this hosting plan.</p>}
        <h3>Password recovery</h3><p>Receive a code at your email to reset your password. Resetting signs you out of all devices.</p>
        <button type="button" onClick={() => setRecovering(true)}>Forgot password?</button>
        <h3>Sessions</h3><p>Log out of every browser and device, including this one. Your family data stays saved.</p>
        {confirming ? <div><p>Log out from all devices now?</p><button type="button" disabled={busy} onClick={logoutAll}>{busy ? 'Logging out…' : 'Confirm log out everywhere'}</button> <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div> : <button type="button" onClick={() => setConfirming(true)}>Log out from all devices</button>}
      </>}
      {error && <p role="alert" className="workspace-error">{error}</p>}
    </section>
  </div>;
}
