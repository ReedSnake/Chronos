import { useEffect, useRef, useState } from 'react';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = (n) => { const x = clamp(n, 0, 1); return x * x * (3 - 2 * x); };
const grid = [];
for (let y = 3; y < 220; y += 4.3) {
  for (let x = 3; x < 260; x += 4.3) grid.push({ x, y });
}
function field(x, y, cx, cy, rx, ry) {
  return 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
}
const bodyDots = grid.flatMap(({ x, y }) => {
  const d = Math.max(field(x, y, 130, 107, 77, 91), field(x, y, 130, 143, 88, 64));
  if (d <= -.045) return [];
  const radius = 2.65 * smooth((d + .045) / .58);
  return radius > .12 ? [{ x, y, radius, opacity: .65 + .35 * smooth(d / .4) }] : [];
});
const handDots = grid.flatMap(({ x, y }) => {
  const dx = x - 130, dy = y - 107;
  const d = field(dx, dy, 0, 0, 24, 21);
  return d > 0 ? [{ x: dx, y: dy, radius: 2.45 * smooth(d / .6) }] : [];
});

function Hand({ x, y, raised }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 380ms cubic-bezier(.2,.8,.3,1.15)' }} className="mascot-moving-hand">
      {handDots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={dot.radius} fill={raised ? '#397fae' : '#70b5df'} />)}
    </g>
  );
}

export function BlobMascot({ mood = 'idle' }) {
  const svg = useRef(null);
  const eyes = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const hidden = mood === 'private';
  const peeking = mood === 'peek';

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame, timer, reopen;
    let x = 0, y = 0;
    function track(event) {
      const box = svg.current?.getBoundingClientRect();
      if (!box) return;
      target.current = {
        x: 24 * Math.tanh((event.clientX - box.left - box.width / 2) / (box.width * .65)),
        y: 19 * Math.tanh((event.clientY - box.top - box.height * .44) / (box.height * .65)),
      };
    }
    function reset() { target.current = { x: 0, y: 0 }; }
    function tick() {
      const desired = hidden ? { x: 0, y: 0 } : target.current;
      x += (desired.x - x) * (media.matches ? 1 : .20);
      y += (desired.y - y) * (media.matches ? 1 : .20);
      if (eyes.current) eyes.current.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      frame = requestAnimationFrame(tick);
    }
    function scheduleBlink() {
      timer = window.setTimeout(() => {
        if (!media.matches) setBlink(true);
        reopen = window.setTimeout(() => { setBlink(false); scheduleBlink(); }, 150);
      }, 2600 + Math.random() * 2600);
    }
    window.addEventListener('mousemove', track, { passive: true, capture: true });
    document.addEventListener('pointerleave', reset);
    frame = requestAnimationFrame(tick);
    scheduleBlink();
    return () => {
      window.removeEventListener('mousemove', track, true);
      document.removeEventListener('pointerleave', reset);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      clearTimeout(reopen);
    };
  }, [mood, hidden]);

  const eyeHeight = blink || mood === 'success' ? 3 : mood === 'error' ? 10 : 15;
  return (
    <svg ref={svg} className="chronos-mascot" data-mood={mood} viewBox="0 0 260 220" aria-hidden="true">
      <g className="mascot-body">
        <g fill="#70b5df">
          {bodyDots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={dot.radius} opacity={dot.opacity} />)}
        </g>
        <g ref={eyes} style={{ willChange: "transform" }}>
          {[99, 161].map(cx => (
            <g key={cx} transform={`translate(${cx} 98)`}>
              <g style={{ transform: `scaleY(${eyeHeight / 15})`, transition: 'transform 130ms ease' }} className="mascot-blinking-eye">
                {[-12,-8,-4,0,4,8,12].flatMap(y => [-8,-4,0,4,8].map(x => {
                  const d = field(x, y, 0, 0, 10, 16);
                  return d > 0 ? <circle key={`${x}:${y}`} cx={x} cy={y} r={1.85 + .35 * d} fill="#202b37" /> : null;
                }))}
              </g>
            </g>
          ))}
        </g>
        <Hand x={hidden || peeking ? 99 : 38} y={hidden || peeking ? 98 : 139} raised={hidden || peeking} />
        <Hand x={hidden ? 161 : peeking ? 181 : 222} y={hidden ? 98 : peeking ? 125 : 139} raised={hidden || peeking} />
      </g>
    </svg>
  );
}
