import { useLocale } from '../../i18n/LocaleProvider';

export function ClockField({ value, onChange, label, timeFormat = '24h', disabled }) {
  const {locale}=useLocale(),uk=locale==='uk';
  const hour=Number(value?.slice(0,2))||0;
  const minute=value?.slice(3,5)||'00';
  const twelve=timeFormat==='12h';
  const pad=n=>String(n).padStart(2,'0');
  return <span className="event-clock12">
    <select disabled={disabled} aria-label={label+' '+(uk?'година':'hour')} value={twelve?String(hour%12||12):pad(hour)} onChange={e=>onChange(pad(twelve?Number(e.target.value)%12+(hour>=12?12:0):Number(e.target.value))+':'+minute)}>
      {Array.from({length:twelve?12:24},(_,i)=>twelve?String(i+1):pad(i)).map(h=><option key={h} value={h}>{h}</option>)}
    </select><span aria-hidden="true">:</span>
    <select disabled={disabled} aria-label={label+' '+(uk?'хвилини':'minutes')} value={minute} onChange={e=>onChange(pad(hour)+':'+e.target.value)}>{Array.from({length:60},(_,i)=><option key={i} value={pad(i)}>{pad(i)}</option>)}</select>
    {twelve&&<select disabled={disabled} aria-label={label+' AM/PM'} value={hour>=12?'PM':'AM'} onChange={e=>onChange(pad(hour%12+(e.target.value==='PM'?12:0))+':'+minute)}><option>AM</option><option>PM</option></select>}
  </span>;
}
