export function notificationText(notification, locale) {
  const uk = locale === 'uk';
  if (notification.kind === 'welcome') return {
    title: uk ? 'Вітаємо в Chronos!' : 'Welcome to Chronos!',
    body: uk ? 'Дякуємо, що обрали нас! Плануйте свій час, створюйте події та зосереджуйтеся на важливому. Нехай кожен день буде продуктивним!' : 'Thank you for choosing us! Plan your time, create events and focus on what matters. Here’s to more productive days!',
  };
  return { title: uk ? 'Час нагадування' : 'Reminder due', body: notification.title };
}
