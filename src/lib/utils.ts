export const fmt = (v: number) => `$${Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtSigned = (v: number) => `${v>=0?"+":"-"}${fmt(v)}`;
export const shortAddr = (a: string) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "";
export const timeAgo = (ts: number) => { const d=Date.now()-ts; if(d<60000)return"just now"; if(d<3600000)return`${Math.floor(d/60000)}m ago`; if(d<86400000)return`${Math.floor(d/3600000)}h ago`; return`${Math.floor(d/86400000)}d ago`; };
export const uid = () => Math.random().toString(36).slice(2,10);
export const cn = (...c:(string|undefined|false)[]) => c.filter(Boolean).join(" ");
export const pct = (v: number) => `${(v*100).toFixed(1)}%`;
