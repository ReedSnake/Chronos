import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { useLocale } from '../../i18n/LocaleProvider';
import { notificationText } from './notificationText';

export function NotificationToast({ notification, onOpen, onDismiss, timeZone }) {
  const { locale } = useLocale();
  if (!notification) return null;
  const text = notificationText(notification, locale, timeZone);
  return <aside className="notification-toast" aria-label={locale === 'uk' ? 'Нове сповіщення' : 'New notification'}>
    <div className="notification-toast-icon"><Icon name={notification.kind === 'welcome' ? 'clock' : 'bell'} size={21}/></div>
    <div className="notification-toast-content" role="status"><strong>{text.title}</strong><p>{text.body}</p><button type="button" onClick={onOpen}>{locale === 'uk' ? 'Переглянути сповіщення' : 'View notifications'}</button></div>
    <button className="notification-toast-close" type="button" onClick={onDismiss} aria-label={locale === 'uk' ? 'Закрити' : 'Dismiss'}><Icon name="x" size={17}/></button>
  </aside>;
}
