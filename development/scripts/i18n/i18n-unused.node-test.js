const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  parseArgs,
  selectUnusedForDeletion,
  buildCentralDeletePlan,
  applyCentralDeleteIfRequested,
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
    '--delete-central',
    '--delete-keys-file',
    scopeFile(t, JSON.stringify(['old_second', 'old_first'])),
    '--project-name=Monorepo v5',
  ]);
  assert.deepEqual(selectUnusedForDeletion(report, options), [
    { key: 'old_second' },
    { key: 'old_first' },
  ]);
  assert.equal(options.projectName, 'Monorepo v5');
  assert.equal(options.deleteConfirm, false);
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
    ['--delete-central', '--delete-keys-file=keys.json', '--delete-limit=1'],
    ['--delete-central', '--project-name='],
    ['--yes'],
  ]) {
    assert.throws(() => parseArgs(args));
  }
});

// Same lookup rules as CentralClient.findKey: exact name or its "::" form.
function fakeClient(keys) {
  return {
    dir: '/tmp/onekey-i18n',
    removed: [],
    async project(name) {
      return { id: 'OneKeyHQ/onekey-i18n/app', name };
    },
    async findKey(key) {
      const matches = keys.filter((item) =>
        [key, key.replaceAll('.', '::')].includes(item.name),
      );
      if (matches.length > 1)
        throw new Error(`Ambiguous key variants for ${key}`);
      return matches[0] ? { key_id: matches[0].ref } : null;
    },
    async remove(ref) {
      this.removed.push(ref);
    },
    async finalize() {
      return {
        number: 7,
        url: 'https://github.com/OneKeyHQ/onekey-i18n/pull/7',
      };
    },
  };
}

test('the delete plan resolves refs and separates missing and ambiguous keys', async () => {
  const plan = await buildCentralDeletePlan({
    client: fakeClient([
      { ref: 'global::old', name: 'global::old' },
      { ref: 'dup@@1', name: 'dup' },
      { ref: 'dup@@2', name: 'dup' },
    ]),
    unused: [{ key: 'global.old' }, { key: 'dup' }, { key: 'missing' }],
  });
  assert.deepEqual(plan.toDelete, [{ key: 'global.old', ref: 'global::old' }]);
  assert.deepEqual(plan.missing, [{ key: 'missing' }]);
  assert.equal(plan.ambiguous.length, 1);
});

test('deletion is a dry run until --yes and stops on ambiguous keys', async (t) => {
  const keysFile = scopeFile(t, JSON.stringify(['old']));
  const client = fakeClient([{ ref: 'old', name: 'old' }]);
  const report = { unused: [{ key: 'old' }] };
  await applyCentralDeleteIfRequested(
    report,
    parseArgs(['--delete-central', '--delete-keys-file', keysFile]),
    { createClient: () => client },
  );
  assert.equal(report.centralDelete.dryRun, true);
  assert.deepEqual(client.removed, []);

  await applyCentralDeleteIfRequested(
    report,
    parseArgs(['--delete-central', '--yes', '--delete-keys-file', keysFile]),
    { createClient: () => client },
  );
  assert.deepEqual(client.removed, ['old']);
  assert.equal(report.centralDelete.deleted, 1);

  const ambiguous = fakeClient([
    { ref: 'old@@1', name: 'old' },
    { ref: 'old@@2', name: 'old' },
  ]);
  await assert.rejects(
    applyCentralDeleteIfRequested(
      { unused: [{ key: 'old' }] },
      parseArgs(['--delete-central', '--yes', '--delete-keys-file', keysFile]),
      { createClient: () => ambiguous },
    ),
    /Missing or ambiguous/,
  );
  assert.deepEqual(ambiguous.removed, []);
});

test('the Lokalise deletion flag is retired', () => {
  assert.throws(() => parseArgs(['--delete-lokalise']), /retired/);
});
