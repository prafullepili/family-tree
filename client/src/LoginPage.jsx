import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Mail, Moon, ShieldCheck, Sparkles, Sun, UserRound } from 'lucide-react';
import VanshLinkLogo from './VanshLinkLogo.jsx';
import PasswordRecovery from './PasswordRecovery.jsx';
import { loadGoogleIdentity } from './googleIdentity.js';
import FamilyConstellation from './FamilyConstellation.jsx';
import PasswordField from './PasswordField.jsx';
import EmailVerification from './EmailVerification.jsx';

export default function LoginPage({ error, googleClientId, theme, onThemeChange, onLogin, onRegister, onGoogle, onRetry, resetToken = '', onResetComplete, onExitRecovery, verificationEmail = '', onVerifyEmail, onExitVerification }) {
  const [recovering, setRecovering] = useState(Boolean(resetToken));
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ displayName: '', username: '', email: '', identity: '', password: '' });
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [googleAttempt, setGoogleAttempt] = useState(0);
  const googleButtonRef = useRef(null);
  const googleHandlerRef = useRef(onGoogle);
  googleHandlerRef.current = onGoogle;

  useEffect(() => {
    if (!googleClientId || verificationEmail || !googleButtonRef.current) return undefined;
    let cancelled = false;
    setGoogleReady(false);
    setGoogleError('');
    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response?.credential) return;
          setPending(true);
          setLocalError('');
          try {
            await googleHandlerRef.current(response.credential);
          } catch (requestError) {
            setLocalError(requestError.message || 'Google sign-in failed.');
            setPending(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(380, googleButtonRef.current.clientWidth || 380),
      });
      setGoogleReady(true);
    };
    loadGoogleIdentity().then(() => { if (!cancelled) render(); }).catch((error) => { if (!cancelled) setGoogleError(error.message); });
    return () => {
      cancelled = true;
    };
  }, [googleClientId, recovering, googleAttempt, verificationEmail]);

  function update(field) {
    return (valueOrEvent) => setValues((current) => ({ ...current, [field]: valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent }));
  }

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setLocalError('');
    try {
      if (mode === 'login') await onLogin({ identity: values.identity, password: values.password });
      else await onRegister({ displayName: values.displayName, username: values.username, email: values.email, password: values.password });
    } catch (requestError) {
      setLocalError(requestError.message || 'Could not sign in.');
    } finally {
      setPending(false);
    }
  }

  const visibleError = localError || error;
  return (
    <main className="auth-page">
      <button className="auth-theme-toggle" type="button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <section className="auth-shell">
        <aside className="auth-story-panel">
          <div className="auth-brand auth-brand-light">
            <span><VanshLinkLogo size={26} /></span>
            VanshLink
          </div>
          <div className="auth-story-copy">
            <span className="auth-eyebrow"><Sparkles size={14} /> Your private family archive</span>
            <h1>Every branch holds a story worth keeping.</h1>
            <p>Bring names, memories, and generations together in one living family tree.</p>
          </div>
          <FamilyConstellation />
          <div className="auth-trust-note"><ShieldCheck size={17} /> Your family data stays private to your account.</div>
        </aside>

        <section className={`auth-form-panel ${mode === 'register' ? 'is-register' : ''}`}>
          <div className="auth-mobile-brand auth-brand">
            <span><VanshLinkLogo size={26} /></span>
            VanshLink
          </div>
          <div className="auth-form-content">
            {verificationEmail ? <EmailVerification key={verificationEmail} email={verificationEmail} initialError={error} onVerify={onVerifyEmail} onBack={() => { setMode('login'); setLocalError(''); onExitVerification(); }} /> : recovering ? <PasswordRecovery token={resetToken} onResetComplete={onResetComplete} onBack={() => { setRecovering(false); onExitRecovery?.(); }} /> : <>
            <div className="auth-form-heading">
              <span>{mode === 'login' ? 'WELCOME BACK' : 'START YOUR ARCHIVE'}</span>
              <h2>{mode === 'login' ? 'Sign in to your family tree' : 'Create your VanshLink account'}</h2>
              <p>{mode === 'login' ? 'Continue where your family story left off.' : 'Create a secure home for your family history.'}</p>
            </div>

            {googleClientId ? <>
              <div ref={googleButtonRef} className={`auth-google-button ${pending ? 'is-disabled' : ''}`} aria-label="Google sign in" />
              {!googleReady && !googleError && <p role="status">Loading Google sign-in…</p>}
              {googleError && <div className="auth-error" role="alert"><span>{googleError}</span><button type="button" onClick={() => setGoogleAttempt((value) => value + 1)}>Retry Google sign-in</button></div>}
            </> : (
              <button type="button" className="auth-google-placeholder" disabled title="Set GOOGLE_CLIENT_ID on the API to enable Google sign-in">
                <strong>G</strong> Continue with Google
              </button>
            )}

            <div className="auth-divider"><span>or continue with {mode === 'login' ? 'email or username' : 'email'}</span></div>

            <form className="auth-form" onSubmit={submit}>
              {mode === 'register' && (
                <>
                  <label className="auth-field">
                    <span>Your name</span>
                    <span className="auth-input-wrap">
                      <UserRound size={17} />
                      <input value={values.displayName} onChange={update('displayName')} autoComplete="name" placeholder="Enter your full name" maxLength={80} required />
                    </span>
                  </label>
                  <label className="auth-field">
                    <span>Username</span>
                    <span className="auth-input-wrap auth-username-wrap">
                      <span className="auth-at">@</span>
                      <input value={values.username} onChange={update('username')} autoComplete="username" placeholder="Choose a username" minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]" required />
                    </span>
                  </label>
                  <label className="auth-field">
                    <span>Email address</span>
                    <span className="auth-input-wrap">
                      <Mail size={17} />
                      <input type="email" value={values.email} onChange={update('email')} autoComplete="email" placeholder="you@example.com" maxLength={254} required />
                    </span>
                  </label>
                </>
              )}
              {mode === 'login' && (
                <label className="auth-field">
                  <span>Email or username</span>
                  <span className="auth-input-wrap">
                    <UserRound size={17} />
                    <input value={values.identity} onChange={update('identity')} autoComplete="username" placeholder="you@example.com or username" required autoFocus />
                  </span>
                </label>
              )}
              <PasswordField value={values.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              {mode === 'login' && <button className="auth-forgot-password" type="button" disabled={pending} onClick={() => { setLocalError(''); setRecovering(true); }}>Forgot password?</button>}

              {visibleError && (
                <div className="auth-error" role="alert">
                  <span>{visibleError}</span>
                  {/unavailable|reach/i.test(visibleError) && <button type="button" onClick={onRetry}>Retry</button>}
                </div>
              )}

              <button className="auth-submit" type="submit" disabled={pending}>
                <span>{pending ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Sign in' : 'Create account'}</span>
                {!pending && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="auth-mode-switch">
              {mode === 'login' ? 'New to VanshLink?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode((current) => (current === 'login' ? 'register' : 'login'));
                  setLocalError('');
                  setValues((current) => ({ ...current, password: '' }));
                }}
              >
                {mode === 'login' ? 'Create an account' : 'Sign in instead'}
              </button>
            </p>
            </>}
          </div>
          <footer className="auth-footer">Secure sessions · Private family records</footer>
        </section>
      </section>
    </main>
  );
}
