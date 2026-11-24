import { useId } from 'react';

// Rounded cartoon carrot shared by draggable snacks and the chewing animation.
export function CarrotArt({ progress = 0 }) {
  const id = useId();
  const remaining = Math.max(0, 1 - progress);
  return (
    <g opacity={Math.min(1, remaining * 8)}>
      <defs>
        <linearGradient id={id+'-root'} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0" stopColor="#ffbf5a"/><stop offset=".45" stopColor="#ff9a36"/><stop offset="1" stopColor="#f5752c"/>
        </linearGradient>
        <linearGradient id={id+'-leaf'} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0" stopColor="#b7df72"/><stop offset="1" stopColor="#62ac59"/>
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-leaf)`} stroke="#508d49" strokeWidth="1.65" strokeLinejoin="round" strokeLinecap="round">
        <path d="M0 23 C-5 12 -17 13 -17 5 C-17 -2 -8 -1 -4 5 Q1 12 0 23Z"/>
        <path d="M0 23 C-4 12 -7 2 -1 -2 C6 -6 12 2 8 10 Q5 19 0 23Z"/>
        <path d="M0 23 C5 11 15 4 20 10 C25 17 13 23 0 23Z"/>
        <path d="M0 22 L-8 7 M0 22 L3 4 M0 22 L14 13" fill="none" opacity=".55"/>
      </g>
      <g transform={`translate(0 24) scale(1 ${Math.max(.02, remaining)})`}>
        <path d="M-17 -1 C-19 -11 -7 -15 0 -14 C10 -15 20 -10 17 1 C15 15 7 37 2 51 Q0 57 -4 50 C-11 35 -16 14 -17 -1Z" fill={`url(#${id}-root)`} stroke="#d8662d" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M-11 -3 Q-13 4 -10 13" fill="none" stroke="#ffe6a7" strokeWidth="4" strokeLinecap="round"/>
        <path d="M-15 7 Q-10 10 -6 9 M13 17 Q8 20 5 19 M-8 29 Q-4 32 0 30" fill="none" stroke="#d8662d" strokeWidth="2.3" strokeLinecap="round"/>
        <circle cx="6" cy="-6" r="2.3" fill="#ffda88" opacity=".85"/>
      </g>
    </g>
  );
}
