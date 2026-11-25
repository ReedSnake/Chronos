import { useEffect, useState } from 'react';
export function useNotice() {
  const [notice,setNotice]=useState(null);
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(null),notice.action?10000:4000);return()=>clearTimeout(id);},[notice]);
  return [notice,(message,action=null)=>setNotice({message,action}),()=>setNotice(null)];
}
export function Notice({notice,onDismiss,undoLabel='Undo',closeLabel='Dismiss'}) {
  return notice?<div className="ux-toast" role="status"><span>{notice.message}</span>{notice.action&&<button type="button" onClick={()=>{const action=notice.action;onDismiss();void action();}}>{undoLabel}</button>}<button type="button" aria-label={closeLabel} onClick={onDismiss}>×</button></div>:null;
}
