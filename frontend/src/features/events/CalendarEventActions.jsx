import { canMoveEvent } from './eventQuickModel';
import { EventPreviewButton } from './EventPreviewButton';
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

export function useCalendarDrop() {
 const actions=useContext(ActionsContext);
 return (day, minuteFor=null)=>({
  onDragOver:e=>{if(actions?.dragging && e.dataTransfer.types.includes('application/x-chronos-event') && (minuteFor||actions.dragging.mode==='move')){e.preventDefault();e.dataTransfer.dropEffect='move';}},
  onDrop:e=>{if(!actions?.dragging||!e.dataTransfer.types.includes('application/x-chronos-event'))return;e.preventDefault();e.stopPropagation();actions.drop?.(day,minuteFor?minuteFor(e):null);}
 });
}

 // Separate sibling buttons keep the event opener and completion control keyboard accessible.
export function CalendarEventButton({event,placement='list',className='',style,children,...props}){
 const actions=useContext(ActionsContext);
 const {locale}=useLocale(),uk=locale==='uk';
 const editable=!!actions?.canEditEvent?.(event)&&!actions.busy;
 const draggable=editable&&canMoveEvent(event);
 const dragProps=editable?{onContextMenu:e=>{e.preventDefault();actions.context?.(event);},onKeyDown:e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();actions.context?.(event);}},draggable,onDragStart:e=>{if(!draggable)return;actions.startDrag?.(event,'move',e);},onDragEnd:()=>actions.endDrag?.()}: {};
 const resize=draggable&&event.type==='arrangement'&&placement==='positioned'&&actions.resizeEnabled;
 const content=<>{children}{resize&&<span className="ux-resize-handle" draggable title={uk?'Перетягніть для зміни тривалості':'Drag to resize'} aria-hidden="true" onClick={e=>e.stopPropagation()} onDragStart={e=>{e.stopPropagation();actions.startDrag?.(event,'resize',e);}} onDragEnd={()=>actions.endDrag?.()}/>}</>;
 if(event.type!=='task'||!actions?.canChange(event))return <EventPreviewButton event={event} zone={actions?.zone} className={className||undefined} style={style} {...props} {...dragProps}>{content}</EventPreviewButton>;
 return <div className={'calendar-event-wrap calendar-event-'+placement+' '+(event.status==='done'?'is-done':'')} style={placement==='list'?undefined:style}>
  <EventPreviewButton event={event} zone={actions?.zone} className={(className?className+' ':'')+'calendar-event-open'} style={placement==='list'?style:undefined} {...props} {...dragProps}>{content}</EventPreviewButton>
  <TaskCompletion event={event}/>
 </div>;
}
