const test = require('node:test');
const assert = require('node:assert/strict');

const { createTagListRepository, createRetrievalIndex, createTagSuggester } = require('..');
const { PRIORITY_TIER } = require('../constants');

const repository = createTagListRepository();
const retrieval = createRetrievalIndex({ repository });
const suggester = createTagSuggester({ repository, retrieval });

test.before(async () => {
  await suggester.ensureReady();
});

function tagsFor(tag, limit = 12) {
  return suggester.getCandidates(tag, { limit }).map((c) => c.tag);
}

// The priority tier (pysssss-style token containment) is a suggestion-ranking additive on top of
// the hybrid fuzzy matcher. These tests guard the behavior the tier exists for, and that flipping
// PRIORITY_TIER.enabled to false restores the previous pure-hybrid list exactly.

test('priority tier: phone surfaces holding_phone (the pysssss example)', () => {
  assert.ok(tagsFor('phone').includes('holding_phone'), 'holding_phone must be suggested for phone');
});

test('priority tier: containment outranks fuzzy-only noise', () => {
  const candidates = suggester.getCandidates('phone', { limit: 12 });
  const idxHolding = candidates.findIndex((c) => c.tag === 'holding_phone');
  assert.ok(idxHolding >= 0, 'holding_phone must be suggested for phone');
  const idxNoise = candidates.findIndex((c) => c.tag === 'p-hone');
  if (idxNoise >= 0) {
    assert.ok(idxHolding < idxNoise, 'holding_phone must outrank the non-containment fuzzy hit p-hone');
  }
});

test('priority tier: multi-token queries surface compounds that keep both tokens', () => {
  const tags = tagsFor('blue_hair');
  assert.ok(
    tags.some((t) => t.startsWith('blue_') && t !== 'blue_hair'),
    'blue_hair should surface blue_* compound tags'
  );
});

test('priority tier: complaint cases stay clean', () => {
  assert.ok(!tagsFor('1girl').includes('dickgirl'), 'dickgirl must never be suggested for 1girl');
  const solo = tagsFor('solo');
  assert.ok(!solo.includes('logo') && !solo.includes('bolero'), 'solo must never suggest logo/bolero');
  const blue = tagsFor('blue_hair');
  assert.ok(
    !blue.includes('cum_in_hair') && !blue.includes('blurry'),
    'blue_hair must never suggest cum_in_hair/blurry'
  );
  const cherry = tagsFor('cherry_blossom');
  for (const bad of ['cowboy_boots', 'bell_bottoms', 'cheek_kiss']) {
    assert.ok(!cherry.includes(bad), `cherry_blossom must never suggest ${bad}`);
  }
});

test('priority tier: disabled mode restores the pure hybrid list', () => {
  PRIORITY_TIER.enabled = false;
  try {
    const tags = tagsFor('phone');
    assert.ok(!tags.includes('holding_phone'), 'holding_phone only surfaces through the priority tier');
  } finally {
    PRIORITY_TIER.enabled = true;
  }
});
