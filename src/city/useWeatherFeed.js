import { useEffect, useRef, useState } from "react";
export default function useWeatherFeed() {
  const [payload, setPayload] = useState(null),
    [context, setContext] = useState(null),
    [reports, setReports] = useState([]),
    [error, setError] = useState(""),
    [contextError, setContextError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now);
  const request = useRef(null);
  async function refresh() {
    request.current?.abort();
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const r = await fetch("/api/weather/live", {
        cache: "no-store",
        signal: c.signal,
      });
      if (!r.ok) throw Error("Weather update unavailable");
      const p = await r.json();
      setPayload(p);
      setError("");
      setNow(Date.now());
    } catch (e) {
      if (request.current === c)
        setError(c.signal.aborted ? "Weather update timed out" : e.message);
    } finally {
      clearTimeout(timeout);
      if (request.current === c) setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    const contextAbort = new AbortController();
    refresh();
    const update = setInterval(refresh, 300000),
      tick = setInterval(() => setNow(Date.now()), 30000);
    const sources = async () => {
      try {
        const r = await fetch("/api/weather/context", {
          signal: contextAbort.signal,
          cache: "no-store",
        });
        if (!r.ok) throw Error("Some additional sources could not update");
        const d = await r.json();
        if (alive) {
          setContext(d);
          setContextError("");
        }
      } catch (e) {
        if (alive) setContextError(e.message);
      }
    };
    sources();
    const more = setInterval(sources, 900000);
    fetch("/data/flow/recent-reports.json", { signal: contextAbort.signal })
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d) => {
        if (alive) setReports(d.records ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
      request.current?.abort();
      contextAbort.abort();
      clearInterval(update);
      clearInterval(tick);
      clearInterval(more);
    };
  }, []);
  return { payload, context, reports, error, contextError, busy, now, refresh };
}
