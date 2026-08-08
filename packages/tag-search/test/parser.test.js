const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTag,
  isUsableTag,
  splitTags,
  parseLoraInput,
  isSectionLabel,
  parseCsvRecords,
  parseCsvLine,
  dedupeKeepOrder
} = require('..');

test('normalizeTag: trims, lowercases, and collapses separators', () => {
  assert.equal(normalizeTag('  Blue Hair  '), 'blue_hair');
  assert.equal(normalizeTag('blue--hair'), 'blue--hair');
  assert.equal(normalizeTag('a__b'), 'a_b');
  assert.equal(normalizeTag('_padded_'), 'padded');
  assert.equal(normalizeTag('1girl'), '1girl');
  assert.equal(normalizeTag('123. foo'), 'foo');
  assert.equal(normalizeTag('---leading'), 'leading');
  assert.equal(normalizeTag(null), '');
  assert.equal(normalizeTag(''), '');
});

test('dedupeKeepOrder: removes duplicates but preserves first-seen order', () => {
  assert.deepEqual(dedupeKeepOrder(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);
  assert.deepEqual(dedupeKeepOrder([]), []);
  assert.deepEqual(dedupeKeepOrder(null), []);
});

test('isUsableTag: accepts valid tags and rejects junk', () => {
  assert.equal(isUsableTag('blue_hair'), true);
  assert.equal(isUsableTag('1girl'), true);
  assert.equal(isUsableTag('2boys'), true);
  assert.equal(isUsableTag('123girl'), true);
  assert.equal(isUsableTag('ab'), false);
  assert.equal(isUsableTag('bad tag!'), false);
  assert.equal(isUsableTag('yes'), false);
  assert.equal(isUsableTag(''), false);
  assert.equal(isUsableTag(null), false);
});

test('isUsableTag: respects an injected junk-token set', () => {
  const junk = new Set(['global_positive', 'car', 'x']);
  assert.equal(isUsableTag('global_positive', junk), false);
  assert.equal(isUsableTag('car', junk), false);
  assert.equal(isUsableTag('x', junk), false);
  assert.equal(isUsableTag('blue_hair', junk), true);
  assert.equal(isUsableTag('sitting', junk), true);
});

test('splitTags: splits, normalizes, strips lorae and bare numbers, dedupes', () => {
  assert.deepEqual(splitTags('blue hair, red_hair\nblonde_hair'), ['blue_hair', 'red_hair', 'blonde_hair']);
  assert.deepEqual(splitTags('<lora:x:1.0>, lora:y:0.5, 42, real_tag'), ['real_tag']);
  assert.deepEqual(splitTags('blue_hair, blue_hair, red_hair'), ['blue_hair', 'red_hair']);
  assert.deepEqual(splitTags(''), []);
});

test('parseLoraInput: only keeps well-formed lora tokens', () => {
  assert.deepEqual(parseLoraInput('<lora:a:1.0>, <lora:b:0.5>'), ['<lora:a:1.0>', '<lora:b:0.5>']);
  assert.deepEqual(parseLoraInput('<lora:a:1.0>\n<lora:b:0.5>'), ['<lora:a:1.0>', '<lora:b:0.5>']);
  assert.deepEqual(parseLoraInput('not-a-lora, <malformed'), []);
  assert.deepEqual(parseLoraInput(''), []);
});

test('isSectionLabel: detects pipeline section labels', () => {
  assert.equal(isSectionLabel('global_positive'), true);
  assert.equal(isSectionLabel('pose_and_camera'), true);
  assert.equal(isSectionLabel('sitting'), false);
});

test('parseCsvLine: splits plain fields', () => {
  assert.deepEqual(parseCsvLine('tag,general,123'), ['tag', 'general', '123']);
});

test('parseCsvLine: handles quoted fields with commas and escaped quotes', () => {
  assert.deepEqual(parseCsvLine('tag,"a, b",5'), ['tag', 'a, b', '5']);
  assert.deepEqual(parseCsvLine('"x""y",z'), ['x"y', 'z']);
});

test('parseCsvRecords: builds records with aliases and skips junk lines', () => {
  const text = [
    'tag1,general,100,"alias1,alias2"',
    'tag2,character,50',
    '',
    'bad_row',
    'tag3,general,10,"quoted alias"'
  ].join('\n');

  const records = parseCsvRecords(text);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0], { tag: 'tag1', category: 'general', posts: '100', aliases: ['alias1', 'alias2'] });
  assert.deepEqual(records[1], { tag: 'tag2', category: 'character', posts: '50', aliases: [] });
  assert.deepEqual(records[2], { tag: 'tag3', category: 'general', posts: '10', aliases: ['quoted alias'] });
});

test('parseCsvRecords: returns empty array for empty input', () => {
  assert.deepEqual(parseCsvRecords(''), []);
});
