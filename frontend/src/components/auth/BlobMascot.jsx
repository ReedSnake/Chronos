import { useId } from 'react';

export function BlobMascot({ mood = 'idle' }) {
  const dots = useId();
  const hidden = mood === 'private';
  const peeking = mood === 'peek';
  return (
    <svg className="chronos-mascot" data-mood={mood} viewBox="0 0 260 220" aria-hidden="true">
      <defs>
        <pattern id={dots} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.85" fill="#64a9d8" />
        </pattern>
      </defs>
      <g className="mascot-body">
        <path d="M130 15 C78 15 45 59 39 115 C24 156 45 201 93 204 Q130 216 167 204 C215 201 236 156 221 115 C215 59 182 15 130 15Z" fill={`url(#${dots})`} />
        <g className="mascot-eyes">
          <ellipse cx="102" cy="94" rx="9" ry={mood === 'success' ? 4 : 15} fill="#253648" />
          <ellipse cx="158" cy="94" rx="9" ry={mood === 'success' ? 4 : 15} fill="#253648" />
        </g>
        <ellipse className="mascot-hand" cx={hidden || peeking ? 102 : 38} cy={hidden || peeking ? 94 : 139} rx="23" ry="24" fill="#6ba9d0" />
        <ellipse className="mascot-hand" cx={hidden ? 158 : peeking ? 186 : 222} cy={hidden ? 94 : peeking ? 125 : 139} rx="23" ry="24" fill="#6ba9d0" />
      </g>
    </svg>
  );
}
