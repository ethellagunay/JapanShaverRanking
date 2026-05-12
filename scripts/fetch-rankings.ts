#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRankingSource, readJson, writeJson } from "./lib/ranking-utils.mjs";

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback = null) => {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const sourcesPath = getArg("--sources", "sources.json");
const outputPath = getArg("--output", "data/current.json");
const fixtureDir = getArg("--fixture-dir");
const sources = await readJson(sourcesPath);

const results = [];
for (const source of sources) {
  try {
    const html = fixtureDir
      ? await readFile(join(fixtureDir, `${source.id}.html`), "utf8")
      : await fetchHtml(source.url);
    results.push(parseRankingSource(html, source));
  } catch (error) {
    results.push({
      id: source.id,
      name: source.name,
      url: source.url,
      rankingType: source.rankingType,
      locale: source.locale,
      status: "error",
      checkedAt: new Date().toISOString(),
      sourceUpdatedAt: null,
      error: error instanceof Error ? error.message : String(error),
      items: []
    });
  }
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  productScope: "Men's electric shavers in Japan",
  language: "en",
  sources: results
};

if (args.has("--stdout")) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  await writeJson(outputPath, snapshot);
  console.log(`Wrote ${outputPath}`);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "ja,en;q=0.8",
      "user-agent": "Mozilla/5.0 (compatible; ShaverRankingSummary/1.0; +https://example.com)"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = await response.arrayBuffer();
  const headerCharset = response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1];
  if (headerCharset) {
    return new TextDecoder(headerCharset).decode(bytes);
  }
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const metaCharset = utf8.match(/<meta[^>]+charset=["']?([^"'\s/>]+)/i)?.[1];
  if (metaCharset && !/^utf-?8$/i.test(metaCharset)) {
    return new TextDecoder(metaCharset).decode(bytes);
  }
  return utf8;
}
