import { useState } from 'react';
import { TablerIcon } from '../layout/TablerIcon';
import { RabbitPlayground } from './RabbitPlayground';
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
      <RabbitPlayground mood={mood} caret={caret} />
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
        <TablerIcon name={visible ? "eye-off" : "eye"} size={20} />
      </button>
    </div>
  );
}
