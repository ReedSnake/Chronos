import { useState } from 'react';
import { BlobMascot } from './BlobMascot';
import { useLocale } from '../../i18n/LocaleProvider';
import '../../styles/interactive-auth.css';

function focusKind(target) {
  if (!target || typeof target.closest !== 'function') return '';
  if (target.closest('.auth-password')) return 'password';
  return target.tagName === 'INPUT' ? 'reading' : '';
}

export function InteractiveAuth({ title, children, error, success, submitting }) {
  const [focus, setFocus] = useState('');
  const [visible, setVisible] = useState(false);
  const [caret, setCaret] = useState(null);
  function readCaret(event) {
    const input = event.target;
    if (input.tagName !== 'INPUT' || input.dataset.password !== undefined) return;
    let index = input.value.length;
    try { index = input.selectionStart ?? index; } catch { /* Email inputs do not expose selection. */ }
    setCaret(Math.min(1, index / Math.max(18, input.value.length)));
  }
  const mood = focus === 'password' ? (visible ? 'peek' : 'private') : submitting ? 'loading' : error ? 'error' : success ? 'success' : focus ? 'reading' : 'idle';
  return (
    <section className="interactive-auth" onInput={readCaret} onSelect={readCaret} onKeyUp={readCaret} onFocusCapture={event => { setFocus(focusKind(event.target)); if (focusKind(event.target) === 'reading') readCaret(event); }}
      onBlurCapture={event => setFocus(event.currentTarget.contains(event.relatedTarget) ? focusKind(event.relatedTarget) : '')}>
      <BlobMascot mood={mood} caret={caret} />
      <h1>{title}</h1>
      {children({ visible, setVisible, setFocus })}
    </section>
  );
}

export function PasswordField({ visible, setVisible, setFocus, ...props }) {
  const { locale } = useLocale();
  const label = locale === 'uk' ? (visible ? 'Приховати пароль' : 'Показати пароль') : (visible ? 'Hide password' : 'Show password');
  return (
    <div className="auth-password">
      <input {...props} data-password="" type={visible ? 'text' : 'password'} />
      <button type="button" className="password-toggle" aria-label={label} aria-pressed={visible}
        onClick={() => { setVisible(!visible); setFocus('password'); }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}
