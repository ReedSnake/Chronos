import { useRef, useState } from 'react';
import { slotMinute } from './calendarInteractions';
import { selectedInterval } from './planningPreferences';

// Mouse-only drag selection; touch retains the existing tap and scroll behavior.
export function useSlotSelection(onCreateAt) {
  const drag = useRef(null), suppress = useRef(null);
  const [preview, setPreview] = useState(null);
  function bind(id, day, axis, first, last, enabled) {
    const coordinate = event => axis === 'x' ? event.clientX : event.clientY;
    const minute = event => {
      const rect = event.currentTarget.getBoundingClientRect();
      return slotMinute(axis === 'x' ? (event.clientX-rect.left)/rect.width : (event.clientY-rect.top)/rect.height, first, last);
    };
    function clear() { drag.current = null; setPreview(null); }
    return {
      onPointerDown(event) {
        if (!enabled || event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;
        suppress.current = null;
        drag.current = { id, pointer: event.pointerId, origin: coordinate(event), start: minute(event), moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event) {
        const current = drag.current;
        if (!current || current.id !== id || current.pointer !== event.pointerId) return;
        if (!current.moved && Math.abs(coordinate(event)-current.origin)<6) return;
        current.moved = true;
        const interval = selectedInterval(current.start, minute(event), first, last);
        setPreview({ id, ...interval });
      },
      onPointerUp(event) {
        const current = drag.current;
        if (!current || current.id !== id || current.pointer !== event.pointerId) return;
        clear();
        if (!current.moved) return;
        suppress.current = id;
        const interval = selectedInterval(current.start, minute(event), first, last);
        onCreateAt?.(day, interval.start, interval.duration);
      },
      onPointerCancel: clear,
      onLostPointerCapture: clear,
      onClick(event) {
        if (suppress.current === id) { suppress.current = null; return; }
        if (enabled && !event.target.closest('button')) onCreateAt?.(day, minute(event));
      },
      style: preview?.id === id ? {
        '--selection-start': ((preview.start-first*60)/((last-first)*60)*100)+'%',
        '--selection-end': ((preview.start+preview.duration-first*60)/((last-first)*60)*100)+'%'
      } : undefined,
    };
  }
  return bind;
}
