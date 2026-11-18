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
  ]);
  assert.deepEqual(selectUnusedForDeletion(report, options), [
    { key: 'old_second' },
    { key: 'old_first' },
  ]);
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

test('a failed pull after delete reports the PR, and rerunning the deletion names the same branch', async (t) => {
  const keysFile = scopeFile(t, JSON.stringify(['old']));
  const args = parseArgs([
    '--delete-central',
    '--yes',
    '--delete-keys-file',
    keysFile,
    '--pull-after-delete',
  ]);
  const finalized = [];
  const run = async (pullAfterDelete, target = {}) => {
    const client = Object.assign(
      fakeClient([{ ref: 'old', name: 'old' }]),
      target,
    );
    client.finalize = async (request) => {
      finalized.push(request);
      return {
        number: 7,
        commit: 'c7',
        url: 'https://github.com/OneKeyHQ/onekey-i18n/pull/7',
      };
    };
    const report = { unused: [{ key: 'old' }] };
    await applyCentralDeleteIfRequested(report, args, {
      createClient: () => client,
      pullAfterDelete,
    });
    return report.centralDelete;
  };

  const pulls = [];
  const failed = await run((number, commit) => {
    pulls.push([number, commit]);
    throw new Error('preview not ready');
  });
  assert.deepEqual(pulls, [[7, 'c7']]);
  assert.equal(failed.pullError, 'preview not ready');
  assert.match(failed.note, /pull\/7/);
  assert.match(failed.note, /yarn i18n:pull --pr 7 --commit c7 --wait/);

  const retried = await run(() => {});
  assert.equal(retried.pulledAfterDelete, true);
  assert.match(finalized[0].key, /^[0-9a-f]{12}$/);
  assert.equal(finalized[1].key, finalized[0].key);

  // The same refs against another branch or channel get a branch of their own.
  await run(() => {}, { base: 'try-tooling' });
  await run(() => {}, { channel: 'test' });
  assert.notEqual(finalized[2].key, finalized[0].key);
  assert.notEqual(finalized[3].key, finalized[0].key);
  assert.notEqual(finalized[3].key, finalized[2].key);
});

test('the Lokalise deletion flag is retired', () => {
  assert.throws(() => parseArgs(['--delete-lokalise']), /retired/);
});
