#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await mkdir(".cache", { recursive: true });

run("node", ["scripts/fetch-rankings.ts", "--output=.cache/latest.json"]);
const detect = spawnSync("node", [
  "scripts/detect-changes.ts",
  "--incoming=.cache/latest.json",
  "--current=data/current.json",
  "--history=data/history",
  "--events=data/events.json",
  "--trends=data/trends.json",
  "--summary=.cache/change-summary.json",
  "--apply"
], { stdio: "inherit" });

if (![0, 2].includes(detect.status ?? 1)) {
  process.exit(detect.status ?? 1);
}

if (detect.status === 2) {
  run("node", ["scripts/build-site.ts"]);
  console.log("Rankings changed; site rebuilt.");
} else {
  console.log("No ranking changes detected; build skipped.");
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
