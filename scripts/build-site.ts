#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { buildTrendSeries, escapeHtml, formatDate, isBraunProduct, pickBrand, readJson, reasonTextForEvent, translateBrand, translateProductTitle } from "./lib/ranking-utils.mjs";

const current = await readJson("data/current.json");
const events = existsSync("data/events.json") ? await readJson("data/events.json") : [];
const trends = existsSync("data/trends.json") ? await readJson("data/trends.json") : buildTrendSeries([], events, current);
const historyFiles = existsSync("data/history")
  ? (await readdir("data/history")).filter((file) => file.endsWith(".json")).sort().reverse()
  : [];
const histories = [];
for (const file of historyFiles) {
  histories.push({ file, data: JSON.parse(await readFile(`data/history/${file}`, "utf8")) });
}

await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", page("Japan Men’s Electric Shaver Rankings", renderHome(current, events, trends)), "utf8");
await writeFile("dist/history.html", page("Ranking Change History", renderHistory(histories)), "utf8");
await writeFile("dist/trends.html", page("Ranking Trends", renderTrends(trends)), "utf8");
await writeFile("dist/styles.css", styles(), "utf8");
await writeFile("dist/current.json", `${JSON.stringify(current, null, 2)}\n`, "utf8");
await writeFile("dist/events.json", `${JSON.stringify(events, null, 2)}\n`, "utf8");
await writeFile("dist/trends.json", `${JSON.stringify(trends, null, 2)}\n`, "utf8");
console.log("Built dist/index.html, dist/history.html, and dist/trends.html");

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="./index.html">Shaver Rank JP</a>
    <nav>
      <a href="./index.html">Rankings</a>
      <a href="./trends.html">Trends</a>
      <a href="./history.html">History</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>
    Source pages own their ranking data and product descriptions. This site stores compact summaries for monitoring.
  </footer>
</body>
</html>
`;
}

function renderHome(snapshot, allEvents, trendData) {
  const displayOrder = ["mybest", "lohaco", "kakaku"];
  const orderedSources = [...snapshot.sources].sort((a, b) => {
    const aIndex = displayOrder.indexOf(a.id);
    const bIndex = displayOrder.indexOf(b.id);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
  const latestEvents = latestEventsByProduct(allEvents);
  const sources = orderedSources.map((source) => renderSource(source, latestEvents)).join("");
  return `
    <section class="hero">
      <p class="eyebrow">Japan market monitor</p>
      <h1>Men’s electric shaver rankings, summarized from Japanese source sites.</h1>
      <p class="intro">A lightweight English summary of configurable ranking sources. Original Japanese product names are preserved for traceability.</p>
      <dl class="meta">
        <div><dt>Product scope</dt><dd>${escapeHtml(snapshot.productScope)}</dd></div>
        <div><dt>Last updated</dt><dd>${escapeHtml(formatDate(snapshot.generatedAt))}</dd></div>
        <div><dt>Sources</dt><dd>${snapshot.sources.length}</dd></div>
      </dl>
    </section>
    <section class="source-grid">${sources}</section>
    ${renderBraunWatch(snapshot, allEvents, trendData)}
  `;
}

function renderBraunWatch(snapshot, allEvents, trendData) {
  const sourceNames = new Map((snapshot.sources ?? []).map((source) => [source.id, source.name]));
  const currentBraun = [];
  for (const source of snapshot.sources ?? []) {
    for (const item of (source.items ?? []).filter(isBraunProduct).slice(0, 10)) {
      currentBraun.push({ source, item });
    }
  }
  const braunEvents = [...allEvents].filter((event) => event.isBraun).slice(-8).reverse();
  const rows = currentBraun.length ? currentBraun.map(({ source, item }) => {
    const event = latestEventFor(allEvents, source.id, item.signature);
    const title = translateProductTitle(item.titleDisplay);
    return `
      <tr>
        <td>${escapeHtml(source.id.toUpperCase())}</td>
        <td><a href="${escapeHtml(item.productUrl)}">${escapeHtml(title)}</a></td>
        <td>#${item.rank}</td>
        <td>${escapeHtml(item.price ?? "n/a")}</td>
        <td>${event ? escapeHtml(shortReason(event)) : "Current top 10"}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="5">No Braun products currently detected in the tracked top 10.</td></tr>`;
  const eventList = braunEvents.length ? braunEvents.map((event) => `
    <li><strong>${escapeHtml(sourceNames.get(event.sourceId) ?? event.sourceId)}</strong>: ${escapeHtml(shortReason(event))}</li>
  `).join("") : `<li>No Braun movement events recorded yet.</li>`;
  return `
    <section class="watch-panel">
      <div class="watch-copy">
        <p class="eyebrow">Braun Watch</p>
        <h2>Current Braun movement across sources</h2>
        <p>Detected ${currentBraun.length} Braun result${currentBraun.length === 1 ? "" : "s"} in the visible top 10. Trend data currently tracks ${trendData.braunProducts ?? 0} Braun product/source series.</p>
      </div>
      <div class="watch-grid">
        <table class="data-table">
          <thead><tr><th>Source</th><th>Product</th><th>Rank</th><th>Price</th><th>Latest signal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="event-card">
          <h3>Recent Braun Signals</h3>
          <ul>${eventList}</ul>
        </div>
      </div>
    </section>
  `;
}

function renderSource(source, latestEvents) {
  const items = source.items.length
    ? source.items.slice(0, 10).map((item) => renderItem(item, latestEvents.get(`${source.id}:${item.signature}`))).join("")
    : `<li class="empty">No items extracted. ${escapeHtml(source.error ?? "")}</li>`;
  const visibleItems = source.items.slice(0, 10);
  const braunCount = visibleItems.filter(isBraunProduct).length;
  const denominator = Math.min(10, visibleItems.length || 10);
  return `
    <article class="source source-${escapeHtml(source.id)}">
      <div class="source-head">
        <div>
          <p class="eyebrow">${escapeHtml(source.rankingType)}</p>
          <h2>${escapeHtml(source.name)}</h2>
        </div>
        <div class="source-badges">
          <span class="braun-ratio">Braun ${braunCount}/${denominator}</span>
          <span class="status ${escapeHtml(source.status)}">${escapeHtml(source.status)}</span>
        </div>
      </div>
      <p class="source-meta">Checked ${escapeHtml(formatDate(source.checkedAt))}${source.sourceUpdatedAt ? ` · Source update: ${escapeHtml(source.sourceUpdatedAt)}` : ""}</p>
      <ol class="ranking">${items}</ol>
      <a class="source-link" href="${escapeHtml(source.url)}">Open source ranking</a>
    </article>
  `;
}

function renderItem(item, event = null) {
  const englishTitle = item.titleEnglish ?? translateProductTitle(item.titleDisplay);
  const originalTitle = item.titleOriginal === englishTitle ? "" : item.titleOriginal;
  const brand = pickBrand(item.titleOriginal) ?? item.brand;
  const details = [
    brand ? `Brand: ${escapeHtml(translateBrand(brand))}` : null,
    item.price ? `Price: ${escapeHtml(item.price)}` : null,
    item.rating ? `Rating: ${escapeHtml(item.rating)}` : null,
    item.reviewCount ? `Reviews: ${escapeHtml(item.reviewCount)}` : null
  ].filter(Boolean).join(" · ");
  return `
    <li>
      <span class="rank">${item.rank}</span>
      <div>
        <a class="title" href="${escapeHtml(item.productUrl)}">${escapeHtml(englishTitle)}</a>
        ${event ? `<p class="movement ${escapeHtml(event.reason)}">${escapeHtml(shortReason(event))}</p>` : ""}
        ${originalTitle ? `<p class="original">Original: ${escapeHtml(originalTitle)}</p>` : ""}
        <p class="details">${details || "Details unavailable"}</p>
      </div>
    </li>
  `;
}

function renderTrends(trendData) {
  const braunProducts = (trendData.products ?? []).filter((product) => product.isBraun);
  const allProducts = trendData.products ?? [];
  const braunRows = renderTrendRows(braunProducts);
  const allRows = renderTrendRows(allProducts.slice(0, 60));
  return `
    <section class="hero compact">
      <p class="eyebrow">Trend monitor</p>
      <h1>Product movements over time</h1>
      <p class="intro">Trends are built from captured daily snapshots and structured change events. Reason labels use only visible rank, price, rating, review, and source status changes.</p>
      <dl class="meta">
        <div><dt>Total tracked series</dt><dd>${trendData.totalProducts ?? 0}</dd></div>
        <div><dt>Braun series</dt><dd>${trendData.braunProducts ?? 0}</dd></div>
        <div><dt>Last generated</dt><dd>${escapeHtml(formatDate(trendData.generatedAt))}</dd></div>
      </dl>
    </section>
    <section class="trend-section">
      <h2>Braun Trends</h2>
      <table class="data-table trend-table">
        <thead><tr><th>Source</th><th>Product</th><th>Current</th><th>Best</th><th>Delta</th><th>Seen</th><th>Price</th><th>Spark</th></tr></thead>
        <tbody>${braunRows || `<tr><td colspan="8">No Braun trends recorded yet.</td></tr>`}</tbody>
      </table>
    </section>
    <section class="trend-section">
      <h2>All Tracked Products</h2>
      <table class="data-table trend-table">
        <thead><tr><th>Source</th><th>Product</th><th>Current</th><th>Best</th><th>Delta</th><th>Seen</th><th>Price</th><th>Spark</th></tr></thead>
        <tbody>${allRows || `<tr><td colspan="8">No trends recorded yet.</td></tr>`}</tbody>
      </table>
    </section>
  `;
}

function renderTrendRows(products) {
  return products.map((product) => {
    const delta = product.rankDelta > 0 ? `+${product.rankDelta}` : String(product.rankDelta ?? 0);
    const priceDelta = product.priceDelta == null ? "" : ` (${product.priceDelta > 0 ? "+" : ""}${product.priceDelta.toLocaleString("ja-JP")})`;
    return `
      <tr>
        <td>${escapeHtml(product.sourceId.toUpperCase())}</td>
        <td>${escapeHtml(translateProductTitle(product.titleDisplay))}</td>
        <td>#${product.currentRank}</td>
        <td>#${product.bestRank}</td>
        <td>${escapeHtml(delta)}</td>
        <td>${product.daysSeen} day${product.daysSeen === 1 ? "" : "s"}</td>
        <td>${escapeHtml(product.currentPrice ?? "n/a")}${escapeHtml(priceDelta)}</td>
        <td>${sparkline(product.series ?? [])}</td>
      </tr>
    `;
  }).join("");
}

function renderHistory(histories) {
  const rows = histories.length ? histories.map(({ file, data }) => `
    <article class="history-entry">
      <h2>${escapeHtml(file.replace(".json", ""))}</h2>
      <p>${escapeHtml((data.changedSources ?? []).join(", ") || data.reason || "Snapshot recorded")}</p>
      <ul>${(data.changes ?? []).slice(0, 12).map((change) => `<li>${escapeHtml(describeChange(change))}</li>`).join("")}</ul>
    </article>
  `).join("") : `<p>No history snapshots yet.</p>`;
  return `
    <section class="hero compact">
      <p class="eyebrow">Change log</p>
      <h1>Ranking change history</h1>
      <p class="intro">Snapshots are written only when products, ranks, prices, or source availability change.</p>
    </section>
    <section class="history-list">${rows}</section>
  `;
}

function describeChange(change) {
  if (change.reasonText) return `${change.sourceId}: ${change.reasonText}`;
  switch (change.type) {
    case "product_changed":
      return `${change.sourceId}: rank ${change.rank} changed from ${change.before} to ${change.after}`;
    case "rank_moved":
      return `${change.sourceId}: ${change.title} moved from #${change.beforeRank} to #${change.afterRank}`;
    case "price_changed":
      return `${change.sourceId}: ${change.title} price changed from ${change.before ?? "none"} to ${change.after ?? "none"}`;
    case "product_removed":
      return `${change.sourceId}: ${change.title} was removed`;
    case "status_changed":
      return `${change.sourceId}: status changed from ${change.before} to ${change.after}`;
    default:
      return `${change.sourceId}: ${change.message ?? change.type}`;
  }
}

function latestEventsByProduct(allEvents) {
  const map = new Map();
  for (const event of allEvents) {
    if (!event.productSignature) continue;
    map.set(`${event.sourceId}:${event.productSignature}`, event);
  }
  return map;
}

function latestEventFor(allEvents, sourceId, signature) {
  for (let index = allEvents.length - 1; index >= 0; index -= 1) {
    const event = allEvents[index];
    if (event.sourceId === sourceId && event.productSignature === signature) return event;
  }
  return null;
}

function shortReason(event) {
  return event.reasonText ?? reasonTextForEvent(event);
}

function sparkline(series) {
  if (!series.length) return "";
  const values = series.map((point) => Number(point.rank)).filter(Boolean);
  if (!values.length) return "";
  const width = 92;
  const height = 28;
  const max = Math.max(...values, 10);
  const min = Math.min(...values, 1);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = ((value - min) / range) * (height - 6) + 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="rank trend"><polyline points="${points}"></polyline></svg>`;
}

function styles() {
  return `:root {
  color-scheme: light;
  --ink: #17212b;
  --muted: #65727d;
  --line: #dce5e8;
  --paper: #f4f7f6;
  --panel: #ffffff;
  --accent: #0f766e;
  --accent-dark: #134e4a;
  --gold: #b88900;
  --silver: #6f7f8a;
  --bronze: #9b5f33;
  --warn: #b45309;
  --shadow: 0 16px 42px rgba(23, 33, 43, .08);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background:
    linear-gradient(180deg, #eef5f3 0, var(--paper) 320px),
    var(--paper);
}
a { color: var(--accent-dark); }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px clamp(18px, 4vw, 56px);
  border-bottom: 1px solid var(--line);
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(16px);
  position: sticky;
  top: 0;
  z-index: 5;
}
.brand {
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  text-decoration: none;
}
.brand::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0f766e;
  box-shadow: 0 0 0 5px #d8f3ee;
}
nav { display: flex; gap: 18px; }
nav a {
  border-radius: 999px;
  color: var(--muted);
  font-size: .94rem;
  font-weight: 800;
  padding: 8px 12px;
  text-decoration: none;
}
nav a:hover { background: #edf4f2; color: var(--ink); }
main { width: min(1480px, calc(100% - 28px)); margin: 0 auto; }
.hero { padding: 58px 0 30px; }
.compact { padding-bottom: 18px; }
.eyebrow {
  color: var(--accent);
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .08em;
  margin: 0 0 10px;
  text-transform: uppercase;
}
h1 {
  max-width: 960px;
  font-size: clamp(2.3rem, 5vw, 5.2rem);
  line-height: .98;
  margin: 0;
  letter-spacing: 0;
}
.intro {
  max-width: 760px;
  color: var(--muted);
  font-size: 1.08rem;
  line-height: 1.65;
  margin-bottom: 0;
}
.meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 30px; }
.meta div, .source, .history-entry {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}
.meta div {
  background: rgba(255,255,255,.72);
  box-shadow: 0 8px 24px rgba(23, 33, 43, .04);
}
dt { color: var(--muted); font-size: .82rem; font-weight: 700; }
dd { margin: 6px 0 0; font-weight: 800; }
.watch-panel, .trend-section {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  margin: 0 0 18px;
  padding: 22px;
}
.watch-copy {
  display: flex;
  gap: 18px;
  justify-content: space-between;
  margin-bottom: 18px;
}
.watch-copy h2 { font-size: 1.55rem; }
.watch-copy p:last-child { color: var(--muted); line-height: 1.55; max-width: 560px; margin: 0; }
.watch-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(260px, .8fr);
  gap: 16px;
}
.data-table {
  border-collapse: collapse;
  font-size: .9rem;
  width: 100%;
}
.data-table th {
  color: var(--muted);
  font-size: .74rem;
  letter-spacing: .06em;
  text-align: left;
  text-transform: uppercase;
}
.data-table th, .data-table td {
  border-bottom: 1px solid var(--line);
  padding: 10px 8px;
  vertical-align: top;
}
.data-table tr:last-child td { border-bottom: 0; }
.data-table a { color: var(--ink); font-weight: 800; text-decoration: none; }
.data-table a:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.event-card {
  background: #f7faf9;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
}
.event-card h3 { margin: 0 0 10px; }
.event-card ul { margin: 0; padding-left: 18px; color: var(--muted); line-height: 1.5; }
.source-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 18px;
  padding-bottom: 42px;
}
.source {
  --source-accent: var(--accent);
  box-shadow: var(--shadow);
  overflow: hidden;
  padding: 0;
}
.source-mybest { --source-accent: #0f766e; }
.source-lohaco { --source-accent: #b45309; }
.source-kakaku { --source-accent: #385c85; }
.source-head {
  align-items: start;
  border-top: 5px solid var(--source-accent);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 18px 18px 12px;
}
.source .eyebrow { color: var(--source-accent); }
.source-badges {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.braun-ratio {
  background: #17212b;
  border-radius: 999px;
  color: #fff;
  font-size: .78rem;
  font-weight: 900;
  padding: 6px 10px;
  white-space: nowrap;
}
h2 { margin: 0; font-size: 1.22rem; line-height: 1.18; }
.source-meta, .details, .original { color: var(--muted); }
.source-meta {
  border-bottom: 1px solid var(--line);
  font-size: .84rem;
  margin: 0;
  padding: 0 18px 16px;
}
.status {
  border: 1px solid color-mix(in srgb, var(--source-accent) 25%, white);
  border-radius: 999px;
  background: color-mix(in srgb, var(--source-accent) 10%, white);
  color: var(--source-accent);
  padding: 5px 10px;
  font-size: .75rem;
  font-weight: 800;
  text-transform: uppercase;
}
.status.ok { color: var(--source-accent); }
.status.error, .status.unavailable { color: var(--warn); border-color: #fed7aa; background: #fff7ed; }
.ranking { list-style: none; padding: 0 18px; margin: 0; display: grid; }
.ranking li {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.ranking li:last-child { border-bottom: 0; }
.rank {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #e9f0ef;
  color: white;
  font-weight: 900;
  color: var(--ink);
  margin-top: 2px;
}
.ranking li:nth-child(1) .rank { background: #fff4cc; color: var(--gold); }
.ranking li:nth-child(2) .rank { background: #edf1f4; color: var(--silver); }
.ranking li:nth-child(3) .rank { background: #fae8dc; color: var(--bronze); }
.ranking li:nth-child(n+4) .rank {
  background: color-mix(in srgb, var(--source-accent) 10%, white);
  color: var(--source-accent);
}
.title {
  color: var(--ink);
  font-weight: 850;
  line-height: 1.34;
  overflow-wrap: anywhere;
  text-decoration: none;
}
.title:hover { color: var(--source-accent); text-decoration: underline; text-underline-offset: 3px; }
.movement {
  background: color-mix(in srgb, var(--source-accent) 10%, white);
  border-left: 3px solid var(--source-accent);
  border-radius: 6px;
  color: #334149;
  font-size: .82rem;
  font-weight: 750;
  line-height: 1.42;
  margin: 8px 0 0;
  padding: 7px 9px;
}
.original {
  font-size: .82rem;
  line-height: 1.42;
  margin: 7px 0;
}
.details {
  color: #3f4c55;
  font-size: .88rem;
  font-weight: 700;
  line-height: 1.45;
  margin: 0;
}
.source-link {
  align-items: center;
  background: #f5f8f7;
  border-top: 1px solid var(--line);
  color: var(--source-accent);
  display: flex;
  font-weight: 900;
  justify-content: center;
  padding: 14px 18px;
  text-decoration: none;
}
.source-link:hover { background: color-mix(in srgb, var(--source-accent) 10%, white); }
.history-list { display: grid; gap: 14px; padding-bottom: 48px; }
.trend-section h2 { margin: 0 0 14px; }
.trend-table { min-width: 900px; }
.trend-section { overflow-x: auto; }
.spark {
  height: 28px;
  width: 92px;
}
.spark polyline {
  fill: none;
  stroke: var(--accent);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}
footer {
  background: #fff;
  border-top: 1px solid var(--line);
  color: var(--muted);
  padding: 24px clamp(18px, 4vw, 56px);
}
@media (max-width: 760px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .meta { grid-template-columns: 1fr; }
  h1 { font-size: 2.45rem; }
  .source-grid { grid-template-columns: 1fr; }
  .source-head { align-items: flex-start; flex-direction: column; }
  .source-badges { align-items: flex-start; flex-direction: row; }
  .watch-copy, .watch-grid { display: block; }
  .event-card { margin-top: 14px; }
}
`;
}
