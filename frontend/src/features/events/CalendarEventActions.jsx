import { createContext, useContext } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { TablerIcon as Icon } from '../../components/layout/TablerIcon';
import './calendar-event-actions.css';

const ActionsContext=createContext(null);
export const CalendarEventActionsProvider=ActionsContext.Provider;

export function EventSymbol({event,size=16}){
 const done=event.type==='task'&&event.status==='done';
 const icon=done?'check':event.type==='task'?'checkbox':event.type==='reminder'?'bell':'calendar-event';
 return <span className={'calendar-event-symbol '+event.type+(done?' done':'')+(event.status==='in_progress'?' in-progress':'')} aria-hidden="true"><Icon name={icon} size={size}/></span>;
}
export function EventStatus({event}){
 const {t}=useLocale();
 return event.status?<span className={'calendar-event-status '+event.status}>{t('statuses.'+event.status)}</span>:null;
}
export function TaskCompletion({event,large=false}){
 const actions=useContext(ActionsContext);
 const {locale}=useLocale();
 if(event.type!=='task'||!actions?.canChange(event))return null;
 const done=event.status==='done';
 const label=done?(locale==='uk'?'Повернути в завдання':'Reopen task'):(locale==='uk'?'Позначити виконаним':'Mark as done');
 return <button type="button" className={'calendar-task-toggle'+(large?' large':'')} aria-pressed={done} aria-label={label+': '+event.title} title={label} disabled={actions.busy} onClick={()=>void actions.toggle(event)}><span><Icon name="check" size={13}/></span>{large&&label}</button>;
}

// Separate sibling buttons keep the event opener and completion control keyboard accessible.
export function CalendarEventButton({event,placement='list',className='',style,children,...props}){
 const actions=useContext(ActionsContext);
 if(event.type!=='task'||!actions?.canChange(event))return <button type="button" className={className||undefined} style={style} {...props}>{children}</button>;
 return <div className={'calendar-event-wrap calendar-event-'+placement+' '+(event.status==='done'?'is-done':'')} style={placement==='list'?undefined:style}>
  <button type="button" className={(className?className+' ':'')+'calendar-event-open'} style={placement==='list'?style:undefined} {...props}>{children}</button>
  <TaskCompletion event={event}/>
 </div>;
}
