import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

export function stripTags(value) {
  return decodeEntities(String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

export function normalizeWhitespace(value) {
  return decodeEntities(String(value ?? "")).replace(/\s+/g, " ").trim();
}

export function normalizeProductName(value) {
  return normalizeWhitespace(value)
    .replace(/[【】［］「」『』()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function signatureFor(value) {
  return normalizeProductName(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function pickBrand(title) {
  const normalized = normalizeProductName(title).toLowerCase();
  const brands = [
    ["panasonic", "パナソニック"],
    ["パナソニック", "パナソニック"],
    ["ラムダッシュ", "パナソニック"],
    ["braun", "ブラウン"],
    ["ブラウン", "ブラウン"],
    ["philips", "フィリップス"],
    ["フィリップス", "フィリップス"],
    ["kai", "貝印"],
    ["貝印", "貝印"],
    ["koizumi", "コイズミ"],
    ["コイズミ", "コイズミ"],
    ["小泉成器", "小泉成器"],
    ["p&gジャパン", "P&Gジャパン"],
    ["p&g", "P&Gジャパン"],
    ["maxell izumi", "マクセルイズミ"],
    ["マクセルイズミ", "マクセルイズミ"],
    ["izumi", "イズミ"],
    ["イズミ", "イズミ"]
  ];
  return brands.find(([needle]) => normalized.includes(needle))?.[1] ?? null;
}

export function translateBrand(brand) {
  const normalized = normalizeProductName(brand).toLowerCase();
  const brands = [
    ["パナソニック", "Panasonic"],
    ["ブラウン", "Braun"],
    ["フィリップス", "Philips"],
    ["マクセルイズミ", "Maxell Izumi"],
    ["イズミ", "Izumi"],
    ["コイズミ", "Koizumi"],
    ["貝印", "Kai"],
    ["P&Gジャパン", "P&G Japan"],
    ["小泉成器", "Koizumi Seiki"]
  ];
  return brands.find(([needle]) => normalized.includes(needle.toLowerCase()))?.[1] ?? normalizeProductName(brand);
}

export function translateProductTitle(title) {
  let output = normalizeProductName(title);
  const replacements = [
    ["パナソニック", "Panasonic"],
    ["P&Gジャパン", "P&G Japan"],
    ["小泉成器", "Koizumi Seiki"],
    ["ブラウン BRAUN", "Braun"],
    ["ブラウン", "Braun"],
    ["フィリップス", "Philips"],
    ["貝印", "Kai"],
    ["ラムダッシュPRO", "Lamdash PRO"],
    ["ラムダッシュ パームイン", "Lamdash Palm In"],
    ["ラムダッシュ", "Lamdash"],
    ["シリーズ", "Series"],
    ["メンズシェーバー", "Men's shaver"],
    ["電気シェーバー", "electric shaver"],
    ["携帯用", "portable "],
    ["モバイルシェーブ", "MobileShave"],
    ["ポケシェーバー", "PockeShaver"],
    ["髭剃り", "shaving"],
    ["ひげそり", "shaving"],
    ["お風呂剃り対応", "wet-shave compatible"],
    ["まるごと水洗い", "fully washable"],
    ["水洗い", "washable"],
    ["深剃り", "close shave"],
    ["回転刃", "rotary blade"],
    ["プラグイン充電式", "plug-in rechargeable"],
    ["オートボルテージ機能", "auto-voltage function"],
    ["USB充電式", "USB rechargeable"],
    ["ノーズ＆フェイスシェーバー", "nose and face shaver"],
    ["チタンシルバー", "titanium silver"],
    ["マットブラック", "matte black"],
    ["ブラック", "black"],
    ["ダークネイビー", "dark navy"],
    ["アズールブルー", "azure blue"],
    ["クラフトブラック", "craft black"],
    ["枚刃", "-blade"],
    ["1台", "1 unit"],
    ["1個", "1 piece"],
    ["旅行", "travel"],
    ["持ち運び", "portable"],
    ["男性用", "for men"]
  ];
  for (const [from, to] of replacements) {
    output = output.replaceAll(from, to);
  }
  output = output
    .replace(/(\d+)\s*-blade/g, "$1-blade")
    .replace(/\b(Braun)\s+\1\b/gi, "$1")
    .replace(/\b(Kai)\s+\1\b/gi, "$1")
    .replace(/\b(Panasonic)\s+\1\b/gi, "$1")
    .replace(/\s+\]/g, "]")
    .replace(/\[\s+/g, "[")
    .replace(/\s+/g, " ")
    .trim();
  return output || normalizeProductName(title);
}

export function isBraunProduct(item = {}) {
  const text = normalizeProductName([
    item.brand,
    item.titleOriginal,
    item.titleDisplay,
    item.titleEnglish
  ].filter(Boolean).join(" ")).toLowerCase();
  return /\bbraun\b|ブラウン|p&g\s*braun|p&gジャパン\s*braun|p＆gジャパン\s*braun/i.test(text);
}

export function normalizePrice(price) {
  if (price == null) return null;
  const numeric = String(price).replace(/[^\d.]/g, "");
  return numeric ? Number(numeric) : null;
}

export function normalizeNumber(value) {
  if (value == null) return null;
  const numeric = String(value).replace(/[^\d.]/g, "");
  return numeric ? Number(numeric) : null;
}

export function extractSourceUpdatedAt(html) {
  const text = stripTags(html);
  return normalizeWhitespace(
    text.match(/(?:更新|集計日|現在)[^\d]*(\d{4}年\d{1,2}月\d{1,2}日(?:\([^)]+\))?(?:\d{1,2}:\d{2})?)/)?.[1] ??
      text.match(/(\d{4}\/\d{1,2}\/\d{1,2})\s*現在/)?.[1] ??
      ""
  ) || null;
}

export function extractJsonLdItems(html, sourceUrl, maxItems = 5) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const items = [];
  for (const block of blocks) {
    const raw = normalizeWhitespace(block[1]);
    try {
      const parsed = JSON.parse(raw);
      for (const graph of findJsonLdNodes(parsed)) {
        if (String(graph?.["@type"] ?? "").toLowerCase().includes("breadcrumb")) continue;
        const list = graph?.itemListElement;
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          const item = entry.item ?? entry;
          const title = item.name ?? entry.name;
          if (!title) continue;
          const offers = item.offers;
          const price = offers?.lowPrice ?? offers?.price ?? null;
          items.push(toRankingItem({
            rank: Number(entry.position ?? items.length + 1),
            title,
            brand: item.brand?.name ?? item.brand,
            price: price ? `¥${Number(price).toLocaleString("ja-JP")}` : null,
            rating: item.aggregateRating?.ratingValue ?? null,
            reviewCount: item.aggregateRating?.reviewCount ?? item.aggregateRating?.ratingCount ?? null,
            productUrl: item.url ?? cleanProductUrl(item["@id"]) ?? entry.url ?? sourceUrl
          }));
        }
      }
    } catch {
      continue;
    }
  }
  return dedupeItems(items).slice(0, maxItems);
}

function findJsonLdNodes(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const entry of value) findJsonLdNodes(entry, output);
    return output;
  }
  if (value["@type"] || value.itemListElement) output.push(value);
  if (Array.isArray(value["@graph"])) findJsonLdNodes(value["@graph"], output);
  if (Array.isArray(value.mainEntity)) findJsonLdNodes(value.mainEntity, output);
  if (value.mainEntity && !Array.isArray(value.mainEntity)) findJsonLdNodes(value.mainEntity, output);
  return output;
}

function cleanProductUrl(value) {
  if (!value) return null;
  return String(value).replace(/#Product$/, "");
}

export function extractRankedCards(html, sourceUrl, maxItems = 5) {
  const candidates = [];
  const rankPatterns = [
    /<title>\s*ランキング\/(\d{1,2})位\s*<\/title>[\s\S]{0,4500}?<a[^>]+href=["']([^"']+)["'][^>]*>\s*<img[^>]+alt=["']([^"']+)["'][^>]*>/gi,
    /(?:alt=["']|class=["'][^"']*)#?(\d{1,2})\s*位?["'][\s\S]{0,2500}?(?:<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{8,500}?)<\/a>)/gi,
    /(?:順位|rank|ranking|data-rank)[^0-9]{0,20}(\d{1,2})[\s\S]{0,2500}?(?:<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{8,500}?)<\/a>)/gi,
    /<li[^>]*(?:rank|ranking|item)[^>]*>[\s\S]{0,300}?(\d{1,2})\s*位[\s\S]{0,2500}?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{8,500}?)<\/a>/gi
  ];
  for (const pattern of rankPatterns) {
    for (const match of html.matchAll(pattern)) {
      const title = cleanTitle(match[3]);
      if (isUsefulTitle(title)) {
        const context = html.slice(match.index ?? 0, (match.index ?? 0) + 6000);
        candidates.push(toRankingItem({
          rank: Number(match[1]),
          title,
          productUrl: absolutizeUrl(match[2], sourceUrl),
          price: nearbyPrice(context),
          rating: nearbyRating(context),
          reviewCount: nearbyReviews(context)
        }));
      }
    }
  }

  if (candidates.length < 2) {
    const text = stripTags(html);
    const lines = text.split(/\n|\s{2,}/).map(normalizeWhitespace).filter(Boolean);
    for (let index = 0; index < lines.length; index += 1) {
      const rankMatch = lines[index].match(/^#?(\d{1,2})位?$/);
      if (!rankMatch) continue;
      const title = lines.slice(index + 1, index + 5).find(isUsefulTitle);
      if (title) {
        candidates.push(toRankingItem({
          rank: Number(rankMatch[1]),
          title,
          productUrl: sourceUrl,
          price: lines.slice(index + 1, index + 8).find((line) => /[¥￥]\s?[\d,]+|\d[\d,]*円/.test(line)) ?? null,
          reviewCount: lines.slice(index + 1, index + 8).find((line) => /レビュー|件|\(\d[\d,]*\)/.test(line))?.match(/[\d,]+/)?.[0] ?? null
        }));
      }
    }
  }

  return dedupeItems(candidates)
    .filter((item) => item.rank > 0 && item.rank <= 80)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxItems);
}

export function parseRankingSource(html, source) {
  const maxItems = source.maxItems ?? 5;
  const kakakuItems = source.id === "kakaku" ? extractKakakuItems(html, source.url, maxItems) : [];
  const jsonLd = kakakuItems.length ? [] : extractJsonLdItems(html, source.url, maxItems);
  const items = kakakuItems.length ? kakakuItems : (jsonLd.length ? jsonLd : extractRankedCards(html, source.url, maxItems));
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    rankingType: source.rankingType,
    locale: source.locale,
    status: items.length ? "ok" : "unavailable",
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: extractSourceUpdatedAt(html),
    error: items.length ? null : "No ranking items could be extracted from the fetched page.",
    items
  };
}

export function extractKakakuItems(html, sourceUrl, maxItems = 5) {
  const start = html.indexOf("シェーバー 人気売れ筋ランキング");
  if (start < 0) return [];
  const end = html.indexOf("</ol>", start);
  const section = html.slice(start, end > start ? end : start + 30000);
  const blocks = section.split(/<li class="itemContListIn">/i).slice(1);
  const items = [];
  for (const block of blocks) {
    const rank = Number(block.match(/<span class="rank[^"]*">\s*(\d{1,2})\s*<\/span>/i)?.[1]);
    const link = block.match(/<p class="itemName">\s*<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/i);
    if (!rank || !link) continue;
    items.push(toRankingItem({
      rank,
      title: link[2],
      brand: stripTags(block.match(/<p class="makerName">([\s\S]*?)<\/p>/i)?.[1] ?? ""),
      price: stripTags(block.match(/<p class="itemPrice">([\s\S]*?)<\/p>/i)?.[1] ?? ""),
      rating: stripTags(block.match(/<p class="starRate">[\s\S]*?<span class="num1">([\s\S]*?)<\/span>/i)?.[1] ?? ""),
      reviewCount: stripTags(block.match(/<p class="starRate">[\s\S]*?<span class="num2">（?([\d,]+)人?）?<\/span>/i)?.[1] ?? ""),
      productUrl: absolutizeUrl(link[1], sourceUrl)
    }));
  }
  return items.slice(0, maxItems);
}

export function compareSnapshots(previous, next) {
  const changes = [];
  const eventDate = next?.generatedAt ?? new Date().toISOString();
  const previousSources = new Map((previous?.sources ?? []).map((source) => [source.id, source]));
  for (const source of next.sources ?? []) {
    const before = previousSources.get(source.id);
    if (!before) {
      for (const item of topTen(source.items)) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "new_entry",
          afterItem: item,
          reason: "new_entry"
        }));
      }
      continue;
    }
    const beforeItems = topTen(before.items);
    const afterItems = topTen(source.items);
    const beforeByRank = new Map(beforeItems.map((item) => [item.rank, item]));
    const beforeSignatures = new Map(beforeItems.map((item) => [item.signature, item]));
    const afterSignatures = new Map(afterItems.map((item) => [item.signature, item]));
    for (const item of afterItems) {
      const sameRank = beforeByRank.get(item.rank);
      const sameProduct = beforeSignatures.get(item.signature);
      if (!sameRank) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "new_entry",
          afterItem: item,
          reason: "new_entry"
        }));
      } else if (sameRank.signature !== item.signature) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "product_changed",
          beforeItem: sameRank,
          afterItem: item,
          reason: inferRankChangeReason(sameRank, item, { sameRank })
        }));
      }
      if (sameProduct && sameProduct.rank !== item.rank) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "rank_moved",
          beforeItem: sameProduct,
          afterItem: item,
          reason: inferRankChangeReason(sameProduct, item, { beforeItems, afterItems })
        }));
      }
      if (sameProduct && (sameProduct.price ?? null) !== (item.price ?? null)) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "price_changed",
          beforeItem: sameProduct,
          afterItem: item,
          reason: inferRankChangeReason(sameProduct, item, { priceOnly: true })
        }));
      }
      if (sameProduct && (sameProduct.rating ?? null) !== (item.rating ?? null)) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "rating_changed",
          beforeItem: sameProduct,
          afterItem: item,
          reason: "rating_change"
        }));
      }
      if (sameProduct && (sameProduct.reviewCount ?? null) !== (item.reviewCount ?? null)) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "review_count_changed",
          beforeItem: sameProduct,
          afterItem: item,
          reason: "review_count_change"
        }));
      }
    }
    for (const oldItem of beforeItems) {
      if (!afterSignatures.has(oldItem.signature)) {
        changes.push(createEvent({
          date: eventDate,
          sourceId: source.id,
          sourceName: source.name,
          eventType: "removed_from_top_10",
          beforeItem: oldItem,
          reason: "removed_from_top_10"
        }));
      }
    }
    if (before.status !== source.status) {
      changes.push({
        id: eventId({ date: eventDate, sourceId: source.id, eventType: "source_status_changed", signature: source.id, before: before.status, after: source.status }),
        date: eventDate,
        sourceId: source.id,
        sourceName: source.name,
        productSignature: source.id,
        brand: null,
        titleOriginal: source.name,
        titleDisplay: source.name,
        rankBefore: null,
        rankAfter: null,
        priceBefore: null,
        priceAfter: null,
        ratingBefore: null,
        ratingAfter: null,
        reviewCountBefore: null,
        reviewCountAfter: null,
        eventType: "source_status_changed",
        type: "status_changed",
        reason: "source_unavailable",
        reasonText: `Source status changed from ${before.status} to ${source.status}.`,
        before: before.status,
        after: source.status,
        isBraun: false
      });
    }
  }
  return changes;
}

export function inferRankChangeReason(beforeItem, afterItem, context = {}) {
  if (!beforeItem && afterItem) return "new_entry";
  if (beforeItem && !afterItem) return "removed_from_top_10";
  if (!beforeItem || !afterItem) return "unknown";
  const beforePrice = normalizePrice(beforeItem.price);
  const afterPrice = normalizePrice(afterItem.price);
  if (beforePrice != null && afterPrice != null && afterPrice < beforePrice) return "price_drop";
  if (beforePrice != null && afterPrice != null && afterPrice > beforePrice) return "price_increase";
  const beforeRating = normalizeNumber(beforeItem.rating);
  const afterRating = normalizeNumber(afterItem.rating);
  if (beforeRating != null && afterRating != null && afterRating !== beforeRating) return "rating_change";
  const beforeReviews = normalizeNumber(beforeItem.reviewCount);
  const afterReviews = normalizeNumber(afterItem.reviewCount);
  if (beforeReviews != null && afterReviews != null && afterReviews !== beforeReviews) return "review_count_change";
  if (beforeItem.rank !== afterItem.rank) return "competitor_moved_above";
  return context.priceOnly ? "unknown" : "unknown";
}

export function reasonTextForEvent(event) {
  const title = translateProductTitle(event.titleDisplay ?? event.titleOriginal ?? "Product");
  const direction = event.rankBefore != null && event.rankAfter != null
    ? (event.rankAfter < event.rankBefore ? `Moved up ${event.rankBefore - event.rankAfter} rank${event.rankBefore - event.rankAfter === 1 ? "" : "s"}` : `Moved down ${event.rankAfter - event.rankBefore} rank${event.rankAfter - event.rankBefore === 1 ? "" : "s"}`)
    : null;
  switch (event.reason) {
    case "price_drop":
      return `${direction ?? "Changed"} after price dropped from ${event.priceBefore} to ${event.priceAfter}.`;
    case "price_increase":
      return `${direction ?? "Changed"} while price increased from ${event.priceBefore} to ${event.priceAfter}.`;
    case "rating_change":
      return `${direction ?? "Changed"} with rating changing from ${event.ratingBefore ?? "n/a"} to ${event.ratingAfter ?? "n/a"}.`;
    case "review_count_change":
      return `${direction ?? "Changed"} with review count changing from ${event.reviewCountBefore ?? "n/a"} to ${event.reviewCountAfter ?? "n/a"}.`;
    case "new_entry":
      return `${title} entered the tracked top 10 at #${event.rankAfter}.`;
    case "removed_from_top_10":
      return `${title} left the tracked top 10 from #${event.rankBefore}.`;
    case "competitor_moved_above":
      return `${direction ?? "Rank changed"} with no visible price, rating, or review-count driver in the captured data.`;
    case "source_unavailable":
      return event.reasonText ?? "Source availability changed.";
    default:
      return `${direction ?? "Changed"}; no visible driver was captured.`;
  }
}

export function appendEvents(existing = [], incoming = []) {
  const byId = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) {
    byId.set(event.id, { ...event, reasonText: event.reasonText ?? reasonTextForEvent(event) });
  }
  return [...byId.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function buildTrendSeries(historySnapshots = [], events = [], currentSnapshot = null) {
  const points = [];
  for (const snapshot of [...historySnapshots, currentSnapshot].filter(Boolean)) {
    for (const source of snapshot.sources ?? []) {
      for (const item of topTen(source.items)) {
        points.push({
          date: snapshot.generatedAt,
          sourceId: source.id,
          sourceName: source.name,
          productSignature: item.signature,
          titleOriginal: item.titleOriginal,
          titleDisplay: item.titleDisplay,
          brand: pickBrand(item.titleOriginal) ?? item.brand,
          isBraun: isBraunProduct(item),
          rank: item.rank,
          price: item.price,
          priceValue: normalizePrice(item.price),
          rating: item.rating,
          ratingValue: normalizeNumber(item.rating),
          reviewCount: item.reviewCount,
          reviewCountValue: normalizeNumber(item.reviewCount),
          productUrl: item.productUrl
        });
      }
    }
  }
  const grouped = new Map();
  for (const point of points) {
    const key = `${point.sourceId}:${point.productSignature}`;
    const list = grouped.get(key) ?? [];
    list.push(point);
    grouped.set(key, list);
  }
  const products = [...grouped.entries()].map(([key, series]) => {
    series.sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = series[0];
    const last = series.at(-1);
    return {
      key,
      sourceId: first.sourceId,
      sourceName: first.sourceName,
      productSignature: first.productSignature,
      titleOriginal: last.titleOriginal,
      titleDisplay: last.titleDisplay,
      brand: last.brand,
      isBraun: series.some((point) => point.isBraun),
      firstSeen: first.date,
      lastSeen: last.date,
      daysSeen: new Set(series.map((point) => String(point.date).slice(0, 10))).size,
      firstRank: first.rank,
      currentRank: last.rank,
      bestRank: Math.min(...series.map((point) => point.rank)),
      rankDelta: first.rank - last.rank,
      firstPrice: first.price,
      currentPrice: last.price,
      priceDelta: first.priceValue != null && last.priceValue != null ? last.priceValue - first.priceValue : null,
      currentRating: last.rating,
      sourceAppearances: series.length,
      series
    };
  }).sort((a, b) => {
    if (a.isBraun !== b.isBraun) return a.isBraun ? -1 : 1;
    return a.currentRank - b.currentRank || a.sourceId.localeCompare(b.sourceId);
  });
  return {
    generatedAt: currentSnapshot?.generatedAt ?? new Date().toISOString(),
    totalProducts: products.length,
    braunProducts: products.filter((product) => product.isBraun).length,
    latestEvents: events.slice(-30).reverse(),
    products
  };
}

function createEvent({ date, sourceId, sourceName, eventType, beforeItem = null, afterItem = null, reason = "unknown" }) {
  const item = afterItem ?? beforeItem ?? {};
  const event = {
    date,
    sourceId,
    sourceName,
    productSignature: item.signature ?? "",
    brand: pickBrand(item.titleOriginal) ?? item.brand ?? null,
    titleOriginal: item.titleOriginal ?? item.titleDisplay ?? "",
    titleDisplay: item.titleDisplay ?? item.titleOriginal ?? "",
    rankBefore: beforeItem?.rank ?? null,
    rankAfter: afterItem?.rank ?? null,
    priceBefore: beforeItem?.price ?? null,
    priceAfter: afterItem?.price ?? null,
    ratingBefore: beforeItem?.rating ?? null,
    ratingAfter: afterItem?.rating ?? null,
    reviewCountBefore: beforeItem?.reviewCount ?? null,
    reviewCountAfter: afterItem?.reviewCount ?? null,
    eventType,
    type: legacyType(eventType),
    reason,
    isBraun: isBraunProduct(item),
    rank: afterItem?.rank ?? beforeItem?.rank ?? null,
    title: item.titleDisplay ?? item.titleOriginal ?? "",
    before: beforeItem?.titleDisplay ?? beforeItem?.price ?? null,
    after: afterItem?.titleDisplay ?? afterItem?.price ?? null,
    beforeRank: beforeItem?.rank ?? null,
    afterRank: afterItem?.rank ?? null
  };
  event.id = eventId({
    date,
    sourceId,
    eventType,
    signature: event.productSignature,
    before: `${event.rankBefore}:${event.priceBefore}:${event.ratingBefore}:${event.reviewCountBefore}`,
    after: `${event.rankAfter}:${event.priceAfter}:${event.ratingAfter}:${event.reviewCountAfter}`
  });
  event.reasonText = reasonTextForEvent(event);
  return event;
}

function eventId({ date, sourceId, eventType, signature, before, after }) {
  return signatureFor([String(date).slice(0, 10), sourceId, eventType, signature, before, after].filter(Boolean).join("|"));
}

function legacyType(eventType) {
  return {
    new_entry: "new_rank",
    removed_from_top_10: "product_removed",
    source_status_changed: "status_changed",
    rating_changed: "rating_changed",
    review_count_changed: "review_count_changed"
  }[eventType] ?? eventType;
}

function topTen(items = []) {
  return [...items].filter((item) => Number(item.rank) <= 10).sort((a, b) => a.rank - b.rank).slice(0, 10);
}

export function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo"
  }).format(new Date(value));
}

function toRankingItem({ rank, title, brand, price, rating, reviewCount, productUrl }) {
  const titleOriginal = normalizeWhitespace(stripTags(title));
  return {
    rank: Number(rank),
    titleOriginal,
    titleDisplay: normalizeProductName(titleOriginal),
    brand: normalizeWhitespace(brand) || pickBrand(titleOriginal),
    price: normalizeWhitespace(price) || null,
    rating: normalizeWhitespace(rating) || null,
    reviewCount: normalizeWhitespace(reviewCount) || null,
    productUrl,
    signature: signatureFor(titleOriginal)
  };
}

function cleanTitle(value) {
  return normalizeWhitespace(stripTags(value)).replace(/^画像[:：]?/i, "").trim();
}

function isUsefulTitle(value) {
  const text = normalizeProductName(value);
  if (text.length < 8 || text.length > 220) return false;
  if (/ランキング|カテゴリ|ログイン|お気に入り|カート|詳しく比較|この商品/.test(text)) return false;
  return /シェーバー|髭剃り|ひげそり|電気|ラムダッシュ|ブラウン|BRAUN|Panasonic|PHILIPS|フィリップス/i.test(text);
}

function nearbyPrice(html) {
  return normalizeWhitespace(stripTags(html).match(/[¥￥]\s?[\d,]+(?:円)?|\d[\d,]*\s*円(?:（税込）)?/)?.[0] ?? "") || null;
}

function nearbyRating(html) {
  return normalizeWhitespace(stripTags(html).match(/(?:評価|rating)?\s*([0-5]\.\d{1,2})/)?.[1] ?? "") || null;
}

function nearbyReviews(html) {
  return normalizeWhitespace(stripTags(html).match(/レビュー[^\d]{0,5}([\d,]+)|[（(]([\d,]+)[）)]/)?.slice(1).find(Boolean) ?? "") || null;
}

function absolutizeUrl(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return base;
  }
}

function dedupeItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = `${item.rank}:${item.signature}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}
