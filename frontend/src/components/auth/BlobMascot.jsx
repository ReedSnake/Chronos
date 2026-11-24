import { useEffect, useId, useRef, useState } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (a, b, dt, ms) => a + (b - a) * (1 - Math.exp(-dt / ms));
const initial = { yaw: 0, x: 0, lift: 0, lean: 0, squash: 0, pet: 0, eye: 1, gx: 0, gy: 0, ear: 0 };
const isPrivate = mood => mood === 'private' || mood === 'peek';

function RabbitArt({ pose, compact }) {
  const id = useId();
  const paint = name => `url(#${id}-${name})`;
  const { yaw, x, lift, lean, squash, pet, eye, gx, gy, ear } = pose;
  const side = Math.sin(yaw);
  const front = Math.cos(yaw);
  const cx = 180;
  const hx = cx + 25 * side;
  const hy = 5 * pet;
  const faceOpacity = clamp(front * 3.2, 0, 1);
  const faceX = hx + 47 * side;
  const faceScale = Math.max(.12, front);
  const earSpread = 30 * Math.abs(front) + 7 * Math.abs(side);
  const earCenter = hx - 11 * side;
  const tailX = cx - 69 * side;
  const tailY = 251 - 5 * Math.abs(side);
  const tailScale = .85 + .15 * Math.abs(front);
  const tailOpacity = clamp((.35 - front) * 3, 0, 1);
  const tail = <ellipse cx={tailX} cy={tailY} rx={23 * tailScale} ry={24} fill={paint('tail')} opacity={tailOpacity} />;
  const earShape = 'M -22 8 C -30 -17 -37 -57 -29 -85 C -24 -106 -12 -118 3 -118 C 25 -118 35 -94 32 -66 C 29 -40 22 -10 15 8 Q -4 19 -22 8 Z';
  const body = `M ${hx} ${105 + hy}
    C ${hx - 39} ${104 + hy} ${hx - 66} ${126 + hy} ${hx - 66} ${155 + hy}
    C ${hx - 66} ${176 + hy} ${hx - 54} 185 ${cx - 59} 197
    C ${cx - 80} 217 ${cx - 92} 247 ${cx - 77} 270
    C ${cx - 62} 294 ${cx - 27} 291 ${cx - 10} 284
    Q ${cx} 279 ${cx + 10} 284
    C ${cx + 32} 293 ${cx + 64} 293 ${cx + 77} 269
    C ${cx + 91} 244 ${cx + 76} 211 ${cx + 57} 197
    C ${hx + 51} 185 ${hx + 66} ${177 + hy} ${hx + 66} ${154 + hy}
    C ${hx + 65} ${125 + hy} ${hx + 39} ${104 + hy} ${hx} ${105 + hy} Z`;
  const ears = [-1, 1].map(sign => {
    const back = sign * side > 0;
    const angle = sign * (12 + pet * 55 + ear * 3) - side * 27;
    const scale = back ? 1 - .13 * Math.abs(side) : 1;
    return { sign, back, angle, scale, x: earCenter + sign * earSpread, y: 130 + hy + (back ? 6 * Math.abs(side) : 0) };
  }).sort((a,b) => Number(b.back) - Number(a.back));
  const closed = clamp((1 - eye) * 1.25, 0, 1);
  return (
    <svg className="rabbit-art" viewBox="0 0 360 306" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id + '-body'} x1="22%" y1="100%" x2="75%" y2="4%">
          <stop offset="0" stopColor="#ffb447" />
          <stop offset=".18" stopColor="#ff914c" />
          <stop offset=".39" stopColor="#f4b7b1" />
          <stop offset=".65" stopColor="#a9a0e4" />
          <stop offset="1" stopColor="#7396ed" />
        </linearGradient>
        <radialGradient id={id + '-blue'} cx="79%" cy="25%" r="73%">
          <stop offset="0" stopColor="#4777dd" stopOpacity=".62" />
          <stop offset=".46" stopColor="#7795ee" stopOpacity=".31" />
          <stop offset="1" stopColor="#859be9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + '-warm'} cx="16%" cy="85%" r="71%">
          <stop offset="0" stopColor="#ff7d2f" stopOpacity=".78" />
          <stop offset=".50" stopColor="#ffc17b" stopOpacity=".34" />
          <stop offset="1" stopColor="#ffdbb1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + '-rim'} cx="53%" cy="55%" r="66%">
          <stop offset=".55" stopColor="#fff4dc" stopOpacity="0" />
          <stop offset=".82" stopColor="#fff4dc" stopOpacity=".17" />
          <stop offset="1" stopColor="#fff8ef" stopOpacity=".78" />
        </radialGradient>
        <linearGradient id={id + '-ear'} x1="8%" y1="65%" x2="91%" y2="22%">
          <stop offset="0" stopColor="#ffe7b8" />
          <stop offset=".28" stopColor="#e8bed9" />
          <stop offset=".60" stopColor="#8299ed" />
          <stop offset="1" stopColor="#537cdb" />
        </linearGradient>
        <radialGradient id={id + '-earLight'} cx="25%" cy="15%" r="85%">
          <stop offset="0" stopColor="#edf5ff" stopOpacity=".78" />
          <stop offset=".45" stopColor="#d4ddff" stopOpacity=".13" />
          <stop offset="1" stopColor="#496bd3" stopOpacity=".16" />
        </radialGradient>
        <radialGradient id={id + '-foot'} cx="22%" cy="19%" r="87%">
          <stop offset="0" stopColor="#ffedac" />
          <stop offset=".58" stopColor="#ffc069" />
          <stop offset="1" stopColor="#fb9746" />
        </radialGradient>
        <radialGradient id={id + '-tail'} cx="33%" cy="21%" r="86%">
          <stop offset="0" stopColor="#fff0d9" />
          <stop offset=".56" stopColor="#ffc7a2" />
          <stop offset="1" stopColor="#ffab58" />
        </radialGradient>
        <radialGradient id={id + '-blush'}>
          <stop offset="0" stopColor="#f285a4" stopOpacity=".57" />
          <stop offset="1" stopColor="#f285a4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + '-iris'} cx="33%" cy="20%" r="85%">
          <stop offset="0" stopColor="#68618c" />
          <stop offset=".55" stopColor="#2d2850" />
          <stop offset="1" stopColor="#241e3b" />
        </radialGradient>
        <linearGradient id={id + '-nose'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb1a2" /><stop offset="1" stopColor="#e9778c" />
        </linearGradient>
        <radialGradient id={id + '-shadow'}>
          <stop offset="0" stopColor="#a47779" stopOpacity=".19" />
          <stop offset="1" stopColor="#a47779" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx+x} cy="291" rx={85 - Math.abs(lift) * .6} ry="9" fill={paint('shadow')} opacity={1 - Math.min(.6, Math.abs(lift)/40)} />
      <g transform={`translate(${cx+x} ${286+lift}) rotate(${lean}) scale(${1+squash*.45} ${1-squash}) translate(-180 -286)`}>
        {front >= 0 && tail}
        {[-1,1].map(sign => <ellipse key={sign} cx={cx + sign * (65 - 9 * Math.abs(side)) + side * 8} cy="251" rx={25 - 4*Math.abs(side)} ry="31" fill={paint('foot')} opacity={clamp(1.2-front*-.1,0,1)} />)}
        {ears.map(e => <g key={e.sign} transform={`translate(${e.x} ${e.y}) rotate(${e.angle}) scale(${e.scale} ${1-pet*.06})`}>
          <path d={earShape} fill={paint('ear')} />
          <path d={earShape} fill={paint('earLight')} />
          <path d={earShape} fill={paint('rim')} opacity=".65" />
        </g>)}
        <path d={body} fill={paint('body')} />
        <path d={body} fill={paint('blue')} />
        <path d={body} fill={paint('warm')} />
        <path d={body} fill={paint('rim')} />
        {front < 0 && tail}
        <g opacity={faceOpacity} transform={`translate(${faceX} ${151+hy}) scale(${faceScale} 1)`}>
          <ellipse cx="-35" cy="16" rx="19" ry="14" fill={paint('blush')} opacity={.85+pet*.15} />
          <ellipse cx="35" cy="16" rx="19" ry="14" fill={paint('blush')} opacity={.85+pet*.15} />
          {[-24,24].map(ex => <g key={ex} transform={`translate(${ex+gx} ${gy})`}>
            <g opacity={1-closed} transform={`scale(1 ${Math.max(.08,eye)})`}>
              <ellipse rx="6.5" ry="10" fill={paint('iris')} />
              <ellipse cx="-1.9" cy="-3.9" rx="1.9" ry="2.3" fill="#fff7fc" opacity=".93" />
              <circle cx="2.6" cy="4.2" r="1" fill="#b6a8dc" opacity=".55" />
            </g>
            <path d="M -7 2 Q 0 -6 7 2" fill="none" stroke="#33264b" strokeWidth="2.4" strokeLinecap="round" opacity={closed} />
          </g>)}
          <path d="M -6 7 Q -7 3 -3.8 3 Q 0 2 3.8 3 Q 7 3 6 7 Q 4 11 0 11 Q -4 11 -6 7Z" fill={paint('nose')} />
          <path d={pet>.45 ? 'M 0 11 V 14 M -10 14 Q -5 21 0 15 Q 5 21 10 14' : 'M 0 11 V 14 M -9 15 Q -4 20 0 15 Q 4 20 9 15'} stroke="#4a3156" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

export function BlobMascot({ mood = 'idle', compact = false, caret = null }) {
  const stage = useRef(null);
  const current = useRef({ mood, caret });
  current.current = { mood, caret };
  const [pose, setPose] = useState(() => ({ ...initial, yaw: isPrivate(mood) ? Math.PI : 0 }));
  const [activity, setActivity] = useState('idle');

  useEffect(() => {
    const el = stage.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let p = { ...initial, yaw: isPrivate(current.current.mood) ? Math.PI : 0 };
    let pointer = { x: 0, y: 0, at: -Infinity, onHead: false, since: 0 };
    let raf = 0, last = performance.now(), lastPaint = 0, visible = true;
    let blinkAt = last+4200, blinkStart = -Infinity, clickAt = -Infinity;
    let mode = current.current.mood, modeAt = last, caretAt = -Infinity, oldCaret = current.current.caret;
    let turnDirection = 1, turnTarget = isPrivate(mode) ? Math.PI : 0, phase = 0;
    let lastActivity = '';

    function move(e) {
      if (e.pointerType === 'touch') return;
      const svg = el.querySelector('svg');
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / 360, rect.height / 306);
      if (!scale) return;
      const now = performance.now();
      const px = (e.clientX - rect.left - (rect.width - 360*scale)/2) / scale;
      const py = (e.clientY - rect.top - (rect.height - 306*scale)/2) / scale;
      const headX = 180 + p.x + Math.sin(p.yaw)*25;
      const headY = 115 + p.lift;
      const onHead = !compact && ((px-headX)/76)**2 + ((py-headY)/114)**2 < 1 && py < headY + 60;
      pointer = { x: clamp((px-180)/185,-1,1), y: clamp((py-150)/145,-1,1), at: now, onHead, since: onHead && pointer.onHead ? pointer.since : now };
    }
    function leave() { pointer.onHead = false; }
    function reset() { pointer = { x:0,y:0,at:-Infinity,onHead:false,since:0 }; }
    function click() { if (!isPrivate(current.current.mood)) clickAt = performance.now(); }

    function draw(now) {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden) { last=now; return; }
      if (now-lastPaint < 1000/45) return;
      const dt = Math.min(65, now-last);
      last=lastPaint=now;
      const reduced = motion.matches;
      const { mood: nextMode, caret: cursor } = current.current;
      const privacy = isPrivate(nextMode);
      if (nextMode !== mode) {
        if (privacy && !isPrivate(mode)) {
          turnDirection = p.yaw < -.08 ? -1 : p.yaw > .08 ? 1 : pointer.x < -.2 ? -1 : 1;
          clickAt = -Infinity;
        }
        mode=nextMode; modeAt=now;
      }
      if (cursor !== oldCaret) { oldCaret=cursor; caretAt=now; }
      const turning = privacy || Math.abs(p.yaw)> .75;
      const petting = !turning && pointer.onHead && now-pointer.since>260;
      const reading = !turning && !petting && mode==='reading' && caretAt>pointer.at && now-caretAt<1800;
      const following = !turning && !petting && !reading && now-pointer.at<3800 && mode!=='loading';
      const targetX = privacy ? 0 : petting ? p.x : following ? pointer.x*48 : reading ? ((cursor??.5)-.5)*23 : 0;
      const distance = targetX-p.x;
      const moving = !turning && !petting && !reduced && Math.abs(distance)>3;
      if (moving) phase+=dt/650*Math.PI*2;
      else phase=0;
      const hop = moving ? Math.max(0,Math.sin(phase))*10 : 0;
      const age=now-modeAt;
      const celebrate = !turning && mode==='success' && age<1400 ? Math.abs(Math.sin(age/1400*Math.PI*2))*12 : 0;
      const surprise = !turning && now-clickAt<650 ? Math.sin((now-clickAt)/650*Math.PI)*10 : 0;
      turnTarget = privacy ? turnDirection*Math.PI : petting ? 0 : following ? pointer.x*.53 : 0;
      const k=(a,b,ms)=>reduced ? b : ease(a,b,dt,ms);
      p.yaw=k(p.yaw,turnTarget,privacy||turning?240:170);
      if(Math.abs(p.yaw-turnTarget)<.006) p.yaw=turnTarget;
      p.x=k(p.x,targetX,turning?190:250);
      p.lift=k(p.lift,reduced?0:-hop-celebrate-surprise,75);
      p.pet=k(p.pet,petting?1:0,270);
      p.lean=k(p.lean,reduced||turning?0:moving?clamp(distance*.11,-6,6):petting?pointer.x*3:following?pointer.x*2.5:0,160);
      p.squash=k(p.squash,p.pet*.06+(reduced?0:moving?Math.cos(phase)*.022:Math.sin(now/850)*.007),100);
      p.ear=k(p.ear,reduced||turning?0:moving?Math.sin(phase)*1.2:Math.sin(now/1100)*.12,100);
      if(now>=blinkAt){blinkStart=now;blinkAt=now+3500+Math.random()*3200;}
      const blinkAge=(now-blinkStart)/240;
      const blink= !reduced&&blinkAge>=0&&blinkAge<=1 ? 1-.95*Math.sin(blinkAge*Math.PI):1;
      p.eye=k(p.eye,petting?.04:blink,55);
      p.gx=k(p.gx,turning?0:reading?((cursor??.5)-.5)*7:pointer.x*3.5,95);
      p.gy=k(p.gy,turning?0:reading?3:pointer.y*2.4,95);
      const nextActivity=privacy?(Math.abs(p.yaw)>=Math.PI-.025?'away':'turning'):turning?'returning':petting?'petting':moving?'running':mode;
      if(nextActivity!==lastActivity){lastActivity=nextActivity;setActivity(nextActivity);}
      setPose({...p});
    }

    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;}):null;
    observer?.observe(el);
    window.addEventListener('pointermove',move,{passive:true,capture:true});
    window.addEventListener('blur',reset);
    el.addEventListener('pointerleave',leave);
    el.addEventListener('pointerdown',click);
    raf=requestAnimationFrame(draw);
    return()=>{
      cancelAnimationFrame(raf);observer?.disconnect();
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('blur',reset);
      el.removeEventListener('pointerleave',leave);
      el.removeEventListener('pointerdown',click);
    };
  },[compact]);

  return <div ref={stage} className="chronos-mascot rabbit-stage" data-pose={activity} aria-hidden="true"
    style={{width:compact?112:'min(100%, 370px)',height:compact?95:'clamp(230px, 73vw, 310px)',aspectRatio:'auto',display:'grid',placeItems:'center',cursor:compact?'default':'pointer'}}>
    <RabbitArt pose={pose} compact={compact}/>
  </div>;
}
