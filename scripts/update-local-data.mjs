import { cp, mkdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const live = fileURLToPath(new URL("../public/data/city/", import.meta.url));
const base = fileURLToPath(
  new URL("../data-cache/update-staging/", import.meta.url),
);
await mkdir(base, { recursive: true });
const id = new Date().toISOString().replace(/[:.]/g, "-"),
  stage = base + id,
  backup = base + id + "-previous";
await cp(live, stage, { recursive: true });
function run(script, args = [], env = process.env) {
  const r = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
    env,
  });
  if (r.status !== 0)
    throw Error(
      `${script} failed; the previous prepared data remain in place.`,
    );
}
if (process.argv.includes("--simulate-failure"))
  throw Error("Simulated source failure. Live data were not changed.");
if (!process.argv.includes("--check-only")) run("scripts/capture-forecast.mjs");
const env = { ...process.env, FLOODSHADOW_OUTPUT_DIR: stage };
run("scripts/build-city.mjs", [], env);
run("scripts/validate-demo.mjs", ["--seal"], env);
run("scripts/validate-demo.mjs", [], env);
if (process.argv.includes("--check-only")) {
  console.log("Staged update validated; live data unchanged.");
  process.exit(0);
}
await rename(live, backup);
try {
  await rename(stage, live);
} catch (e) {
  await rename(backup, live);
  throw e;
}
console.log(
  "Prepared data updated. Previous version retained at " +
    backup +
    ". Restart the local demo and reload.",
);
