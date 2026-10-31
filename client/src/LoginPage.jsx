import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Moon, ShieldCheck, Sparkles, Sun, UserRound } from 'lucide-react';
import VanshLinkLogo from './VanshLinkLogo.jsx';

function FamilyConstellation() {
  return (
    <svg className="auth-tree-art" viewBox="0 0 620 500" role="img" aria-label="A connected family tree">
      <defs>
        <linearGradient id="auth-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9cfb8" />
          <stop offset="1" stopColor="#789982" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#auth-line)" strokeWidth="2">
        <path d="M175 104 C175 150 232 153 265 189" />
        <path d="M445 104 C445 150 388 153 355 189" />
        <path d="M310 254 C310 303 205 314 164 355" />
        <path d="M310 254 C310 304 310 314 310 355" />
        <path d="M310 254 C310 303 415 314 456 355" />
        <path d="M175 104 L445 104" strokeDasharray="6 7" />
      </g>
      <g className="auth-tree-node">
        <rect x="109" y="56" width="132" height="94" rx="22" />
        <circle cx="150" cy="96" r="21" />
        <path d="M181 88h34M181 101h27M181 114h19" />
      </g>
      <g className="auth-tree-node auth-tree-node-alt">
        <rect x="379" y="56" width="132" height="94" rx="22" />
        <circle cx="420" cy="96" r="21" />
        <path d="M451 88h34M451 101h27M451 114h19" />
      </g>
      <g className="auth-tree-node auth-tree-focus">
        <rect x="238" y="174" width="144" height="98" rx="23" />
        <circle cx="282" cy="216" r="23" />
        <path d="M316 207h41M316 220h34M316 233h25" />
      </g>
      {[92, 238, 384].map((x, index) => (
        <g className="auth-tree-node auth-tree-small" key={x}>
          <rect x={x} y="350" width="144" height="92" rx="21" />
          <circle cx={x + 40} cy="390" r="20" />
          <path d={`M${x + 70} 383h47M${x + 70} 396h34M${x + 70} 409h25`} />
          {index === 1 && <circle className="auth-tree-spark" cx={x + 122} cy="365" r="7" />}
        </g>
      ))}
    </svg>
  );
}

function PasswordField({ value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-field">
      <span>Password</span>
      <span className="auth-input-wrap">
        <LockKeyhole size={17} />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={8}
          maxLength={128}
          autoComplete={autoComplete}
          placeholder="At least 8 characters"
          required
        />
        <button type="button" className="auth-password-toggle" onClick={() => setVisible((show) => !show)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export default function LoginPage({ error, googleClientId, theme, onThemeChange, onLogin, onRegister, onGoogle, onRetry }) {
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ displayName: '', username: '', email: '', identity: '', password: '' });
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState('');
  const googleButtonRef = useRef(null);
  const googleHandlerRef = useRef(onGoogle);
  googleHandlerRef.current = onGoogle;

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;
    let cancelled = false;
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
    };
    const existing = document.getElementById('google-identity-services');
    if (existing) render();
    else {
      const script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => setLocalError('Google sign-in could not be loaded. You can still use your password.');
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

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
            <div className="auth-form-heading">
              <span>{mode === 'login' ? 'WELCOME BACK' : 'START YOUR ARCHIVE'}</span>
              <h2>{mode === 'login' ? 'Sign in to your family tree' : 'Create your VanshLink account'}</h2>
              <p>{mode === 'login' ? 'Continue where your family story left off.' : 'Create a secure home for your family history.'}</p>
            </div>

            {googleClientId ? <div ref={googleButtonRef} className={`auth-google-button ${pending ? 'is-disabled' : ''}`} aria-label="Google sign in" /> : (
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
                      <input value={values.displayName} onChange={update('displayName')} autoComplete="name" placeholder="Prafull Epili" maxLength={80} required />
                    </span>
                  </label>
                  <label className="auth-field">
                    <span>Username</span>
                    <span className="auth-input-wrap auth-username-wrap">
                      <span className="auth-at">@</span>
                      <input value={values.username} onChange={update('username')} autoComplete="username" placeholder="prafull.epili" minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]" required />
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
          </div>
          <footer className="auth-footer">Secure sessions · Private family records</footer>
        </section>
      </section>
    </main>
  );
}
