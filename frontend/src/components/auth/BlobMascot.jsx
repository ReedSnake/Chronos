import { useEffect, useRef } from 'react';
import { rabbitPoses } from './rabbitPoses';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const ease = (from, to, dt, time) => from + (to - from) * (1 - Math.exp(-dt / time));
const TURN_MS = 900;
const FRAME_COUNT = 6;

export function BlobMascot({ mood = 'idle', compact = false, caret = null }) {
  const stage = useRef(null);
  const rabbit = useRef(null);
  const inputs = useRef({ mood, caret });
  inputs.current = { mood, caret };

  useEffect(() => {
    const el = stage.current;
    const sprite = rabbit.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0, at: -Infinity };
    let raf, last = performance.now(), visible = true;
    let x = 0, lift = 0, tilt = 0, phase = 0, turn = 0;
    let lastFrame = -1, previousMood = '', moodAt = last;
    let lastCaret = null, typedAt = -Infinity, clickAt = -Infinity;

    function move(event) {
      if (event.pointerType === 'touch') return;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pointer.x = clamp((event.clientX - box.left - box.width / 2) / (box.width * .8), -1, 1);
      pointer.y = clamp((event.clientY - box.top - box.height / 2) / (box.height * .8), -1, 1);
      pointer.at = performance.now();
    }
    function reset() { pointer.x = 0; pointer.y = 0; pointer.at = -Infinity; }
    function tap() {
      if (!['private', 'peek'].includes(inputs.current.mood) && turn === 0) clickAt = performance.now();
    }

    function draw(now) {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(50, now - last);
      last = now;
      if (!visible || document.hidden) return;
      const reduced = motion.matches;
      const { mood: mode, caret: cursor } = inputs.current;
      const privacy = mode === 'private' || mode === 'peek';
      if (mode !== previousMood) { previousMood = mode; moodAt = now; if (privacy) clickAt = -Infinity; }
      if (cursor !== lastCaret) { lastCaret = cursor; typedAt = now; }

      // Play the same original six frames in both directions. Interruptions
      // reverse from the current progress, without restarting or skipping poses.
      turn = reduced ? Number(privacy) : clamp(turn + (privacy ? 1 : -1) * dt / TURN_MS, 0, 1);
      const frame = Math.round(turn * (FRAME_COUNT - 1));
      if (frame !== lastFrame) {
        sprite.style.backgroundPosition = (frame * 100 / (FRAME_COUNT - 1)) + '% 50%';
        el.dataset.frame = String(frame + 1);
        lastFrame = frame;
      }
      const turning = privacy || turn > 0;
      const reading = !turning && mode === 'reading' && typedAt > pointer.at && now - typedAt < 1400;
      const following = !turning && !reading && mode !== 'loading' && now - pointer.at < 3500;
      const travel = Math.max(0, (el.clientWidth - sprite.offsetWidth) / 2 - 4);
      const targetX = turning ? 0 : following ? pointer.x * travel : reading ? ((cursor ?? .5) - .5) * travel * .55 : 0;
      const delta = targetX - x;
      const moving = !turning && !reduced && Math.abs(delta) > 2.5;
      x = reduced ? targetX : ease(x, targetX, dt, turning ? 160 : 230);
      if (moving) phase += dt / 680 * Math.PI * 2;
      else phase = 0;
      const hop = moving ? Math.max(0, Math.sin(phase)) * (compact ? 3 : 9) : 0;
      const age = now - moodAt;
      const celebration = !turning && !reduced && mode === 'success' && age < 1400 ? Math.abs(Math.sin(age / 1400 * Math.PI * 2)) * 13 : 0;
      const clicked = !turning && !reduced && now - clickAt < 700 ? Math.sin((now - clickAt) / 700 * Math.PI) * 12 : 0;
      const breathe = !turning && !reduced ? Math.sin(now / 800) * .007 : 0;
      lift = reduced ? 0 : ease(lift, turning ? 0 : -hop - celebration - clicked, dt, 70);
      const targetTilt = turning ? 0 : moving ? clamp(delta / 8, -7, 7) : reading ? 2 : following ? pointer.x * 3 : 0;
      tilt = reduced ? 0 : ease(tilt, targetTilt, dt, 180);
      sprite.style.transform = `translate3d(${x.toFixed(2)}px,${lift.toFixed(2)}px,0) rotate(${tilt.toFixed(2)}deg) scaleY(${(1 + breathe).toFixed(4)})`;
      el.dataset.pose = privacy ? (turn === 1 ? 'away' : 'turning') : turning ? 'returning' : moving ? 'running' : mode;
    }

    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }) : null;
    observer?.observe(el);
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('blur', reset);
    el.addEventListener('pointerdown', tap);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('blur', reset);
      el.removeEventListener('pointerdown', tap);
    };
  }, [compact]);

  return (
    <div ref={stage} className="chronos-mascot rabbit-stage" aria-hidden="true"
      style={{ width: compact ? 112 : 'min(100%, 360px)', height: compact ? 95 : 'clamp(190px, 58vw, 270px)', aspectRatio: 'auto', position: 'relative', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
      <div ref={rabbit} style={{ width: compact ? 65 : 'min(68%, 194px)', aspectRatio: '100 / 132', backgroundImage: `url("${rabbitPoses}")`, backgroundSize: '600% 100%', backgroundPosition: '0% 50%', backgroundRepeat: 'no-repeat', transformOrigin: 'center 94%', pointerEvents: 'none', willChange: 'transform' }} />
    </div>
  );
}
