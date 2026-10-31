import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSettings } from "../server/settings";

const directory = await mkdtemp(join(tmpdir(), "ccstatusline-settings-check-"));
const previous = process.env.CCSTATUSLINE_SETTINGS_PATH;
try {
  const path = join(directory, "settings.json");
  await copyFile(new URL("../test/fixtures/settings.json", import.meta.url), path);
  process.env.CCSTATUSLINE_SETTINGS_PATH = path;
  const first = await readSettings();
  assert(first.ok);
  const raw = JSON.parse(await readFile(path, "utf8"));
  raw.globalBold = !first.settings.globalBold;
  await writeFile(path, `${JSON.stringify(raw, null, 2)}\n\n`);
  const second = await readSettings();
  assert(second.ok);
  assert.equal(second.settings.globalBold, !first.settings.globalBold);
  assert.notEqual(first, second);
  console.log("PASS: temporary fixture change detected by the server settings reader; real settings and daemon environment unchanged.");
} finally {
  if (previous === undefined) delete process.env.CCSTATUSLINE_SETTINGS_PATH;
  else process.env.CCSTATUSLINE_SETTINGS_PATH = previous;
  await rm(directory, { recursive: true, force: true });
}
