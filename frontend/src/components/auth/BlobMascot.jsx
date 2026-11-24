import { useEffect, useRef } from 'react';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, k) => a + (b - a) * k;
const field = (x, y, cx, cy, rx, ry) => 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
const smooth = v => { const n = clamp(v, 0, 1); return n * n * (3 - 2 * n); };
const grid = [];
for (let y = 2; y < 220; y += 3.8) for (let x = 2; x < 260; x += 3.8) grid.push([x, y]);

// A shared halftone lattice keeps the body, eyes and hands visually coherent.
export function BlobMascot({ mood = 'idle', compact = false, caret = null }) {
  const canvas = useRef(null);
  const current = useRef({ mood, caret });
  current.current = { mood, caret };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 130, y: 100, inside: false, at: 0, speed: 0 };
    let frame, last = performance.now(), activity = last, hoverAt = 0;
    let blinkAt = last + 2800, blinkUntil = 0, doubleBlink = false;
    let clickAt = -10000, clicks = 0, stroke = 0, gestureAt = -10000;
    let gx = 0, gy = 0, tilt = 0, sx = 1, sy = 1, lift = 0, eyeOpen = 1;
    let lx = 35, ly = 137, rx = 225, ry = 137, lastMood = '', moodAt = last;
    let dpr = 1, visible = true;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(260 * dpr);
      el.height = Math.round(220 * dpr);
    }
    function move(e) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const now = performance.now();
      const x = (e.clientX - box.left) * 260 / box.width;
      const y = (e.clientY - box.top) * 220 / box.height;
      const inside = x >= 0 && x <= 260 && y >= 0 && y <= 220;
      if (inside && !pointer.inside) hoverAt = now;
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      pointer.speed = lerp(pointer.speed, distance / Math.max(12, now - pointer.at), .35);
      if (inside && pointer.inside && distance > 2 && distance < 38) {
        stroke += distance;
        if (stroke > 120) { gestureAt = now; stroke = 0; }
      } else if (!inside) stroke = 0;
      Object.assign(pointer, { x, y, inside, at: now });
      activity = now;
    }
    function key() { activity = performance.now(); }
    function leave() { pointer.inside = false; pointer.x = 130; pointer.y = 100; }
    function tap() {
      const now = performance.now();
      clicks = now - clickAt < 1100 ? clicks + 1 : 1;
      clickAt = activity = now;
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }) : null;
    observer?.observe(el);
    function dot(x, y, r, color, alpha = 1) {
      if (r < .15) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    function draw(now) {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(50, now - last); last = now;
      if (!visible || document.hidden) return;
      const reduced = media.matches;
      const k = reduced ? 1 : 1 - Math.exp(-dt / 95);
      const { mood: mode, caret: cursor } = current.current;
      if (mode !== lastMood) { lastMood = mode; moodAt = now; }
      const age = (now - moodAt) / 1000, t = now / 1000;
      const privateMode = mode === 'private', peek = mode === 'peek';
      const sleeping = (mode === 'idle' || mode === 'empty') && now - activity > 35000;
      const bored = mode === 'empty' || (mode === 'idle' && now - activity > 12000);
      const surprised = now - clickAt < 700, annoyed = surprised && clicks >= 3;
      const pet = now - gestureAt < 1200;
      const reach = pointer.inside && now - hoverAt > 1200 && !privateMode && !peek;
      const dizzy = pointer.inside && pointer.speed > 1.8 && now - pointer.at < 120;
      const happy = mode === 'success' || mode === 'birthday';
      const sad = mode === 'error' || mode === 'offline';
      const waiting = mode === 'loading';
      const confused = mode === 'lost';
      const gazeX = mode === 'reading' && cursor != null ? cursor * 2 - 1 : Math.tanh((pointer.x - 130) / 125);
      const gazeY = mode === 'reading' && cursor != null ? .8 : Math.tanh((pointer.y - 98) / 100);
      const gazeOff = privateMode || sleeping;
      gx = lerp(gx, gazeOff ? 0 : bored && !pointer.inside ? Math.sin(t * .8) * 15 : gazeX * 23, k);
      gy = lerp(gy, gazeOff ? 0 : sad ? 12 : gazeY * 17, k);
      const breath = reduced ? 0 : Math.sin(t * 2.1) * .025;
      const jump = happy && !reduced && age < 1.1 ? Math.max(0, Math.sin(age / 1.1 * Math.PI)) * 21 : 0;
      const lean = reduced ? 0 : (dizzy ? Math.sin(t * 13) * .13 : gazeX * .06 + (waiting || confused ? Math.sin(t * 4) * .055 : 0));
      tilt = lerp(tilt, privateMode ? 0 : lean, k);
      sx = lerp(sx, 1 + breath + (sad ? .035 : 0) - (jump ? .06 : 0), k);
      sy = lerp(sy, 1 - breath - (sad || sleeping || privateMode ? .065 : 0) + jump * .004, k);
      lift = lerp(lift, jump + (pointer.inside && !privateMode && !reduced ? 4 : 0), k);
      if (now > blinkAt) {
        blinkUntil = now + 140;
        blinkAt = doubleBlink ? now + 210 : now + 2500 + Math.random() * 3500;
        doubleBlink = !doubleBlink && Math.random() < .2;
      }
      eyeOpen = lerp(eyeOpen, sleeping || pet || (happy && age < 1.2) || (!reduced && now < blinkUntil) ? .12 : surprised ? 1.25 : annoyed || sad ? .65 : 1, k);
      const leftRaised = privateMode || peek, rightRaised = privateMode;
      lx = lerp(lx, leftRaised ? 98 : happy ? 40 : reach && pointer.x < 130 ? clamp(pointer.x, 16, 70) : 35, k);
      ly = lerp(ly, leftRaised ? 98 : happy ? 84 : reach && pointer.x < 130 ? clamp(pointer.y, 70, 150) : 137, k);
      rx = lerp(rx, rightRaised ? 162 : peek ? 186 : happy ? 220 : reach && pointer.x >= 130 ? clamp(pointer.x, 190, 244) : 225, k);
      ry = lerp(ry, rightRaised ? 98 : peek ? 124 : happy ? 84 : reach && pointer.x >= 130 ? clamp(pointer.y, 70, 150) : 137, k);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 260, 220);
      ctx.save();
      ctx.translate(130, 115 - lift); ctx.rotate(tilt); ctx.scale(sx, sy); ctx.translate(-130, -115);
      for (const [x, y] of grid) {
        const body = Math.max(field(x, y, 130, 106, 77, 91), field(x, y, 130, 143, 88, 64));
        const l = field(x, y, lx, ly, 25, 21), r = field(x, y, rx, ry, 25, 21);
        const d = Math.max(body, l, r);
        if (d <= -.05) continue;
        const radius = 2.35 * smooth((d + .05) / .58);
        const wave = reduced ? 0 : Math.sin(y * .055 + t * 2.2) * .65 * smooth(body + .1);
        const ex = x - gx, ey = y - gy;
        const eye = Math.max(field(ex, ey, 98, 98, 9.5, 15 * eyeOpen), field(ex, ey, 162, 98, 9.5, 15 * eyeOpen));
        const covered = (leftRaised && l > .02) || ((rightRaised || peek) && r > .02);
        const color = covered ? '#4088b8' : eye > 0 && !privateMode ? '#202b37' : '#70b5df';
        dot(x + wave, y, eye > 0 && !covered && !privateMode ? 2.1 : radius, color, .66 + .34 * smooth(d / .4));
      }
      if (mode === 'birthday') {
        for (const [x,y] of grid) if (y < 40 && y > 1 && Math.abs(x - 130) < y * .55) dot(x,y,1.8,y % 11 < 4 ? '#f3aa55' : '#e881a1');
      }
      if (mode === 'meeting') {
        ctx.globalAlpha = 1; ctx.strokeStyle = '#397fae'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(220, 65, 13, 0, Math.PI * 2); ctx.moveTo(220,55); ctx.lineTo(220,65); ctx.lineTo(227,69); ctx.stroke();
      }
      if (sleeping) { ctx.globalAlpha = .8; ctx.fillStyle = '#70b5df'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('z Z', 209, 40); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('keydown', key);
    window.addEventListener('blur', leave);
    el.addEventListener('pointerdown', tap);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', leave);
      el.removeEventListener('pointerdown', tap);
    };
  }, []);

  return <canvas ref={canvas} className="chronos-mascot chronos-canvas" style={compact ? { width: 112, height: 95 } : undefined} aria-hidden="true" />;
}
