import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import useWeatherFeed from "./useWeatherFeed.js";

test("live monitoring refreshes every minute and focus does not abort an in-flight update", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  const timers = new Map(),
    calls = [];
  let view, root;
  try {
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.setInterval = (fn, ms) => {
      const id = timers.size + 1;
      timers.set(id, { fn, ms });
      return id;
    };
    globalThis.clearInterval = (id) => timers.delete(id);
    globalThis.fetch = (url, options) =>
      url.startsWith("/api/weather/live")
        ? new Promise((resolve, reject) => {
            calls.push({ url, options, resolve });
            options.signal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
          })
        : Promise.resolve({ ok: true, json: async () => ({ records: [] }) });
    function Probe() {
      view = useWeatherFeed();
      return React.createElement("div", null, view.busy ? "updating" : "ready");
    }
    root = createRoot(document.getElementById("root"));
    await act(async () => root.render(React.createElement(Probe)));
    assert.equal(calls.length, 1);
    assert.equal(view.busy, true);
    await act(async () => {
      window.dispatchEvent(new window.Event("focus"));
      document.dispatchEvent(new window.Event("visibilitychange"));
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.signal.aborted, false);
    const first = { checkedAt: "2026-10-26T23:00:00Z", weather: { cells: [] } };
    await act(async () =>
      calls[0].resolve({ ok: true, json: async () => first }),
    );
    assert.equal(view.payload.checkedAt, first.checkedAt);
    assert.equal(view.busy, false);
    const minute = [...timers.values()].find((t) => t.ms === 60000);
    assert.ok(minute);
    await act(async () => {
      void minute.fn();
    });
    assert.equal(calls.length, 2);
    const second = { ...first, checkedAt: "2026-10-26T23:01:00Z" };
    await act(async () =>
      calls[1].resolve({ ok: true, json: async () => second }),
    );
    assert.equal(view.payload.checkedAt, second.checkedAt);
    await act(async () => {
      void view.refresh(true);
    });
    assert.equal(calls[2].url, "/api/weather/live?refresh=1");
    await act(async () => root.unmount());
    root = null;
    assert.equal(calls[2].options.signal.aborted, true);
    assert.equal(timers.size, 0);
  } finally {
    if (root) await act(async () => root.unmount());
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
    globalThis.setInterval = saved.setInterval;
    globalThis.clearInterval = saved.clearInterval;
    globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
    dom.window.close();
  }
});
