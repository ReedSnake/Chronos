import { useId } from 'react';

// Shared vector artwork for the draggable carrots and the rabbit's snack.
export function CarrotArt({ progress = 0 }) {
  const id = useId();
  const remaining = Math.max(0, 1 - progress);
  const rootLength = 54 * remaining;
  return (
    <g>
      <defs>
        <linearGradient id={id+'-root'} x1="0%" y1="12%" x2="100%" y2="82%">
          <stop offset="0" stopColor="#ffe6a2" />
          <stop offset=".28" stopColor="#ffba55" />
          <stop offset=".75" stopColor="#ff8a3c" />
          <stop offset="1" stopColor="#ed6b32" />
        </linearGradient>
        <linearGradient id={id+'-leaf'} x1="15%" y1="0%" x2="90%" y2="100%">
          <stop offset="0" stopColor="#a6ca83" />
          <stop offset="1" stopColor="#558d61" />
        </linearGradient>
      </defs>
      <g opacity={Math.min(1, remaining * 8)}>
        <path d="M 0 23 C -6 14 -15 9 -12 3 C -8 -3 -1 5 1 15 C 0 4 5 -3 10 1 C 16 6 8 15 4 23 C 13 10 23 11 22 17 C 20 23 10 25 1 28Z" fill={`url(#${id}-leaf)`} />
        <g transform={`translate(0 24) scale(1 ${Math.max(.02,remaining)})`}>
          <path d="M -14 0 C -19 -8 -12 -12 0 -12 C 12 -12 19 -6 15 3 C 12 15 6 34 1 51 Q 0 56 -3 51 C -9 34 -15 16 -14 0Z" fill={`url(#${id}-root)`} />
          <path d="M -13 6 Q -7 9 -3 8 M 13 16 Q 7 19 4 18 M -7 27 Q -3 29 1 28" fill="none" stroke="#d66c37" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M -9 -5 Q -12 4 -8 12" fill="none" stroke="#fff0ce" strokeWidth="2.8" strokeOpacity=".7" strokeLinecap="round" />
        </g>
        <g opacity={progress > 0 ? .85 : 0}>
          <circle cx="1" cy={24+rootLength} r="2.2" fill="#ffe1a0" />
        </g>
      </g>
    </g>
  );
}
