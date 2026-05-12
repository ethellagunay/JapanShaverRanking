# Japan Men’s Electric Shaver Ranking Summary Site

Static English summary site for configurable Japanese men’s electric shaver ranking pages.

## Commands

- `node scripts/fetch-rankings.ts --output=.cache/latest.json` fetches configured sources.
- `node scripts/detect-changes.ts --incoming=.cache/latest.json --apply` updates `data/current.json` and writes a dated history snapshot only when rankings changed.
- `node scripts/update-rankings.ts` runs fetch, compare, snapshot, and rebuild.
- `node scripts/build-site.ts` writes the static site to `dist/`.
- `node --test tests/*.test.mjs` runs parser and change-detection tests.

## Generated Data

- `data/current.json` stores the latest top-10 source snapshot.
- `data/events.json` stores structured movement events with heuristic reason labels.
- `data/trends.json` stores product/source trend series, including Braun rollups.
- `dist/index.html` shows the comparison board and Braun Watch.
- `dist/trends.html` shows trend tables and rank sparklines.
- `dist/history.html` shows dated change summaries.

## Source Configuration

Edit `sources.json` to change the three tracked sources. Each source needs:

- `id`: stable source identifier.
- `name`: display name.
- `url`: ranking page URL.
- `rankingType`: human-readable ranking basis.
- `locale`: source locale.
- `maxItems`: number of products to display.

The default sources are Kakaku, MyBest, and LOHACO. Amazon is intentionally excluded unless an approved API or policy-safe source is available.
