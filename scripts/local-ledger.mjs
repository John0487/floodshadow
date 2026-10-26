import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateVerification } from "../src/city/analysis.js";
import { buildAlerts, appendAlertHistory } from "../src/city/findings.js";
export function createLedger(file, data) {
  if (file instanceof URL) file = fileURLToPath(file);
  let queue = Promise.resolve();
  async function read() {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT")
        return { revision: 0, records: [], alertHistory: [] };
      throw Error(
        "The local ledger cannot be read. The file has been preserved.",
      );
    }
  }
  async function update(body) {
    const old = await read();
    if (body.expectedRevision !== old.revision)
      throw Object.assign(
        Error(
          "Another session changed the saved evidence. Reload before saving.",
        ),
        { status: 409 },
      );
    if (!Array.isArray(body.records) || body.records.length > 10000)
      throw Error("Invalid evidence list");
    const ids = new Set();
    for (const r of body.records) {
      if (typeof r.id !== "string" || ids.has(r.id))
        throw Error("Duplicate or missing verification ID");
      ids.add(r.id);
      validateVerification(r, data.sectors, data.events);
      if (!["pending", "accepted"].includes(r.validation))
        throw Error("Invalid review status");
      if (r.validation === "accepted" && (!r.reviewer || !r.reviewedAt))
        throw Error("Accepted evidence needs a reviewer and time");
      const previous = old.records.find((v) => v.id === r.id);
      if (
        previous &&
        JSON.stringify({
          ...previous,
          validation: undefined,
          reviewer: undefined,
          reviewedAt: undefined,
        }) !==
          JSON.stringify({
            ...r,
            validation: undefined,
            reviewer: undefined,
            reviewedAt: undefined,
          })
      )
        throw Error("Existing evidence is immutable; append a correction");
    }
    if (old.records.some((v) => !ids.has(v.id)))
      throw Error("Evidence history cannot be deleted");
    let history = old.alertHistory;
    for (const event of data.events) {
      const snap = data.snapshots.find((s) => s.eventId === event.id);
      for (const phase of ["before", "after"])
        history = appendAlertHistory(
          history,
          buildAlerts({
            sectors: data.sectors,
            assessments: snap.assessments,
            impacts: data.impacts.filter((i) => i.eventId === event.id),
            records: body.records,
            event,
            areas: data.territories.areas,
            phase,
          }),
        );
    }
    const next = {
      revision: old.revision + 1,
      updatedAt: new Date().toISOString(),
      records: body.records,
      alertHistory: history,
    };
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file + ".tmp", JSON.stringify(next, null, 2));
    try {
      await copyFile(file, file + ".previous");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await rename(file + ".tmp", file);
    return next;
  }
  return {
    read,
    save(body) {
      const task = queue.then(() => update(body));
      queue = task.catch(() => {});
      return task;
    },
  };
}
