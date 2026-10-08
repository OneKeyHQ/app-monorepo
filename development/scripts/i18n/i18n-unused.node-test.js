const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  parseArgs,
  selectUnusedForDeletion,
  buildLokaliseKeyIndex,
  buildLokaliseDeletePlan,
} = require('./i18n-unused');

function scopeFile(t, content) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-unused-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'keys.json');
  fs.writeFileSync(file, content);
  return file;
}

test('deletion selects only the exact allowlist in its requested order', (t) => {
  const report = {
    unused: ['other_unused', 'old_first', 'old_second'].map((key) => ({ key })),
  };
  const options = parseArgs([
    '--delete-lokalise',
    '--delete-keys-file',
    scopeFile(t, JSON.stringify(['old_second', 'old_first'])),
    '--project-name=Monorepo v5',
  ]);
  assert.deepEqual(selectUnusedForDeletion(report, options), [
    { key: 'old_second' },
    { key: 'old_first' },
  ]);
  assert.equal(options.projectName, 'Monorepo v5');
  assert.equal(options.deleteLokaliseConfirm, false);
});

test('invalid allowlists never fall back to deleting every unused key', (t) => {
  for (const content of [
    '[]',
    '{}',
    '["old", "old"]',
    '[null]',
    '["old*"]',
    '[""]',
    '[" old"]',
    'not json',
  ]) {
    assert.throws(() =>
      selectUnusedForDeletion(
        { unused: [{ key: 'old' }] },
        {
          deleteKeysFile: scopeFile(t, content),
          deleteLimit: 0,
        },
      ),
    );
  }
});

test('a used, reserved or unknown requested key blocks the whole selection', (t) => {
  for (const key of ['used', 'reserved', 'unknown']) {
    assert.throws(
      () =>
        selectUnusedForDeletion(
          { unused: [{ key: 'old' }] },
          {
            deleteKeysFile: scopeFile(t, JSON.stringify(['old', key])),
            deleteLimit: 0,
          },
        ),
      /used, reserved or absent/,
    );
  }
});

test('scope flags reject empty paths, unrelated usage and ambiguous limits', () => {
  for (const args of [
    ['--delete-keys-file='],
    ['--delete-keys-file=keys.json'],
    ['--delete-lokalise', '--delete-keys-file=keys.json', '--delete-limit=1'],
    ['--delete-lokalise', '--project-name='],
  ]) {
    assert.throws(() => parseArgs(args));
  }
});

function plan(keys, requested = ['old']) {
  return buildLokaliseDeletePlan({
    keyIndex: buildLokaliseKeyIndex(keys),
    unused: requested.map((key) => ({ key })),
    strictNames: true,
  });
}

test('remote matching excludes unrequested keys even when returned by the API', () => {
  const result = plan([
    { key_id: 1, key_name: { web: 'old', ios: 'old' } },
    { key_id: 2, key_name: { web: 'old_extra' } },
  ]);
  assert.deepEqual(
    result.toDelete.map((item) => item.lokaliseKeyId),
    ['1'],
  );
  assert.equal(result.ambiguous.length, 0);
});

test('deleting a shared remote key cannot delete an unrequested platform name', () => {
  const result = plan([
    { key_id: 1, key_name: { web: 'old', ios: 'still_used' } },
  ]);
  assert.equal(result.toDelete.length, 0);
  assert.equal(result.ambiguous.length, 1);
});

test('duplicate remote matches and missing keys are rejected by the plan', () => {
  const result = plan(
    [
      { key_id: 1, key_name: 'old' },
      { key_id: 2, key_name: 'old' },
    ],
    ['old', 'missing'],
  );
  assert.equal(result.toDelete.length, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.deepEqual(result.missing, [{ key: 'missing' }]);
});

test('legacy dotted names can resolve to their remote namespace form', () => {
  const result = plan(
    [{ key_id: 1, key_name: { web: 'global::old' } }],
    ['global.old'],
  );
  assert.equal(result.toDelete.length, 1);
  assert.equal(result.ambiguous.length, 0);
});
