import { useEffect, useRef, useState } from 'react';
import { BlobMascot } from './BlobMascot';
import { CarrotArt } from './CarrotArt';
import { useLocale } from '../../i18n/LocaleProvider';

const CARROTS = [
  { id: 1, size: 52, angle: -31, x: 13, y: 26, mx: 1, my: 13 },
  { id: 2, size: 76, angle: 34, x: 24, y: 65, mx: 2, my: 65 },
  { id: 3, size: 41, angle: 22, x: 8, y: 79, mx: 14, my: 89 },
  { id: 4, size: 66, angle: -26, x: 85, y: 26, mx: 99, my: 12 },
  { id: 5, size: 47, angle: 38, x: 75, y: 57, mx: 98, my: 64 },
  { id: 6, size: 83, angle: 15, x: 90, y: 80, mx: 86, my: 90 },
];
export const EAT_MS = 3000;

export function canDropCarrot(rect, x, y) {
  return x >= rect.left + rect.width * .14 && x <= rect.right - rect.width * .14
    && y >= rect.top + rect.height * .08 && y <= rect.bottom - rect.height * .03;
}

export function RabbitPlayground({ mood, caret }) {
  const { locale } = useLocale();
  const area = useRef(null);
  const activeDrag = useRef(null);
  const activeFeed = useRef(null);
  const [drag, setDrag] = useState(null);
  const [feed, setFeed] = useState(null);
  const [eaten, setEaten] = useState([]);
  const privateMode = mood === 'private' || mood === 'peek';
  const blocked = privateMode || mood === 'loading';
  const isUk = locale === 'uk';
  const unavailable = blocked || Boolean(feed);

  function startFeeding(id) {
    const pose = area.current?.querySelector('.rabbit-stage')?.dataset.pose;
    if (blocked || activeFeed.current || eaten.includes(id) || ['away', 'turning', 'returning'].includes(pose)) return;
    const next = { id, startedAt: performance.now() };
    activeFeed.current = next;
    setFeed(next);
  }

  useEffect(() => {
    if (!feed) return;
    if (blocked) { activeFeed.current = null; setFeed(null); return; }
    const timer = window.setTimeout(() => {
      activeFeed.current = null;
      setEaten(previous => [...previous, feed.id]);
      setFeed(null);
    }, Math.max(0, EAT_MS - (performance.now() - feed.startedAt)));
    return () => window.clearTimeout(timer);
  }, [feed, blocked]);

  useEffect(() => {
    if (eaten.length !== CARROTS.length) return;
    const timer = window.setTimeout(() => setEaten([]), 1700);
    return () => window.clearTimeout(timer);
  }, [eaten.length]);

  useEffect(() => {
    if (!blocked) return;
    activeDrag.current = null;
    setDrag(null);
  }, [blocked]);

  function onDown(event, carrot) {
    if (unavailable || activeDrag.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { id: carrot.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    activeDrag.current = next;
    setDrag(next);
  }

  function onMove(event) {
    const current = activeDrag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const next = { ...current, x: event.clientX, y: event.clientY };
    activeDrag.current = next;
    setDrag(next);
  }

  function onEnd(event, cancelled = false) {
    const current = activeDrag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    activeDrag.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const rabbit = area.current?.querySelector('.rabbit-stage');
    if (!cancelled && rabbit && canDropCarrot(rabbit.getBoundingClientRect(), event.clientX, event.clientY)) startFeeding(current.id);
  }

  return (
    <div className="rabbit-playground" ref={area}>
      <BlobMascot mood={mood} caret={caret} feeding={feed} dragging={Boolean(drag)} />
      {CARROTS.filter(carrot => !eaten.includes(carrot.id) && feed?.id !== carrot.id).map(carrot => {
        const held = drag?.id === carrot.id;
        const style = held
          ? { position: 'fixed', left: drag.x, top: drag.y, width: carrot.size, height: carrot.size * 1.35, transform: 'translate(-50%, -50%) rotate(-12deg)', zIndex: 30 }
          : { '--carrot-x': carrot.x+'vw', '--carrot-y': carrot.y+'vh', '--carrot-mx': carrot.mx+'%', '--carrot-my': carrot.my+'%', '--carrot-size': carrot.size+'px', '--carrot-angle': carrot.angle+'deg' };
        return (
          <button key={carrot.id} type="button" className={`rabbit-carrot${held?' is-held':''}`}
            style={style} disabled={unavailable} aria-label={isUk ? 'Дати кролику моркву' : 'Feed the rabbit a carrot'}
            onPointerDown={event => onDown(event, carrot)} onPointerMove={onMove}
            onPointerUp={event => onEnd(event)} onPointerCancel={event => onEnd(event, true)}
            onLostPointerCapture={event => onEnd(event, true)}
            onClick={event => { if (event.detail === 0) startFeeding(carrot.id); }}>
            <svg viewBox="-25 -5 50 86" width="100%" height="100%" aria-hidden="true"><CarrotArt /></svg>
          </button>
        );
      })}
      <span className="rabbit-feed-status" role="status">{feed && (isUk ? 'Кролик їсть моркву' : 'The rabbit is eating a carrot')}</span>
    </div>
  );
}
