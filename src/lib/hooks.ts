"use client";
import { useState, useEffect, useCallback } from "react";

export function useAPI<T>(url: string, interval?: number) {
  const [data, setData] = useState<T|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const refresh = useCallback(async () => {
    try { const r = await fetch(url); if(!r.ok) throw new Error(`${r.status}`); setData(await r.json()); setError(null); }
    catch(e:any) { setError(e.message); } finally { setLoading(false); }
  }, [url]);
  useEffect(() => { refresh(); if(interval){const i=setInterval(refresh,interval);return()=>clearInterval(i);} }, [refresh,interval]);
  return { data, loading, error, refresh };
}

export async function apiPost(url: string, body: any) {
  return (await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) })).json();
}
