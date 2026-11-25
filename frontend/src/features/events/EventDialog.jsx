const dialogDirty=dialog=>!!dialog.querySelector('[data-unsaved="true"]');
import { useEffect, useRef } from 'react';
import './event-surface.css';

export function EventDialog({ children, onClose, label, busy }) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="event-dialog" aria-label={label} onCancel={e=>{e.preventDefault();if(!busy&&(!dialogDirty(e.currentTarget)||window.confirm(document.documentElement.lang==='uk'?'Закрити без збереження?':'Discard unsaved changes?')))onClose();}}>{children}</dialog>;
}
