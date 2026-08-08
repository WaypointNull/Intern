const test = require('node:test');
const assert = require('node:assert/strict');

const { createTagListRepository, createRetrievalIndex, createTagSuggester } = require('..');

const repository = createTagListRepository();
const retrieval = createRetrievalIndex({ repository });
const suggester = createTagSuggester({ repository, retrieval });

test.before(async () => {
  await suggester.ensureReady();
});

function candidatesFor(tag, limit = 12) {
  return suggester.getCandidates(tag, { limit });
}

function tagsFor(tag, limit = 12) {
  return candidatesFor(tag, limit).map((c) => c.tag);
}

// Regression guard for the "light version" matcher's worst failures: these four tags produced only
// garbage suggestions (dickgirl, logo, bolero, cum_in_hair, blurry, cowboy_boots, ...). The full
// Akumu matcher + NSFW pruning must never surface those.

test('match quality: 1girl never suggests dickgirl and has real alternatives', () => {
  assert.equal(repository.resolveTag('1girl').status, 'exact');
  const tags = tagsFor('1girl');
  assert.ok(tags.length > 0, '1girl should have suggestions');
  assert.ok(!tags.includes('dickgirl'), 'dickgirl must never be suggested for 1girl');
});

test('match quality: solo never suggests logo or bolero', () => {
  assert.equal(repository.resolveTag('solo').status, 'exact');
  const tags = tagsFor('solo');
  assert.ok(tags.length > 0, 'solo should have suggestions');
  assert.ok(!tags.includes('logo'), 'logo must never be suggested for solo');
  assert.ok(!tags.includes('bolero'), 'bolero must never be suggested for solo');
  assert.ok(
    tags.some((t) => t === 'solo' || t.startsWith('solo') || t.includes('solo')),
    'solo suggestions should stay solo-flavored'
  );
});

test('match quality: blue_hair never suggests cum_in_hair or blurry', () => {
  assert.equal(repository.resolveTag('blue_hair').status, 'exact');
  const tags = tagsFor('blue_hair');
  assert.ok(tags.length > 0, 'blue_hair should have suggestions');
  assert.ok(!tags.includes('cum_in_hair'), 'cum_in_hair must never be suggested for blue_hair');
  assert.ok(!tags.includes('blurry'), 'blurry must never be suggested for blue_hair');
  assert.ok(
    tags.some((t) => t.includes('hair')),
    'blue_hair suggestions should be hair-flavored'
  );
});

test('match quality: cherry_blossom never suggests cowboy_boots, bell_bottoms or cheek_kiss', () => {
  assert.equal(repository.resolveTag('cherry_blossom').status, 'exact');
  const tags = tagsFor('cherry_blossom');
  assert.ok(tags.length > 0, 'cherry_blossom should have suggestions');
  assert.ok(!tags.includes('cowboy_boots'), 'cowboy_boots must never be suggested for cherry_blossom');
  assert.ok(!tags.includes('bell_bottoms'), 'bell_bottoms must never be suggested for cherry_blossom');
  assert.ok(!tags.includes('cheek_kiss'), 'cheek_kiss must never be suggested for cherry_blossom');
  assert.ok(
    tags.some((t) => t.includes('cherry') || t.includes('blossom') || t.includes('sakura')),
    'cherry_blossom suggestions should stay blossom-flavored'
  );
});

test('match quality: candidates are unique, scored, and carry metadata', () => {
  const candidates = candidatesFor('1girl');
  const tags = candidates.map((c) => c.tag);
  assert.equal(new Set(tags).size, tags.length, 'candidates must be unique');
  for (const c of candidates) {
    assert.ok(typeof c.score === 'number' && c.score >= 0, 'score must be a non-negative number');
    assert.ok(Number.isInteger(c.category), 'category must be a number');
    assert.ok(Number.isInteger(c.postCount) && c.postCount >= 0, 'postCount must be a non-negative integer');
  }
  assert.ok(
    candidates.every((c) => c.tag !== '1girl'),
    'exact match itself must be excluded'
  );
});

test('match quality: compound tags surface their parts (school_uniform -> uniform/school candidates)', () => {
  const tags = tagsFor('school_uniform', 12);
  assert.ok(tags.length > 0, 'school_uniform should have suggestions');
  assert.ok(
    tags.some((t) => t.includes('school') || t.includes('uniform')),
    'school_uniform suggestions should relate to its parts'
  );
});
