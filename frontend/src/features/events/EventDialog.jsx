import { useEffect, useRef } from 'react';
import './event-surface.css';

export function EventDialog({ children, onClose, label, busy }) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="event-dialog" aria-label={label} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>{children}</dialog>;
}
