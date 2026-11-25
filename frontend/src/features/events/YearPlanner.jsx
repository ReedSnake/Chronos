import { useMemo } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { yearMonths, yearEventsByDay } from './yearModel';
import './year-planner.css';

const types = ['arrangement', 'task', 'reminder', 'holiday'];

export function YearPlanner({ day, today, startsOn, events, zone, onDaySelect, onMonthSelect }) {
  const { locale, t } = useLocale();
  const months = useMemo(() => yearMonths(day, startsOn), [day, startsOn]);
  const grouped = useMemo(() => yearEventsByDay(day, events, zone), [day, events, zone]);
  const format = (key, options) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });
  const weekdayKeys = startsOn === 'sunday' ? ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return <div className="year-planner">
    <div className="year-months">
      {months.map(({ first, days }) => <section className="year-month" key={first}>
        <h3><button type="button" onClick={() => onMonthSelect(first)} aria-label={format(first, { month: 'long', year: 'numeric' })}>{format(first, { month: 'long' })}</button></h3>
        <div className="year-month-grid">
          {weekdayKeys.map(key => <span className="year-weekday" key={key}>{t(`calendarView.weekday.${key}`).slice(0, 2)}</span>)}
          {days.map((key, index) => {
            if (!key) return <span key={`blank-${index}`} aria-hidden="true" />;
            const items = grouped[key] || [];
            const eventTypes = types.filter(type => items.some(event => event.type === type));
            const label = `${format(key, { dateStyle: 'full' })}${items.length ? ` · ${items.length} ${t('calendarView.year.events')}` : ''}`;
            return <button type="button" key={key} className={`year-day${key === today ? ' today' : ''}${key === day ? ' selected' : ''}`} aria-label={label} aria-current={key === today ? 'date' : undefined} title={label} onClick={() => onDaySelect(key)}>
              <span>{Number(key.slice(-2))}</span>
              <span className="year-day-dots" aria-hidden="true">{eventTypes.map(type => <i className={type} key={type} />)}</span>
            </button>;
          })}
        </div>
      </section>)}
    </div>
    <div className="year-legend">{types.map(type => <span key={type}><i className={type} />{t(`calendarView.type.${type}`)}</span>)}</div>
  </div>;
}
