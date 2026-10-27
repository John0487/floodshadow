import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { createLedger } from "./scripts/local-ledger.mjs";
import translationSafeJSX from "./scripts/translation-safe-jsx.mjs";
import { createLiveWeatherService } from "./scripts/live-weather-service.mjs";
import { createJourneySourceService } from "./scripts/journey-source-service.mjs";
export default defineConfig({
  plugins: [
    translationSafeJSX(),
    {
      name: "local-evidence-store",
      async configureServer(server) {
        const weatherService = createLiveWeatherService();
        const journeyService = createJourneySourceService();
        server.middlewares.use("/api/weather/context", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }
          try {
            res.end(JSON.stringify(await journeyService.get()));
          } catch (e) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        server.middlewares.use("/api/weather/live", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }
          try {
            res.end(
              JSON.stringify(
                await weatherService.get({
                  force: req.url?.includes("refresh=1"),
                }),
              ),
            );
          } catch (e) {
            res.statusCode = 503;
            res.end(
              JSON.stringify({
                error: "Weather update unavailable: " + e.message,
              }),
            );
          }
        });
        const read = async (n) =>
          JSON.parse(
            await readFile(
              new URL("./public/data/city/" + n, import.meta.url),
              "utf8",
            ),
          );
        const [sectors, events, snapshots, impacts, territories] =
          await Promise.all(
            [
              "sectors.json",
              "events.json",
              "assessments.json",
              "impacts.json",
              "areas.json",
            ].map(read),
          );
        const ledger = createLedger(
          new URL("./data-local/ledger.json", import.meta.url),
          { sectors, events, snapshots, impacts, territories },
        );
        if ((await ledger.read()).revision === 0)
          await ledger.save({ expectedRevision: 0, records: [] });
        server.middlewares.use("/api/ledger", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          try {
            if (
              req.headers.origin &&
              !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(
                req.headers.origin,
              )
            )
              throw Error("Only local sessions are allowed");
            if (req.method === "GET") {
              res.end(JSON.stringify(await ledger.read()));
              return;
            }
            if (req.method !== "PUT") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "Method not allowed" }));
              return;
            }
            let text = "";
            for await (const part of req) {
              text += part;
              if (text.length > 5000000) throw Error("Evidence file too large");
            }
            res.end(JSON.stringify(await ledger.save(JSON.parse(text))));
          } catch (e) {
            res.statusCode = e.status ?? 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      },
    },
  ],
});
