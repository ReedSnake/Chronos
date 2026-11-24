import { TablerIcon } from './TablerIcon';

export function FlowSurface({ title, icon = 'calendar', tone = '', children, className = '' }) {
  return <section className={['flow-surface', className].filter(Boolean).join(' ')}>
    <header className="flow-heading">
      <span className={['flow-symbol', tone].filter(Boolean).join(' ')} aria-hidden="true"><TablerIcon name={icon} size={24}/></span>
      <h1>{title}</h1>
    </header>
    {children}
  </section>;
}
