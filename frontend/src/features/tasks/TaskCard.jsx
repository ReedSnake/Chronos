import { useAuth } from '../auth/AuthContext';
import { formatEventTime } from '../events/timeDisplay';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import { EventPreviewButton } from '../events/EventPreviewButton';
import { TaskCompletion } from '../events/CalendarEventActions';
import { eventDayKey } from '../events/eventForm';
import { TASK_STATES, canWriteTask } from './taskBoardModel';

const safeColor = color => /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#F5BC5A';

export function TaskCard({ task, calendar, zone, onOpen, onChange, busy, onDragStart, onDragEnd, bulk, picked, onPick }) {
  const { t, locale } = useLocale(), uk = locale === 'uk';
  const {user}=useAuth();
  const writable = canWriteTask(calendar);
  const participants = (task.attendees || []).filter(person => typeof person?.email === 'string');
  const category = task.categories?.[0];
  const date = eventDayKey(task, zone);
  const dateLabel = date ? new Date(date + 'T12:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  const done = task.status === 'done';
  return <article className={'tb-card ' + task.status} style={{ '--task-color': done ? '#65a982' : safeColor(task.color || calendar?.color) }} draggable={writable && !busy} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <div className="tb-card-main">{bulk&&writable&&!task.isRecurring&&<input className="ux-task-select" type="checkbox" aria-label={(uk?"Вибрати ":"Select ")+task.title} checked={picked} onChange={onPick} disabled={busy}/> }
      <EventPreviewButton event={{...task,calendarName:task.calendarName||calendar?.name}} zone={zone} className="tb-card-open" onClick={() => onOpen(task)}>
        <span className="tb-card-icon"><Icon name={done ? 'check' : task.status === 'in_progress' ? 'clock' : 'checkbox'} size={19}/></span>
        <span className="tb-card-copy"><strong>{task.title}</strong>{task.description && <span className="tb-description">{task.description}</span>}{(category || task.calendarName || calendar?.name) && <small>{category || task.calendarName || calendar?.name}</small>}</span>
      </EventPreviewButton>
      <TaskCompletion event={task}/>
    </div>
    <div className="tb-card-bottom">
      <div className="tb-avatars" aria-label={uk ? 'Учасники' : 'Participants'}>{participants.slice(0, 4).map(a => <span key={a.email} title={a.email}>{a.email.slice(0, 2).toUpperCase()}</span>)}{participants.length > 4 && <span>+{participants.length - 4}</span>}</div>
      <span className={"tb-card-time"+(task.status!=="done"&&Date.parse(task.deadline)<Date.now()?" ux-overdue":"")} title={date ? dateLabel + ' · ' + formatEventTime(task.deadline,locale,zone,user?.settings?.timeFormat) : undefined}>{task.isRecurring && <Icon name="refresh" size={13}/>}<Icon name="calendar" size={13}/>{dateLabel}</span>
      {writable && <label className="tb-status-control" title={t('calendarView.event.status')}><Icon name="chevron-down" size={14}/><select aria-label={t('calendarView.event.status') + ': ' + task.title} disabled={busy} value={task.status} onChange={e => onChange(task, e.target.value)}>{TASK_STATES.map(s => <option key={s} value={s}>{t('statuses.' + s)}</option>)}</select></label>}
    </div>
  </article>;
}

