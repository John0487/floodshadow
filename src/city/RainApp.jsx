import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Waves } from "lucide-react";
import {
  loadCity,
  loadLocalLedger,
  loadRealRecords,
  saveRealRecords,
  persistLocalRecords,
} from "./data.js";
import "./city.css";
const UnifiedWeather = lazy(() => import("./LiveRainView.jsx"));
class ViewBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null, generation: 0 };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="rain-failure" role="alert">
        <h2>This view could not be opened.</h2>
        <p>{this.state.error.message}</p>
        <p>Your saved evidence is preserved.</p>
        <button
          onClick={() =>
            this.setState((s) => ({
              error: null,
              generation: s.generation + 1,
            }))
          }
        >
          Reopen this view
        </button>
      </main>
    ) : (
      <React.Fragment key={this.state.generation}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
export default function RainApp() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [records, setRecords] = useState(loadRealRecords),
    [storageError, setStorageError] = useState(""),
    [alertHistory, setAlertHistory] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    const timeout = setTimeout(() => controller.abort(), 30000);
    loadCity(controller.signal)
      .then((d) => {
        if (alive) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (alive)
          setError(
            e.name === "AbortError"
              ? "Loading took too long. Try again."
              : e.message,
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      alive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  useEffect(() => {
    let alive = true;
    loadLocalLedger()
      .then(async (d) => {
        const cache = loadRealRecords();
        if (!d.records.length && cache.length)
          d = await persistLocalRecords(cache);
        if (alive) {
          setRecords(d.records);
          setAlertHistory(d.alertHistory);
        }
      })
      .catch((e) => {
        if (alive) setStorageError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const changeRecords = useCallback((next) => {
    setRecords(next);
    try {
      saveRealRecords(next);
      setStorageError("Saving evidence…");
      persistLocalRecords(next)
        .then((d) => {
          setAlertHistory(d.alertHistory);
          setStorageError("");
        })
        .catch((e) =>
          setStorageError(
            e.message + " Your browser copy can still be exported.",
          ),
        );
    } catch {
      setStorageError(
        "This browser could not save changes. Export your evidence.",
      );
    }
  }, []);
  if (error)
    return (
      <main className="rain-failure">
        <h1>The evidence could not be loaded.</h1>
        <p>{error}</p>
        <button
          onClick={() => {
            setError("");
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="rain-loading">
        <Waves size={32} />
        <h1>FLOODSHADOW</h1>
        <p>Loading Guayaquil evidence…</p>
      </main>
    );
  return (
    <ViewBoundary>
      <Suspense
        fallback={<main className="rain-loading">Preparing the map…</main>}
      >
        <UnifiedWeather
          data={data}
          records={records}
          onRecords={changeRecords}
          alertHistory={alertHistory}
          storageError={storageError}
        />
      </Suspense>
    </ViewBoundary>
  );
}
