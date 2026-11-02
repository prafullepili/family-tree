let loading;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    let script = document.getElementById('google-identity-services');
    const created = !script;
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
    }
    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', ready);
      script.removeEventListener('error', failed);
    };
    const failed = () => {
      cleanup();
      script.remove();
      loading = undefined;
      reject(Error('Google sign-in could not load. Check your connection or browser extensions, then retry.'));
    };
    const ready = () => {
      if (!window.google?.accounts?.id) return failed();
      cleanup();
      resolve(window.google.accounts.id);
    };
    const timeout = setTimeout(failed, 15000);
    script.addEventListener('load', ready);
    script.addEventListener('error', failed);
    if (created) document.head.appendChild(script);
  });
  return loading;
}
