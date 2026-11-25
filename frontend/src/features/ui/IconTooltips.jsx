import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Existing accessible labels supply tooltips without adding duplicate markup to each button.
export function IconTooltips(){
  const [tip,setTip]=useState(null),timer=useRef(null),target=useRef(null);
  useEffect(()=>{
    function dismiss(){clearTimeout(timer.current);target.current=null;setTip(null);}
    function show(node){
      const button=node?.closest?.('button[aria-label],a[aria-label]');
      if(!button||button.disabled||button.hasAttribute('title')||button.closest('.event-preview')||button.getAttribute('aria-describedby')||!button.querySelector('svg'))return;
      // Restrict to icon-only controls, including labels hidden by a collapsed sidebar.
      const visibleText=[...button.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||[...button.querySelectorAll('span,strong,small')].some(n=>n.textContent.trim()&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&!n.classList.contains('visually-hidden'));
      if(visibleText)return;
      const label=button.getAttribute('aria-label');if(!label||target.current===button)return;
      dismiss();target.current=button;
      timer.current=setTimeout(()=>{
        if(!button.isConnected)return;
        const r=button.getBoundingClientRect();
        setTip({label,left:Math.max(85,Math.min(window.innerWidth-85,r.left+r.width/2)),top:r.bottom+8,above:r.bottom+50>window.innerHeight,upper:r.top-8});
      },420);
    }
    const pointer=e=>{if(e.pointerType==='mouse')show(e.target);};
    const focus=e=>{if(e.target.matches?.(':focus-visible'))show(e.target);};
    const leave=e=>{if(target.current&&!target.current.contains(e.relatedTarget))dismiss();};
    const key=e=>{if(e.key==='Escape')dismiss();};
    document.addEventListener('pointerover',pointer);document.addEventListener('pointerout',leave);document.addEventListener('focusin',focus);document.addEventListener('focusout',leave);document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key);
    window.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);
    return()=>{clearTimeout(timer.current);document.removeEventListener('pointerover',pointer);document.removeEventListener('pointerout',leave);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',leave);document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key);window.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);};
  },[]);
  return tip?createPortal(<div className={'ux-icon-tooltip'+(tip.above?' above':'')} aria-hidden="true" style={{left:tip.left,top:tip.above?tip.upper:tip.top}}>{tip.label}</div>,document.querySelector('dialog[open]')||document.body):null;
}
