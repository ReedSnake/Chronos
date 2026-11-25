import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useLocale} from '../../i18n/LocaleProvider';
import {applicationContainer} from '../../app/applicationContainer';
import {EventDialog} from '../events/EventDialog';
import {TablerIcon as Icon} from '../../components/layout/TablerIcon';
import {loadDashboard} from '../dashboard/dashboardData';
import {eventDayKey,eventDateLabel,fromCalendarInput} from '../events/eventForm';
import {shiftDate} from '../tasks/taskBoardModel';
import {notificationText} from './notificationText';

export function ActivityCenter({user,onClose,notifications}){
  const {locale,t,localizedPath}=useLocale(),uk=locale==='uk',navigate=useNavigate();
  const zone=user.settings?.timeZone||'UTC',today=eventDayKey({startsAt:new Date()},zone);
  const [data,setData]=useState({events:[],calendars:[],failed:0});
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true),[errors,setErrors]=useState([]),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let alive=true;setLoading(true);setErrors([]);
    Promise.allSettled([
      loadDashboard(applicationContainer.calendarService,{from:fromCalendarInput(shiftDate(today,-1)+'T00:00',zone),to:new Date(Date.parse(fromCalendarInput(shiftDate(today,8)+'T00:00',zone))-1).toISOString(),types:['reminder']}),
      applicationContainer.integrationService.listRequests()
    ]).then(([events,access])=>{
      if(!alive)return;
      const failed=[];
      if(events.status==='fulfilled'){setData(events.value);if(events.value.failed)failed.push('reminders');}
      else {setData({events:[],calendars:[],failed:0});failed.push('reminders');}
      if(access.status==='fulfilled')setRequests((access.value.requests||[]).filter(r=>!r.status||r.status==='pending'));
      else {setRequests([]);failed.push('requests');}
      setErrors(failed);setLoading(false);
    });return()=>{alive=false;};
  },[today,zone,refresh]);
  function go(path){onClose();navigate(path);}
  async function openNotification(n){
    if(!n.readAt && !(await notifications.markRead(n.id)))return;
    if(n.kind==='reminder'&&n.calendarId&&n.eventId){
      const day=eventDayKey({startsAt:n.dueAt},zone);
      go(localizedPath('/calendars/view/'+encodeURIComponent(n.calendarId))+'?date='+encodeURIComponent(day)+'&event='+encodeURIComponent(n.occurrenceId||n.eventId));
    }
  }
  const sorted=data.events.filter(e=>e.type==='reminder'&&e.status!=='canceled').sort((a,b)=>String(a.remindAt).localeCompare(String(b.remindAt)));
  return <EventDialog label={uk?'Нагадування та запити':'Reminders & requests'} onClose={onClose} busy={false}>
    <section className="ux-activity"><header><div><h2>{uk?'Сповіщення':'Notifications'}</h2><p>{uk?'Нагадування, новини та запити доступу':'Reminders, updates and access requests'}</p></div><button type="button" onClick={onClose} aria-label={uk?'Закрити':'Close'}><Icon name="x" size={18}/></button></header>
      <div className="notification-inbox-heading"><h3>{uk?'Вхідні':'Inbox'} {notifications.unreadCount>0&&`· ${notifications.unreadCount}`}</h3>{notifications.unreadCount>0&&<button type="button" onClick={()=>void notifications.markRead()}>{uk?'Прочитати всі':'Mark all read'}</button>}</div>
      {notifications.error&&<p role="alert">{uk?'Не вдалося оновити сповіщення':'Could not update notifications'} <button type="button" onClick={notifications.refresh}>{t('common.retry')}</button></p>}
      {notifications.loading?<div className="ux-skeleton" role="status" aria-label={t('common.loading')}><i/><i/></div>:!notifications.notifications.length?<p>{uk?'Поки немає сповіщень':'No notifications yet'}</p>:<div className="notification-inbox-list">{notifications.notifications.map(n=>{
        const text=notificationText(n,locale);
        return <button key={n.id} type="button" className={'ux-activity-row notification-inbox-item'+(!n.readAt?' is-unread':'')} onClick={()=>void openNotification(n)}><Icon name={n.kind==='welcome'?'clock':'bell'} size={19}/><span><strong>{text.title}</strong><small>{text.body}</small><small>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(new Date(n.dueAt))}</small></span>{!n.readAt&&<i className="notification-unread-dot" aria-label={uk?'Непрочитане':'Unread'}/>}</button>;
      })}</div>}

      {loading?<div role="status" aria-label={t('common.loading')} className="ux-skeleton"><i/><i/><i/></div>:<>
        {errors.length>0&&<p role="alert">{uk?'Деякі дані не завантажилися':'Some data could not be loaded'} <button type="button" onClick={()=>setRefresh(n=>n+1)}>{t('common.retry')}</button></p>}
        <h3>{uk?'Запити інтеграцій':'Integration requests'}</h3>
        {!requests.length?<p>{errors.includes('requests')?'—':uk?'Немає нових запитів':'No pending requests'}</p>:requests.map(r=><button type="button" className="ux-activity-row" key={r.id} onClick={()=>go(localizedPath('/integrations'))}><Icon name="plug" size={18}/><span><strong>{r.integration?.name||t('integrations.unknown')}</strong><small>{uk?'Запит доступу':'Access request'}</small></span><Icon name="chevron-right" size={15}/></button>)}
        <h3>{uk?'Нагадування · учора та наступні 7 днів':'Reminders · yesterday and next 7 days'}</h3>
        {!sorted.length?<p>{errors.includes('reminders')?'—':uk?'Немає нагадувань':'No reminders scheduled'}</p>:sorted.map(e=>{
          const eventZone=zone,day=eventDayKey(e,eventZone);
          return <button type="button" className="ux-activity-row" key={e.calendarId+':'+(e.occurrenceId||e.id)} onClick={()=>go(localizedPath('/calendars/view/'+encodeURIComponent(e.calendarId))+'?date='+encodeURIComponent(day)+'&event='+encodeURIComponent(e.occurrenceId||e.id))}><Icon name="bell" size={18}/><span><strong>{e.title}</strong><small>{eventDateLabel(e,locale,eventZone,user.settings?.timeFormat||'24h')} · {e.calendarName}</small></span><Icon name="chevron-right" size={15}/></button>;
        })}
      </>}
      <footer><button type="button" onClick={()=>{setRefresh(n=>n+1);void notifications.refresh();}} disabled={loading}><Icon name="refresh" size={15}/>{uk?'Оновити':'Refresh'}</button></footer>
    </section>
  </EventDialog>;
}
