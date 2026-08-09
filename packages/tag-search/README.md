# @waypointnull/tag-search

Deterministic booru-style tag search engine, shared by Akumu and Tsuki.

Pure CommonJS, zero runtime dependencies, Node >=18. It normalizes tags, resolves them
against the ~322k-tag danbooru+e621 merged list (exact / alias / fuzzy), and suggests
alternatives with NSFW pruning and a token-containment priority tier.

## Install

```bash
npm install @waypointnull/tag-search
```

## Usage

```js
const {
  createTagListRepository,
  createRetrievalIndex,
  createTagSuggester
} = require('@waypointnull/tag-search');

const repository = createTagListRepository({ dataDir: './data' });
const retrieval = createRetrievalIndex({ repository });
const suggester = createTagSuggester({ repository, retrieval });

await suggester.ensureReady(); // loads/downloads the tag list, builds the index
const candidates = suggester.getCandidates('blue_hair', { limit: 12 });
```

The tag list (`danbooru-tags.txt`, ~8 MB) is downloaded once from `TAG_LIST_URL` if the
local file is missing. Where it lives is resolved in this order:

1. `dataDir` constructor option (`createTagListRepository({ dataDir })`)
2. `AKUMU_DATA_DIR` env (legacy: Akumu desktop + UsagiAI hub-spawned plugins)
3. `TAG_DATA_DIR` env
4. `<cwd>/data/danbooru-tags.txt`

You can pre-seed the file to keep the package fully offline.

## Public surface

- parser: `normalizeTag`, `isUsableTag`, `splitTags`, `parseLoraInput`, `isSectionLabel`,
  `parseCsvRecords`, `parseCsvLine`, `dedupeKeepOrder`
- metrics: `trigrams`, `tokenize`, `damerauLevenshtein`
- `createTagListRepository({ dataDir?, junkTokens? })`
- `createRetrievalIndex({ repository })`
- `createPriorityIndex({ repository })`, `applyPriorityTier`, `popularityFactor`
- `createTagSuggester({ repository, retrieval })`
- `constants` (tuning knobs: `RETRIEVAL`, `PRIORITY_TIER`, `JUNK_TOKENS`, `NSFW_*`,
  `TAG_LIST_URL`)

## Tuning

- `PRIORITY_TIER.enabled = false` restores pure hybrid fuzzy suggestions.
- `createTagListRepository({ junkTokens })` overrides the default junk-token set
  (the union of Akumu's and Tsuki's lists).

## License

WaypointNull Community License v2.0
