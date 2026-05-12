import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTrendSeries, compareSnapshots, inferRankChangeReason, isBraunProduct, normalizePrice, parseRankingSource } from "../scripts/lib/ranking-utils.mjs";

const sources = {
  kakaku: { id: "kakaku", name: "Kakaku", url: "https://kakaku.com/kaden/shaver/", rankingType: "Popular", locale: "ja-JP", maxItems: 5 },
  mybest: { id: "mybest", name: "MyBest", url: "https://my-best.com/213", rankingType: "Editorial", locale: "ja-JP", maxItems: 5 },
  lohaco: { id: "lohaco", name: "LOHACO", url: "https://lohaco.yahoo.co.jp/ranking/58435/52620/52647/53316/", rankingType: "Category", locale: "ja-JP", maxItems: 5 }
};

test("parses JSON-LD rankings from Kakaku-style fixture", async () => {
  const html = await readFile("tests/fixtures/kakaku.html", "utf8");
  const parsed = parseRankingSource(html, sources.kakaku);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].rank, 1);
  assert.equal(parsed.items[0].brand, "パナソニック");
  assert.equal(parsed.items[0].price, "¥7,373");
});

test("parses MyBest nested JSON-LD and ranked card fixtures", async () => {
  const mybest = parseRankingSource(await readFile("tests/fixtures/mybest.html", "utf8"), sources.mybest);
  const lohaco = parseRankingSource(await readFile("tests/fixtures/lohaco.html", "utf8"), sources.lohaco);
  assert.equal(mybest.items[0].rank, 1);
  assert.match(mybest.items[0].titleDisplay, /シリーズ9 Pro/);
  assert.equal(mybest.items[0].price, "¥44,619");
  assert.equal(mybest.items[1].productUrl, "https://my-best.com/products/4116100");
  assert.equal(lohaco.items[0].brand, "ブラウン");
  assert.equal(lohaco.items[0].reviewCount, "190");
});

test("detects product, rank, price, and source status changes", () => {
  const previous = {
    sources: [{
      id: "mybest",
      status: "ok",
      items: [
        { rank: 1, signature: "alpha", titleDisplay: "Alpha", price: "100円" },
        { rank: 2, signature: "beta", titleDisplay: "Beta", price: "200円" }
      ]
    }]
  };
  const next = {
    sources: [{
      id: "mybest",
      name: "MyBest",
      status: "unavailable",
      items: [
        { rank: 1, signature: "beta", titleDisplay: "Beta", price: "250円" },
        { rank: 2, signature: "gamma", titleDisplay: "Gamma", price: "300円" }
      ]
    }]
  };
  const changes = compareSnapshots(previous, next);
  assert.ok(changes.some((change) => change.eventType === "product_changed"));
  assert.ok(changes.some((change) => change.eventType === "rank_moved"));
  assert.ok(changes.some((change) => change.eventType === "price_changed"));
  assert.ok(changes.some((change) => change.type === "product_removed"));
  assert.ok(changes.some((change) => change.type === "status_changed"));
  assert.ok(changes.every((change) => change.reason));
  assert.ok(changes.every((change) => change.id));
});

test("detects Braun products across English and Japanese naming variants", () => {
  assert.equal(isBraunProduct({ titleOriginal: "P&Gジャパン BRAUN ｜ シリーズ9 Pro+" }), true);
  assert.equal(isBraunProduct({ titleOriginal: "ブラウン メンズシェーバー シリーズ3" }), true);
  assert.equal(isBraunProduct({ brand: "パナソニック", titleOriginal: "ラムダッシュPRO" }), false);
});

test("normalizes prices and infers visible rank-change reasons", () => {
  assert.equal(normalizePrice("¥39,800"), 39800);
  assert.equal(normalizePrice("5,140 円"), 5140);
  assert.equal(inferRankChangeReason({ rank: 3, price: "¥39,800" }, { rank: 2, price: "¥36,780" }), "price_drop");
  assert.equal(inferRankChangeReason({ rank: 2, price: "¥36,780" }, { rank: 3, price: "¥39,800" }), "price_increase");
  assert.equal(inferRankChangeReason({ rank: 2, rating: "4.2" }, { rank: 1, rating: "4.5" }), "rating_change");
  assert.equal(inferRankChangeReason({ rank: 2 }, { rank: 1 }), "competitor_moved_above");
});

test("builds trend series with Braun summaries", () => {
  const snapshotA = {
    generatedAt: "2026-05-10T00:00:00.000Z",
    sources: [{
      id: "mybest",
      name: "MyBest",
      items: [
        { rank: 3, signature: "braun-9", titleOriginal: "BRAUN Series 9", titleDisplay: "BRAUN Series 9", brand: "P&Gジャパン", price: "¥40,000", rating: "4.5", reviewCount: "2", productUrl: "https://example.com/a" }
      ]
    }]
  };
  const snapshotB = {
    generatedAt: "2026-05-11T00:00:00.000Z",
    sources: [{
      id: "mybest",
      name: "MyBest",
      items: [
        { rank: 1, signature: "braun-9", titleOriginal: "BRAUN Series 9", titleDisplay: "BRAUN Series 9", brand: "P&Gジャパン", price: "¥38,000", rating: "4.6", reviewCount: "3", productUrl: "https://example.com/a" }
      ]
    }]
  };
  const trends = buildTrendSeries([snapshotA], [], snapshotB);
  assert.equal(trends.braunProducts, 1);
  assert.equal(trends.products[0].bestRank, 1);
  assert.equal(trends.products[0].rankDelta, 2);
  assert.equal(trends.products[0].priceDelta, -2000);
});
