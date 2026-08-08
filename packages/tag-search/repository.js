const fs = require('fs');
const path = require('path');
const { TAG_LIST_URL } = require('./constants');
const { normalizeTag, isUsableTag, parseCsvRecords } = require('./parser');

// WORKAROUND: the tag file lives somewhere different in every host context (Akumu desktop appData,
// Tsuki standalone repo data/, hub-spawned plugin data dir). Resolve it from an explicit option
// first, then the legacy/plugin env vars, then a plain cwd/data default.
function resolveTagFilePath(dataDir) {
  if (dataDir) {
    return path.join(dataDir, 'danbooru-tags.txt');
  }
  if (process.env.AKUMU_DATA_DIR) {
    return path.join(process.env.AKUMU_DATA_DIR, 'danbooru-tags.txt');
  }
  if (process.env.TAG_DATA_DIR) {
    return path.join(process.env.TAG_DATA_DIR, 'danbooru-tags.txt');
  }
  return path.join(process.cwd(), 'data', 'danbooru-tags.txt');
}

function createTagListRepository({ dataDir, junkTokens } = {}) {
  const tagFilePath = resolveTagFilePath(dataDir);
  let tagSet = new Set();
  let tagMeta = new Map();
  let aliasToCanonical = new Map();
  let canonicalToAliases = new Map();
  let collisions = new Map();
  let baseToQualified = new Map();
  let loaded = false;

  function loadFromRecords(records) {
    tagSet = new Set();
    tagMeta = new Map();
    aliasToCanonical = new Map();
    canonicalToAliases = new Map();
    collisions = new Map();
    baseToQualified = new Map();

    for (const record of records) {
      const canonical = normalizeTag(record.tag);
      if (!isUsableTag(canonical, junkTokens)) {
        continue;
      }
      tagSet.add(canonical);
      tagMeta.set(canonical, {
        category: record.category,
        postCount: Number(record.posts) || 0
      });
    }

    for (const canonical of tagSet) {
      const match = /^(.*?)_\(([^)]+)\)$/.exec(canonical);
      if (!match) {
        continue;
      }
      const base = match[1];
      const list = baseToQualified.get(base) || [];
      const meta = tagMeta.get(canonical);
      list.push({ tag: canonical, qualifier: match[2], category: meta.category, postCount: meta.postCount });
      baseToQualified.set(base, list);
    }

    for (const record of records) {
      const canonical = normalizeTag(record.tag);
      if (!tagSet.has(canonical)) {
        continue;
      }
      for (const alias of record.aliases) {
        const key = normalizeTag(alias);
        if (!key || !isUsableTag(key, junkTokens) || key === canonical) {
          continue;
        }
        const existing = aliasToCanonical.get(key);
        if (existing === undefined) {
          aliasToCanonical.set(key, canonical);
          continue;
        }
        if (existing === canonical) {
          continue;
        }
        if (!collisions.has(key)) {
          collisions.set(key, [{ tag: existing, postCount: tagMeta.get(existing)?.postCount || 0 }]);
        }
        collisions.get(key).push({ tag: canonical, postCount: tagMeta.get(canonical)?.postCount || 0 });
      }
    }

    // WORKAROUND: the merged danbooru+e621 list maps the same alias to multiple canonicals; pick a deterministic winner.
    for (const [alias, candidates] of collisions) {
      const winner = candidates.reduce((best, candidate) => (candidate.postCount > best.postCount ? candidate : best));
      aliasToCanonical.set(alias, winner.tag);
    }

    for (const [alias, canonical] of aliasToCanonical) {
      const list = canonicalToAliases.get(canonical) || [];
      list.push(alias);
      canonicalToAliases.set(canonical, list);
    }

    loaded = true;

    return {
      tags: tagSet.size,
      aliases: aliasToCanonical.size,
      collisions: collisions.size
    };
  }

  async function ensureTagList() {
    fs.mkdirSync(path.dirname(tagFilePath), { recursive: true });

    // WORKAROUND: persist the ~30MB CSV to disk and reuse it instead of re-downloading on every boot.
    if (!fs.existsSync(tagFilePath)) {
      const response = await fetch(TAG_LIST_URL);
      if (!response.ok) {
        throw new Error(`Could not download danbooru tags (${response.status}).`);
      }
      const text = await response.text();
      fs.writeFileSync(tagFilePath, text, 'utf8');
    }

    const records = parseCsvRecords(fs.readFileSync(tagFilePath, 'utf8'));
    return loadFromRecords(records);
  }

  function getTagSet() {
    return tagSet;
  }

  function getTagMeta(tag) {
    const key = normalizeTag(tag);
    return tagMeta.get(key) || null;
  }

  function resolveAlias(tag) {
    const key = normalizeTag(tag);
    return aliasToCanonical.get(key) || null;
  }

  function getAliasMap() {
    return aliasToCanonical;
  }

  function getCanonicalAliases(tag) {
    const key = normalizeTag(tag);
    return canonicalToAliases.get(key) || [];
  }

  function getQualifiedVariants(base) {
    const key = normalizeTag(base);
    return baseToQualified.get(key) || [];
  }

  function getAliasCollisions() {
    return collisions;
  }

  function resolveTag(tag) {
    const key = normalizeTag(tag);
    if (tagSet.has(key)) {
      return { status: 'exact', tag: key };
    }
    const canonical = aliasToCanonical.get(key);
    if (canonical) {
      return { status: 'alias', tag: canonical };
    }
    return { status: 'unknown', tag: key };
  }

  return {
    ensureTagList,
    loadFromRecords,
    isLoaded: () => loaded,
    getTagSet,
    getTagMeta,
    resolveAlias,
    getAliasMap,
    getCanonicalAliases,
    getQualifiedVariants,
    getAliasCollisions,
    resolveTag
  };
}

module.exports = { createTagListRepository };
