import { Link, useNavigate } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { SUPPORTED_LOCALES } from '../i18n/locales';
import { TablerIcon as Icon } from '../components/layout/TablerIcon';
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
  },
};

function Wordmark({ to }) {
  return <Link className="landing-wordmark" to={to} aria-label="Chronos"><svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M18 3a15 15 0 1 0 15 15" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><path d="M18 10v8l8 5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/><circle cx="30" cy="7" r="3" fill="#70b7ef"/></svg><span>chronos<span>.</span></span></Link>;
}

function PlanningCards({ c }) {
  return <div className="landing-cards" id="landing-preview" aria-hidden="true">
    <div className="landing-float float-tasks">
      <div className="float-content">
        <div className="mini-heading"><span className="mini-icon"><Icon name="checkbox" size={19}/></span><strong>{c.today}</strong></div>
        <div className="mini-tasks">{c.tasks.map((task,index)=><div key={task} className={index<2?'mini-done':''}><i>{index<2?<Icon name="check" size={10} stroke={2.4}/>:null}</i><span>{task}</span></div>)}</div>
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
        <div className="meeting-inner"><span className="meeting-top"><Icon name="users" size={16}/>{c.work}</span><strong>{c.meeting}</strong><span className="meeting-avatars"><i>A</i><i>M</i><i>S</i></span></div>
        <div className="meeting-time"><Icon name="clock" size={17}/>{c.meetingTime}</div>
      </div>
    </div>
    <div className="landing-float float-focus"><div className="float-content"><span className="float-pointer"><Icon name="pointer" size={20}/></span><span className="mini-icon"><Icon name="clock" size={19}/></span><span><strong>{c.focus}</strong><small>{c.focusTime}</small></span></div></div>
    <div className="landing-float float-reminder"><div className="float-content"><span className="float-pointer"><Icon name="pointer" size={20}/></span><span className="mini-icon"><Icon name="bell" size={19}/></span><span><strong>{c.reminderText}</strong><small>{c.reminderTime}</small></span></div></div>
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
        <Link className="landing-button landing-button-dark" to={localizedPath('/login')}>{c.login}<Icon name="arrow-right" size={17}/></Link>
      </div>
    </header>
    <section className="landing-hero" id="landing-top" aria-labelledby="landing-title">
      <div className="landing-glow" aria-hidden="true"/>
      <div className="landing-grid" aria-hidden="true"/>
      <div className="landing-hero-copy">
        <div className="landing-eyebrow"><span/>{c.eyebrow}</div>
        <h1 id="landing-title">{c.title[0]}<br/><span>{c.title[1]}</span></h1>
        <p>{c.description}</p>
        <div className="landing-hero-actions"><a className="landing-button landing-button-light" href="#landing-features">{c.learn}</a><Link className="landing-button landing-button-dark" to={localizedPath('/register')}>{c.start}<Icon name="arrow-right" size={19}/></Link></div>
      </div>
      <PlanningCards c={c}/>
      <span className="landing-demo-note">{c.demo}</span>
    </section>
    <div className="landing-capabilities" id="landing-features">{[['calendar',c.calendar],['checkbox',c.task],['users',c.events],['bell',c.reminders]].map(([icon,label])=><span key={icon}><Icon name={icon} size={23}/>{label}</span>)}</div>
  </div>;
}
