#!/usr/bin/env node
import { existsSync } from "node:fs";
import { appendEvents, buildTrendSeries, compareSnapshots, readJson, writeJson } from "./lib/ranking-utils.mjs";

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback = null) => {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const incomingPath = getArg("--incoming", ".cache/latest.json");
const currentPath = getArg("--current", "data/current.json");
const historyDir = getArg("--history", "data/history");
const eventsPath = getArg("--events", "data/events.json");
const trendsPath = getArg("--trends", "data/trends.json");
const incoming = await readJson(incomingPath);
const current = existsSync(currentPath) ? await readJson(currentPath) : null;
const changes = compareSnapshots(current, incoming);
const existingEvents = existsSync(eventsPath) ? await readJson(eventsPath) : [];
const events = appendEvents(existingEvents, changes);
const trends = buildTrendSeries([], events, incoming);

const summary = {
  changed: changes.length > 0,
  generatedAt: new Date().toISOString(),
  changedSources: [...new Set(changes.map((change) => change.sourceId))],
  changes
};

if (args.has("--apply") && summary.changed) {
  await writeJson(currentPath, incoming);
  const date = new Date(incoming.generatedAt).toISOString().slice(0, 10);
  await writeJson(`${historyDir}/${date}.json`, { ...summary, snapshot: incoming });
  await writeJson(eventsPath, events);
  await writeJson(trendsPath, trends);
}

if (getArg("--summary")) {
  await writeJson(getArg("--summary"), summary);
}

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.changed ? 2 : 0;
