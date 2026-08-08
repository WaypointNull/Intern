const { normalizeTag } = require('./parser');
const { createPriorityIndex, applyPriorityTier } = require('./priority');

function createTagSuggester({ repository, retrieval }) {
  let readyPromise = null;
  const priority = createPriorityIndex({ repository });

  function ensureReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        const summary = await repository.ensureTagList();
        const indexStats = retrieval.buildIndex();
        const priorityStats = priority.build();
        return { ...summary, ...indexStats, ...priorityStats };
      })().catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  function isReady() {
    return repository.isLoaded() && retrieval.isBuilt();
  }

  // Suggest alternative tags for one tag. The exact match is excluded (replacing a tag with itself is
  // a no-op), explicit NSFW content is pruned, and candidates are deduped and enriched with metadata.
  function getCandidates(tag, { limit = 12 } = {}) {
    if (!isReady()) return [];
    const key = normalizeTag(tag);
    if (!key) return [];

    const pool = retrieval.buildConceptCandidates(key, { limit: Math.max(20, limit * 3) });
    const merged = new Map();
    for (const candidate of pool) {
      if (candidate.tag === key) continue;
      if (retrieval.isNsfwContent(candidate.tag)) continue;
      if (merged.has(candidate.tag)) continue;
      const meta = repository.getTagMeta(candidate.tag);
      merged.set(candidate.tag, {
        tag: candidate.tag,
        score: candidate.score,
        category: meta ? Number(meta.category) : null,
        postCount: meta ? meta.postCount : 0
      });
    }
    const out = applyPriorityTier([...merged.values()], key, {
      repository,
      retrieval,
      priority,
      limit
    });
    return out;
  }

  return {
    ensureReady,
    isReady,
    getCandidates
  };
}

module.exports = { createTagSuggester };
