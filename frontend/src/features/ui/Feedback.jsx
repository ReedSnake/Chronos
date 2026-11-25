import { TablerIcon as Icon } from '../../components/layout/TablerIcon';

export function SkeletonRows({label,count=3}){
  return <div className="ux-feedback-skeleton" role="status" aria-label={label}>
    {Array.from({length:count},(_,index)=><div key={index} aria-hidden="true"><i/><span><b/><b/></span></div>)}
  </div>;
}
export function EmptyState({icon='calendar-event',title,description,action,onAction}){
  return <div className="ux-feedback-empty"><span className="ux-feedback-symbol"><Icon name={icon} size={22}/></span><strong>{title}</strong>{description&&<p>{description}</p>}{action&&onAction&&<button type="button" className="ux-primary" onClick={onAction}>{action}</button>}</div>;
}
