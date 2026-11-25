export function notificationText(notification, locale, timeZone = 'UTC') {
  const uk = locale === 'uk';
  if (notification.kind === 'welcome') return {
    title: uk ? 'Вітаємо в Chronos!' : 'Welcome to Chronos!',
    body: uk ? 'Дякуємо, що обрали нас! Плануйте свій час, створюйте події та зосереджуйтеся на важливому. Нехай кожен день буде продуктивним!' : 'Thank you for choosing us! Plan your time, create events and focus on what matters. Here’s to more productive days!',
  };
  const eventBody = [notification.title, notification.calendarName].filter(Boolean).join(' · ');
  if (notification.kind === 'task_deadline') {
    const deadline = notification.eventAt ? new Date(notification.eventAt) : null;
    const date = deadline && Number.isFinite(deadline.getTime())
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(deadline) : '';
    return { title: uk ? 'Наближається дедлайн' : 'Task deadline approaching',
      body: [eventBody, date && `${uk ? 'До' : 'Due'} ${date}`].filter(Boolean).join(' · ') };
  }
  const changes = {
    event_created: ['Нова подія у спільному календарі', 'New event in shared calendar'],
    event_updated: ['Подію оновлено', 'Event updated'],
    event_canceled: ['Подію скасовано', 'Event canceled'],
    event_deleted: ['Подію видалено', 'Event deleted'],
    calendar_updated: ['Спільний календар оновлено', 'Shared calendar updated'],
  };
  if (changes[notification.kind]) return { title: changes[notification.kind][uk ? 0 : 1], body: eventBody };
  return { title: uk ? 'Час нагадування' : 'Reminder due', body: notification.title };
}
