import test from 'node:test';
import assert from 'node:assert/strict';
import { readPreference } from './useLocalPreference.js';

const storage = entries => ({ getItem: key => Object.hasOwn(entries,key) ? entries[key] : null });

test('preferences return defaults when storage is missing or invalid', () => {
  assert.equal(readPreference(storage({}), 'sidebar:a', false), false);
  assert.equal(readPreference(storage({'chronos:sidebar:a':'invalid'}), 'sidebar:a', false), false);
  assert.deepEqual(readPreference(storage({'chronos:filters:a':'null'}), 'filters:a', {types:[],categories:[]}), {types:[],categories:[]});
});
test('preferences retain stored values of the correct type', () => {
  assert.equal(readPreference(storage({'chronos:sidebar:a':'true'}), 'sidebar:a', false), true);
  assert.deepEqual(readPreference(storage({'chronos:filters:a':'{"types":["task"],"categories":["work"]}'}), 'filters:a', {types:[],categories:[]}), {types:['task'],categories:['work']});
});
test('malformed saved arrays and objects cannot break page rendering', () => {
  assert.deepEqual(readPreference(storage({'chronos:hidden:a':'{"id":"x"}'}), 'hidden:a', []), []);
  assert.deepEqual(readPreference(storage({'chronos:hidden:a':'[null,42]'}), 'hidden:a', []), []);
  assert.deepEqual(readPreference(storage({'chronos:filters:a':'{"types":[],"categories":null}'}), 'filters:a', {types:[],categories:[]}), {types:[],categories:[]});
});
test('preferences are isolated by account and tolerate blocked storage', () => {
  assert.equal(readPreference(storage({'chronos:notes:a':'"private"'}), 'notes:b', ''), '');
  assert.equal(readPreference({getItem(){throw Error('blocked');}}, 'sidebar:a', false), false);
  assert.equal(readPreference(storage({'chronos:notes:a':'"private"'}), null, ''), '');
});
