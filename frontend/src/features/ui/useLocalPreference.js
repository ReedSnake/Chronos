import { useState, useEffect } from 'react';

// Only device-local preferences. Account-specific keys avoid sharing across users.
export function useLocalPreference(key, fallback) {
  const read=()=>{if(!key)return fallback;try{const value=localStorage.getItem('chronos:'+key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}};
  const [entry,setEntry]=useState(()=>({key,value:read()}));
  const value=entry.key===key?entry.value:read();
  function set(next){setEntry(old=>({key,value:typeof next==='function'?next(old.key===key?old.value:read()):next}));}
  useEffect(()=>{if(key&&entry.key===key){try{localStorage.setItem('chronos:'+key,JSON.stringify(entry.value));}catch{}}},[key,entry]);
  return [value,set];
}
