import { useEffect, useRef } from 'react';

const W = 260;
const H = 220;
const STEP = 4.5;
const BLUE = '#75b6de';
const DARK = '#25282d';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = v => { const u = clamp(v, 0, 1); return u * u * (3 - 2 * u); };
const ellipse = (x, y, cx, cy, rx, ry) => 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;

// The reference uses one regular halftone lattice, including the face and arms.
const lattice = [];
for (let y = 2.5; y < H; y += STEP) {
  for (let x = 2.5; x < W; x += STEP) {
    const v = (y - 111) / 99;
    const dome = 1 - ((x - 130) / (96 + 19 * v)) ** 2 - v ** 2;
    const lower = Math.max(
      ellipse(x, y, 101, 159, 63, 48),
      ellipse(x, y, 159, 159, 63, 48),
    );
    lattice.push({ x, y, body: Math.max(dome, lower) });
  }
}

function drawMascot(ctx, pose) {
  const { gazeX, gazeY, blink, handL, handR, breath, mode } = pose;
  ctx.save();
  ctx.translate(130, 207);
  ctx.scale(1 - breath * .45, 1 + breath);
  ctx.translate(-130, -207);

  for (const { x, y, body } of lattice) {
    const l = ellipse(x, y, handL.x, handL.y, 24, 21);
    const r = ellipse(x, y, handR.x, handR.y, 24, 21);
    const silhouette = Math.max(body, l, r);
    if (silhouette <= -.025) continue;
    const edge = smooth((silhouette + .025) / .23);
    // Large central dots leave small cream gaps; the outer dots taper gently.
    const radius = edge * mix(1.45, 2.78, smooth((silhouette - .10) / .72));
    const e1 = ellipse(x, y, 94 + gazeX, 92 + gazeY, 10.5, Math.max(1.9, 15.5 * blink));
    const e2 = ellipse(x, y, 166 + gazeX, 92 + gazeY, 10.5, Math.max(1.9, 15.5 * blink));
    const eye = Math.max(e1, e2);
    const handInk = Math.max(l * handL.cover, r * handR.cover);
    const cover = smooth((handInk + .015) / .19);
    const eyeInk = smooth((eye + .12) / .32) * (1 - cover);
    const halo = smooth((eye + .5) / .36) * (1 - cover);
    const base = handInk > .04 ? '#559bc8' : BLUE;
    const dotRadius = mix(radius * (1 - halo * .55), 2.13, eyeInk);
    if (dotRadius < .12) continue;
    ctx.globalAlpha = eyeInk > .5 ? 1 : .72 + .28 * edge;
    ctx.fillStyle = eyeInk > .6 ? DARK : eyeInk > .15 ? '#506e83' : base;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  if (mode === 'meeting') {
    ctx.globalAlpha = .9;
    ctx.strokeStyle = '#559bc8';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(230, 50, 10, 0, 2 * Math.PI);
    ctx.moveTo(230, 43); ctx.lineTo(230, 50); ctx.lineTo(235, 53); ctx.stroke();
  }
  if (mode === 'birthday') {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e5ad72';
    ctx.beginPath(); ctx.moveTo(116, 23); ctx.lineTo(133, 2); ctx.lineTo(146, 23); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function BlobMascot({ mood = 'idle', compact = false, caret = null }) {
  const canvas = useRef(null);
  const inputs = useRef({ mood, caret });
  inputs.current = { mood, caret };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext('2d');
    if (!ctx) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pixelRatio = 1;
    let visible = true;
    let frame = 0;
    let last = performance.now();
    let lastPointer = -Infinity;
    let lastTyping = -Infinity;
    let previousCaret = null;
    let previousMood = '';
    let blinkAt = last + 4200;
    let blinkStart = -Infinity;
    let pointerX = 0, pointerY = 0;
    let gazeX = 0, gazeY = 0;
    const handL = { x: 28, y: 126, cover: 0 };
    const handR = { x: 232, y: 126, cover: 0 };

    function resize() {
      const width = el.getBoundingClientRect().width || W;
      pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2) * width / W);
      el.width = Math.round(W * pixelRatio);
      el.height = Math.round(H * pixelRatio);
    }

    function move(event) {
      if (event.pointerType === 'touch') return;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const dx = (event.clientX - box.left) / box.width * W - 130;
      const dy = (event.clientY - box.top) / box.height * H - 92;
      const distance = Math.hypot(dx, dy);
      const amount = Math.tanh(distance / 100);
      pointerX = distance ? dx / distance * amount : 0;
      pointerY = distance ? dy / distance * amount : 0;
      lastPointer = performance.now();
    }

    function type(event) {
      if (event.target?.tagName === 'INPUT' && event.target.dataset.password === undefined) {
        lastTyping = performance.now();
      }
    }

    function reset() { pointerX = 0; pointerY = 0; }

    function updateHand(hand, x, y, cover, k) {
      hand.x = mix(hand.x, x, k);
      hand.y = mix(hand.y, y, k);
      hand.cover = mix(hand.cover, cover, k);
    }

    function draw(now) {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(50, now - last);
      last = now;
      if (!visible || document.hidden) return;
      const { mood: mode, caret: cursor } = inputs.current;
      const quiet = reduced.matches;
      if (cursor !== previousCaret) { previousCaret = cursor; lastTyping = now; }
      const privateMode = mode === 'private';
      const peek = mode === 'peek';
      const reading = mode === 'reading' && lastTyping > lastPointer && now - lastTyping < 1400;
      const eyeEase = quiet ? 1 : 1 - Math.exp(-dt / 145);
      const handEase = quiet ? 1 : 1 - Math.exp(-dt / 220);
      const lookX = privateMode ? 0 : reading ? ((cursor ?? .5) - .5) * 10 : pointerX * 6.5;
      const lookY = privateMode ? 0 : reading ? 5 : pointerY * 5.5;
      gazeX = mix(gazeX, lookX, eyeEase);
      gazeY = mix(gazeY, lookY, eyeEase);

      if (mode !== previousMood) {
        if (mode === 'error' || mode === 'success') blinkAt = Math.min(blinkAt, now + 280);
        previousMood = mode;
      }
      if (now >= blinkAt) {
        blinkStart = now;
        blinkAt = now + 4000 + Math.random() * 3000;
      }
      const blinkAge = (now - blinkStart) / 240;
      const blink = !quiet && blinkAge >= 0 && blinkAge <= 1 ? 1 - .93 * Math.sin(Math.PI * blinkAge) : 1;

      updateHand(handL, privateMode || peek ? 94 : 28, privateMode || peek ? 92 : 126, privateMode || peek ? 1 : 0, handEase);
      updateHand(handR, privateMode ? 166 : peek ? 186 : 232, privateMode ? 92 : peek ? 116 : 126, privateMode || peek ? 1 : 0, handEase);

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawMascot(ctx, { gazeX, gazeY, blink, handL, handR, breath: quiet ? 0 : Math.sin(now / 900) * .006, mode });
    }

    resize();
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }) : null;
    observer?.observe(el);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(el);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true, capture: true });
    window.addEventListener('input', type, true);
    window.addEventListener('blur', reset);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('input', type, true);
      window.removeEventListener('blur', reset);
    };
  }, []);

  return <canvas ref={canvas} className="chronos-mascot chronos-canvas" style={compact ? { width: 112, height: 95 } : undefined} aria-hidden="true" />;
}
