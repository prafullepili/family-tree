import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

export default function PasswordField({ value, onChange, autoComplete }) {
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
