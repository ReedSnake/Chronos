import { useEffect, useRef } from 'react';
import { rabbitImage } from './rabbitImage';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = (from, to, dt, time) => from + (to - from) * (1 - Math.exp(-dt / time));

// Keep the original artwork intact. Movement is applied to its silhouette,
// not to individual pixels, and never reads the password value.
export function BlobMascot({ mood = 'idle', compact = false, caret = null }) {
  const stage = useRef(null);
  const rabbit = useRef(null);
  const state = useRef({ mood, caret });
  state.current = { mood, caret };

  useEffect(() => {
    const el = stage.current, image = rabbit.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0, at: -Infinity };
    let frame, last = performance.now(), visible = true;
    let x = 0, y = 0, turn = 0, angle = 0, stretch = 0, phase = 0;
    let direction = 1, privacyDirection = -1, previousMood = '', moodAt = last;
    let previousCaret = null, typedAt = -Infinity, clickedAt = -Infinity;
    let moving = false;

    function move(event) {
      if (event.pointerType === 'touch') return;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pointer.x = clamp((event.clientX - box.left - box.width / 2) / (box.width * .65), -1, 1);
      pointer.y = clamp((event.clientY - box.top - box.height / 2) / (box.height * .8), -1, 1);
      pointer.at = performance.now();
    }
    function reset() { pointer.x = 0; pointer.y = 0; pointer.at = -Infinity; }
    function tap() { clickedAt = performance.now(); }

    function draw(now) {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(now - last, 50);
      last = now;
      if (!visible || document.hidden) return;
      const reduced = motion.matches;
      const { mood: mode, caret: cursor } = state.current;
      const privacy = mode === 'private' || mode === 'peek';
      if (mode !== previousMood) {
        if (privacy && previousMood !== 'private' && previousMood !== 'peek') privacyDirection = -direction;
        previousMood = mode; moodAt = now;
      }
      if (cursor !== previousCaret) { previousCaret = cursor; typedAt = now; }
      const age = now - moodAt;
      const typing = mode === 'reading' && typedAt > pointer.at && now - typedAt < 1600;
      const following = !privacy && now - pointer.at < 3500 && !typing && mode !== 'loading';
      const box = el.getBoundingClientRect();
      const travel = Math.max(0, (box.width - image.offsetWidth) / 2 - 2);
      const targetX = privacy ? privacyDirection * travel * .65
        : following ? pointer.x * travel
        : typing ? ((cursor ?? .5) - .5) * travel * .8 : 0;
      const difference = targetX - x;
      if (privacy) direction = privacyDirection;
      else if (Math.abs(difference) > 2) direction = difference > 0 ? 1 : -1;
      else if (following && Math.abs(pointer.x) > .15) direction = pointer.x > 0 ? 1 : -1;
      moving = Math.abs(difference) > 1.5 && !privacy && !reduced;
      const targetTurn = privacy ? (direction > 0 ? -42 : 138) : direction > 0 ? 0 : 180;
      turn = reduced ? targetTurn : ease(turn, targetTurn, dt, 150);
      x = reduced ? targetX : ease(x, targetX, dt, privacy ? 250 : 180);

      if (moving) phase += dt / 470 * Math.PI * 2;
      else phase = 0;
      const stride = moving ? Math.max(0, Math.sin(phase)) : 0;
      const hop = stride * (compact ? 4 : 10);
      const celebration = !reduced && mode === 'success' && age < 1100 ? Math.sin(Math.PI * age / 1100) * 15 : 0;
      const clicked = !reduced && now - clickedAt < 700 ? Math.sin(Math.PI * (now - clickedAt) / 700) * 9 : 0;
      const breath = reduced ? 0 : Math.sin(now / 1150) * 1.2;
      const targetY = privacy ? 0 : -hop - celebration - clicked + breath;
      y = reduced ? 0 : ease(y, targetY, dt, 65);
      const targetAngle = privacy ? -direction * 8
        : moving ? direction * (5 + stride * 4)
        : typing ? direction * 5
        : following ? direction * pointer.y * 5
        : mode === 'error' || mode === 'offline' ? direction * 5
        : mode === 'loading' ? Math.sin(now / 700) * 3 : 0;
      angle = reduced ? 0 : ease(angle, targetAngle, dt, 180);
      stretch = reduced ? 0 : ease(stretch, moving ? Math.sin(phase) * .035 : 0, dt, 80);

      image.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${angle.toFixed(2)}deg) rotateY(${turn.toFixed(2)}deg) scale(${(1 - stretch).toFixed(3)},${(1 + stretch).toFixed(3)})`;
      el.dataset.pose = privacy ? 'away' : moving ? 'running' : mode;
    }

    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }) : null;
    observer?.observe(el);
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('blur', reset);
    el.addEventListener('pointerdown', tap);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('blur', reset);
      el.removeEventListener('pointerdown', tap);
    };
  }, [compact]);

  return (
    <div ref={stage} className="chronos-mascot rabbit-stage" aria-hidden="true"
      style={{ width: compact ? 112 : 'min(100%, 360px)', height: compact ? 95 : 'clamp(190px, 58vw, 270px)', aspectRatio: 'auto', position: 'relative', display: 'grid', placeItems: 'center', perspective: '650px', cursor: 'pointer' }}>
      <img ref={rabbit} src={rabbitImage} alt="" draggable="false"
        style={{ display: 'block', width: compact ? '76%' : '72%', height: '92%', objectFit: 'contain', transformOrigin: 'center 86%', pointerEvents: 'none', userSelect: 'none' }} />
    </div>
  );
}
