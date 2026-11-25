import { useEffect, useRef } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import './event-surface.css';

export function EventDialog({ children, onClose, label, busy }) {
  const ref = useRef(null);
  const { locale } = useLocale();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  function cancel(event) {
    event.preventDefault();
    if (busy) return;
    const dirty = event.currentTarget.querySelector('[data-unsaved="true"]');
    if (dirty && !window.confirm(locale === 'uk'
      ? 'Закрити без збереження змін?'
      : 'Discard unsaved changes?')) return;
    onClose();
  }

  return (
    <dialog ref={ref} className="event-dialog" aria-label={label} onCancel={cancel}>
      {children}
    </dialog>
  );
}
