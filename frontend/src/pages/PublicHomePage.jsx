import { Link, useNavigate } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { SUPPORTED_LOCALES } from '../i18n/locales';
import '../styles/public-home.css';

const copy = {
  en: {
    features: 'Features', preview: 'How it works', start: 'Get started', login: 'Log in',
    eyebrow: 'A little more time for what matters',
    title: ['Time for everything.', 'Space for yourself.'],
    description: 'Bring your plans, tasks and meetings together in one calendar. Make room for the things that matter most.',
    learn: 'Explore Chronos', demo: 'Illustrative calendar preview',
    today: 'Today’s tasks', completed: '2 of 3 completed', tasks: ['Review weekly goals', 'Send project update', 'Plan tomorrow'],
    meeting: 'Team meeting', work: 'Work', meetingTime: '10:00 – 10:45', reminder: 'A little reminder', reminderText: 'Take a break', reminderTime: 'In 15 minutes',
    week: 'Your week', weekdays: ['M','T','W','T','F','S','S'], focus: 'Focus time', focusTime: '14:00 – 15:30',
    calendar: 'Calendars', task: 'Tasks', events: 'Meetings', reminders: 'Reminders',
    sectionTitle: 'Everything in its own place.', sectionText: 'A simple space to organise your days, keep track of your plans and share time with others.',
    items: [['calendar','See the bigger picture','Create calendars for different parts of your life and view your plans by month or agenda.'],['check','Make progress','Keep tasks alongside your other events, so your to-do list has a place in your day.'],['people','Plan together','Invite people to events and share calendars when you need to coordinate.'],['bell','Remember the little things','Add reminders and keep important dates close at hand.']],
    bottomTitle: 'Your next day starts here.', bottomText: 'Make a little space for better planning.',
    footer: 'Your time, thoughtfully organised.',
  },
  uk: {
    features: 'Можливості', preview: 'Як це працює', start: 'Почати', login: 'Увійти',
    eyebrow: 'Трохи більше часу на важливе',
    title: ['Час на все.', 'Простір для себе.'],
    description: 'Об’єднуй плани, завдання й зустрічі в одному календарі. Залишай більше часу на те, що справді важливе.',
    learn: 'Дізнатися більше', demo: 'Приклад планування в календарі',
    today: 'Завдання на сьогодні', completed: 'Виконано 2 з 3', tasks: ['Переглянути цілі тижня', 'Надіслати оновлення', 'Спланувати завтра'],
    meeting: 'Зустріч команди', work: 'Робота', meetingTime: '10:00 – 10:45', reminder: 'Маленьке нагадування', reminderText: 'Час на перерву', reminderTime: 'Через 15 хвилин',
    week: 'Твій тиждень', weekdays: ['П','В','С','Ч','П','С','Н'], focus: 'Час для фокусу', focusTime: '14:00 – 15:30',
    calendar: 'Календарі', task: 'Завдання', events: 'Зустрічі', reminders: 'Нагадування',
    sectionTitle: 'Усьому своє місце.', sectionText: 'Простий простір для організації дня, планування справ і спільного часу з іншими.',
    items: [['calendar','Бач більше','Створюй календарі для різних сфер життя та переглядай плани на місяць або у списку подій.'],['check','Рухайся вперед','Зберігай завдання поруч з іншими подіями, щоб для кожної справи був свій час.'],['people','Плануй разом','Запрошуй людей на події та діліться календарями для спільного планування.'],['bell','Пам’ятай важливе','Додавай нагадування та зберігай важливі дати під рукою.']],
    bottomTitle: 'Твій наступний день починається тут.', bottomText: 'Створи трохи простору для кращого планування.',
    footer: 'Твій час, продумано організований.',
  },
};

function Icon({ name, size = 20 }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2m4 0h2m-8 3h2"/></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
    cursor: <path d="m5 3 15 8-7 2-3 7z" fill="currentColor" strokeWidth="1"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Wordmark({ to }) {
  return <Link className="landing-wordmark" to={to} aria-label="Chronos"><svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M18 3a15 15 0 1 0 15 15" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><path d="M18 10v8l8 5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/><circle cx="30" cy="7" r="3" fill="#70b7ef"/></svg><span>chronos<span>.</span></span></Link>;
}

function PlanningCards({ c }) {
  return <div className="landing-cards" aria-hidden="true">
    <div className="landing-float float-tasks">
      <div className="float-content">
        <div className="mini-heading"><span className="mini-icon"><Icon name="check" size={19}/></span><strong>{c.today}</strong></div>
        <div className="mini-tasks">{c.tasks.map((task,index)=><div key={task} className={index<2?'mini-done':''}><i>{index<2?'✓':''}</i><span>{task}</span></div>)}</div>
        <div className="mini-progress"><span/></div><small>{c.completed}</small>
      </div>
    </div>
    <div className="landing-float float-week">
      <div className="float-content">
        <div className="mini-heading"><strong>{c.week}</strong><Icon name="calendar" size={17}/></div>
        <div className="mini-week">{c.weekdays.map((day,index)=><div key={index}><small>{day}</small><b className={index===2?'selected':''}>{18+index}</b><i className={index===1||index===2||index===4?'has-event':''}/></div>)}</div>
        <div className="mini-week-event"><span/>{c.focus}<small>{c.focusTime}</small></div>
      </div>
    </div>
    <div className="landing-float float-meeting">
      <div className="float-content meeting-content">
        <div className="meeting-inner"><span className="meeting-top"><Icon name="people" size={16}/>{c.work}</span><strong>{c.meeting}</strong><span className="meeting-avatars"><i>A</i><i>M</i><i>S</i></span></div>
        <div className="meeting-time"><Icon name="clock" size={17}/>{c.meetingTime}</div>
      </div>
    </div>
    <div className="landing-float float-focus"><div className="float-content"><span className="float-pointer"><Icon name="cursor" size={20}/></span><span className="mini-icon"><Icon name="clock" size={19}/></span><span><strong>{c.focus}</strong><small>{c.focusTime}</small></span></div></div>
    <div className="landing-float float-reminder"><div className="float-content"><span className="float-pointer"><Icon name="cursor" size={20}/></span><span className="mini-icon"><Icon name="bell" size={19}/></span><span><strong>{c.reminderText}</strong><small>{c.reminderTime}</small></span></div></div>
  </div>;
}

export function PublicHomePage() {
  const { locale, localizedPath, locationForLocale, t } = useLocale();
  const navigate = useNavigate();
  const c = copy[locale] || copy.en;
  return <div className="landing">
    <header className="landing-header">
      <Wordmark to={localizedPath('/')}/>
      <nav className="landing-nav" aria-label={t('navigation.label')}>
        <a href="#landing-top" className="landing-nav-active">{t('navigation.home')}</a>
        <a href="#landing-features">{c.features}</a>
        <a href="#landing-preview">{c.preview}</a>
      </nav>
      <div className="landing-header-actions">
        <label className="landing-language"><span className="visually-hidden">{t('languageSwitcher.label')}</span><select value={locale} aria-label={t('languageSwitcher.label')} onChange={e=>navigate(locationForLocale(e.target.value),{replace:true})}>{SUPPORTED_LOCALES.map(lang=><option key={lang} value={lang}>{lang.toUpperCase()}</option>)}</select></label>
        <Link className="landing-button landing-button-dark" to={localizedPath('/login')}>{c.login}<Icon name="arrow" size={17}/></Link>
      </div>
    </header>
    <section className="landing-hero" id="landing-top" aria-labelledby="landing-title">
      <div className="landing-glow" aria-hidden="true"/>
      <div className="landing-grid" aria-hidden="true"/>
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span/>{c.eyebrow}</div>
        <h1 id="landing-title">{c.title[0]}<br/><span>{c.title[1]}</span></h1>
        <p>{c.description}</p>
        <div className="landing-hero-actions"><a className="landing-button landing-button-light" href="#landing-features">{c.learn}</a><Link className="landing-button landing-button-dark" to={localizedPath('/register')}>{c.start}<Icon name="arrow" size={19}/></Link></div>
      </div>
      <PlanningCards c={c}/>
      <span className="landing-demo-note">{c.demo}</span>
    </section>
    <div className="landing-capabilities" id="landing-preview">{[['calendar',c.calendar],['check',c.task],['people',c.events],['bell',c.reminders]].map(([icon,label])=><span key={icon}><Icon name={icon} size={23}/>{label}</span>)}</div>
    <section id="landing-features" className="landing-features">
      <h2>{c.sectionTitle}</h2><p>{c.sectionText}</p>
      <div className="landing-feature-grid">{c.items.map(([icon,title,description])=><article key={icon}><span className="landing-feature-icon"><Icon name={icon} size={25}/></span><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>
    <section className="landing-bottom"><h2>{c.bottomTitle}</h2><p>{c.bottomText}</p><Link className="landing-button landing-button-dark" to={localizedPath('/register')}>{c.start}<Icon name="arrow" size={19}/></Link></section>
    <footer className="landing-footer"><Wordmark to={localizedPath('/')}/><span>{c.footer}</span><Link to={localizedPath('/login')}>{c.login}</Link></footer>
  </div>;
}
