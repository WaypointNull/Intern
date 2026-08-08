const { PRIORITY_TIER } = require('./constants');
const { normalizeTag } = require('./parser');
const { tokenize } = require('./metrics');

// Token-containment index over the tag list: for a query like "phone" it surfaces compound tags
// that keep "phone" as a token ("holding_phone", "on_phone", "phone_call"), which the hybrid fuzzy
// pool can miss entirely. The fuzzy pool for a short query is capped at 60 trigram-overlap hits and
// long compounds rank too low to make the cut.
function createPriorityIndex({ repository }) {
  let tokenMap = null;

  function build() {
    const map = new Map();
    for (const tag of repository.getTagSet()) {
      const norm = normalizeTag(tag);
      if (!norm) continue;
      const meta = repository.getTagMeta(norm);
      const postCount = meta ? meta.postCount : 0;
      for (const token of new Set(tokenize(norm))) {
        let list = map.get(token);
        if (!list) {
          list = [];
          map.set(token, list);
        }
        list.push({ tag, postCount });
      }
    }
    for (const list of map.values()) list.sort((a, b) => b.postCount - a.postCount);
    tokenMap = map;
    return { tokens: tokenMap.size };
  }

  function ensureBuilt() {
    if (!tokenMap) build();
  }

  function containmentTags(key) {
    ensureBuilt();
    const tokens = tokenize(key);
    if (tokens.length === 0) return [];
    const lists = tokens.map((token) => tokenMap.get(token) || []);
    if (tokens.length === 1) {
      return lists[0].filter((entry) => entry.tag !== key).slice(0, PRIORITY_TIER.maxPerToken);
    }
    let base = lists[0];
    for (let i = 1; i < lists.length; i++) {
      if (lists[i].length < base.length) {
        const tmp = base;
        base = lists[i];
        lists[i] = tmp;
      }
    }
    const memberships = lists.slice(1).map((list) => new Set(list.map((entry) => entry.tag)));
    const intersected = base.filter((entry) => memberships.every((set) => set.has(entry.tag)));
    intersected.sort((a, b) => b.postCount - a.postCount);
    return intersected.filter((entry) => entry.tag !== key).slice(0, PRIORITY_TIER.maxContainment);
  }

  return {
    build,
    containmentTags,
    isBuilt: () => !!tokenMap
  };
}

function popularityFactor(postCount) {
  if (!postCount || postCount <= 0) return 0;
  return Math.min(1, Math.log2(1 + postCount) / Math.log2(1 + PRIORITY_TIER.maxPostCount));
}

function applyPriorityTier(candidates, query, { repository, retrieval, priority, limit } = {}) {
  if (!PRIORITY_TIER.enabled) return candidates.slice(0, limit);
  const key = normalizeTag(query);
  if (!key || !priority) return candidates.slice(0, limit);

  const containment = priority.containmentTags(key);
  if (containment.length === 0) return candidates.slice(0, limit);

  const merged = new Map(candidates.map((candidate) => [candidate.tag, candidate]));
  const boosted = [];
  for (const { tag, postCount } of containment) {
    if (retrieval.isNsfwContent(tag)) continue;
    const score = PRIORITY_TIER.base + PRIORITY_TIER.popWeight * popularityFactor(postCount);
    const existing = merged.get(tag);
    if (existing && existing.score >= score) continue;
    const meta = repository.getTagMeta(tag);
    boosted.push({
      tag,
      score,
      category: meta ? Number(meta.category) : null,
      postCount: meta ? meta.postCount : 0
    });
  }
  boosted.sort((a, b) => b.score - a.score);
  for (const candidate of boosted.slice(0, PRIORITY_TIER.maxContainment)) merged.set(candidate.tag, candidate);

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = { createPriorityIndex, applyPriorityTier, popularityFactor };
