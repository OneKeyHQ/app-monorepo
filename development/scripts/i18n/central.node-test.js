const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { LOCALE_ROOT, LOCK_PATH, writeLocaleFiles } = require('./central');
const { run: pull } = require('./i18n-pull');
const {
  CentralClient,
  translationId,
  translationRecords,
} = require('./workflow-client-central');
const { ROOT, generatedHashes } = require('./workflow-data');

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeFile(dir, relative, content) {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// A minimal onekey-i18n checkout: canonical app data, a CLI placeholder (tests
// inject run) and an export script that writes `exported` to --out.
function centralFixture(t, { branch = 'i18n/test', exported = {} } = {}) {
  const dir = tempDir(t, 'onekey-i18n-central-');
  writeFile(
    dir,
    'projects/app/project.json',
    json({
      name: 'Monorepo v5',
      slug: 'app',
      source: { baseLanguage: 'en_US' },
      languages: [
        { iso: 'en_US', name: 'English' },
        { iso: 'zh_CN', name: 'Chinese Simplified' },
      ],
    }),
  );
  writeFile(
    dir,
    'projects/app/keys.json',
    json({
      'global::cancel': { id: 1, platforms: ['web'] },
      'dup@@2': { id: 2, name: 'dup' },
      'dup@@3': { id: 3, name: 'dup' },
      'old::title': { id: 4, archived: true },
    }),
  );
  writeFile(
    dir,
    'projects/app/locales/en_US.json',
    json({ 'global::cancel': 'Cancel' }),
  );
  writeFile(dir, 'projects/app/locales/zh_CN.json', json({}));
  writeFile(dir, 'tools/i18n.mjs', '// Tests inject run().\n');
  writeFile(
    dir,
    'tools/export.mjs',
    [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      "const out = process.argv[process.argv.indexOf('--out') + 1];",
      `for (const [relative, content] of Object.entries(${JSON.stringify(exported)})) {`,
      '  fs.mkdirSync(path.dirname(path.join(out, relative)), { recursive: true });',
      '  fs.writeFileSync(path.join(out, relative), content);',
      '}',
      '',
    ].join('\n'),
  );
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git(['init', '-b', branch]);
  git(['add', '.']);
  git([
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'test: fixture',
  ]);
  return dir;
}

function recordingClient(dir) {
  const calls = [];
  const client = new CentralClient({
    dir,
    run: (args) => {
      const valuesIndex = args.indexOf('--values');
      calls.push({
        args: args.slice(0, 3),
        values:
          valuesIndex === -1
            ? undefined
            : JSON.parse(fs.readFileSync(args[valuesIndex + 1], 'utf8')),
      });
      return '';
    },
  });
  return { client, calls };
}

test('reads the checkout through the interface the workflow expects', async (t) => {
  const { client } = recordingClient(centralFixture(t));
  const project = await client.project('Monorepo v5');
  assert.equal(project.id, 'OneKeyHQ/onekey-i18n/app');
  assert.deepEqual(
    project.languages.map((item) => item.lang_iso),
    ['en_US', 'zh_CN'],
  );
  await assert.rejects(client.project('Other'), /differs/);

  const key = await client.findKey('global.cancel');
  assert.equal(key.key_id, 'global::cancel');
  assert.deepEqual(
    translationRecords(key, { en_US: 'en_US', zh_CN: 'zh_CN' }),
    {
      en_US: { id: translationId('global::cancel', 'en_US'), value: 'Cancel' },
      zh_CN: { id: translationId('global::cancel', 'zh_CN'), value: '' },
    },
  );
  await assert.rejects(client.findKey('dup'), /Ambiguous/);
  assert.equal(await client.findKey('old.title'), null);
  assert.equal(await client.findKey('missing__title'), null);

  const id = encodeURIComponent(translationId('global::cancel', 'en_US'));
  const { data } = await client.request('GET', `/translations/${id}`);
  assert.equal(data.translation.translation, 'Cancel');
  await assert.rejects(client.request('DELETE', '/keys'), /Unsupported/);
});

test('writes go through the onekey-i18n CLI and never onto main', async (t) => {
  const { client, calls } = recordingClient(centralFixture(t));
  await client.create(
    {
      key: 'travel_mode__title',
      translations: { en_US: 'Travel Mode', zh_CN: '旅行模式' },
    },
    { en_US: 'en_US', zh_CN: 'zh_CN' },
  );
  await client.updateTranslation(
    translationId('global::cancel', 'zh_CN'),
    '取消',
  );
  client.remove('global::cancel');
  assert.deepEqual(calls, [
    {
      args: ['set', 'app', 'travel_mode__title'],
      values: { en_US: 'Travel Mode', zh_CN: '旅行模式' },
    },
    { args: ['set', 'app', 'global::cancel'], values: { zh_CN: '取消' } },
    { args: ['remove', 'app', 'global::cancel'], values: undefined },
  ]);

  const onMain = recordingClient(centralFixture(t, { branch: 'main' }));
  await assert.rejects(
    onMain.client.create(
      { key: 'a__title', translations: { en_US: 'A' } },
      { en_US: 'en_US' },
    ),
    /Switch .* to a branch/,
  );
  assert.equal(onMain.calls.length, 0);
});

test('pull --from writes an isolated tree, pins a local lock and verify guards it', (t) => {
  const exported = {
    'json/en_US.json': json({ 'global.cancel': 'Cancel' }),
    'json/zh_CN.json': json({ 'global.cancel': '取消' }),
    'enum/translations.ts':
      "export enum ETranslations {\n  global_cancel = 'global.cancel',\n}\n",
    'localeJsonMap.ts': 'export const LOCALES = {};\n',
  };
  const central = centralFixture(t, { exported });
  const root = tempDir(t, 'onekey-app-');
  writeFile(root, `${LOCALE_ROOT}/json/stale.json`, '{}\n');
  const workspaceBefore = generatedHashes(ROOT);

  assert.match(
    pull(['--from', central, '--output-root', root]),
    /Pulled 4 files from local checkout/,
  );
  assert.equal(
    fs.existsSync(path.join(root, LOCALE_ROOT, 'json/stale.json')),
    false,
  );
  assert.equal(
    fs.readFileSync(path.join(root, LOCALE_ROOT, 'json/zh_CN.json'), 'utf8'),
    exported['json/zh_CN.json'],
  );
  const lock = JSON.parse(fs.readFileSync(path.join(root, LOCK_PATH), 'utf8'));
  assert.equal(lock.source, 'local');
  assert.equal(lock.dirty, false);
  assert.deepEqual(lock.files, Object.keys(exported).toSorted());
  assert.deepEqual(generatedHashes(ROOT), workspaceBefore);

  assert.throws(
    () => pull(['--verify', '--output-root', root]),
    /local onekey-i18n checkout/,
  );
  assert.match(
    pull(['--verify', '--allow-local', '--output-root', root]),
    /match local/,
  );
  writeFile(
    root,
    `${LOCALE_ROOT}/json/zh_CN.json`,
    json({ 'global.cancel': 'edited' }),
  );
  assert.throws(
    () => pull(['--verify', '--allow-local', '--output-root', root]),
    /differ from/,
  );
  writeFile(
    root,
    `${LOCALE_ROOT}/json/zh_CN.json`,
    exported['json/zh_CN.json'],
  );
  writeFile(root, `${LOCALE_ROOT}/json/extra.json`, '{}\n');
  assert.throws(
    () => pull(['--verify', '--allow-local', '--output-root', root]),
    /missing from/,
  );
});

test('pull rejects plans for another source and unsafe bundle paths', (t) => {
  assert.throws(
    () =>
      pull([
        '--expected-project-id',
        '442401716557769b6e4ef8.80991305',
        '--verify',
      ]),
    /serves OneKeyHQ\/onekey-i18n\/app/,
  );
  const root = tempDir(t, 'onekey-app-');
  assert.throws(
    () =>
      writeLocaleFiles(root, {
        source: 'local',
        commit: 'x',
        dirty: false,
        files: { '../escape.json': '{}' },
      }),
    /Unsafe path/,
  );
});
