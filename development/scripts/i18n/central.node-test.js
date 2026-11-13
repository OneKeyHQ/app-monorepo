const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const zlib = require('node:zlib');

const {
  LOCALE_ROOT,
  fromPullRequest,
  githubApi,
  resolveToken,
  fromRelease,
  writeLocaleFiles,
} = require('./central');
const {
  CentralClient,
  blobSha,
  toStableJson,
  translationId,
  translationRecords,
} = require('./workflow-client-central');

const REPO = '/repos/OneKeyHQ/onekey-i18n';

// Stored (uncompressed) ZIP, enough for tests; the reader also handles deflate.
function createZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const nameBytes = Buffer.from(name);
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

// Routes: "GET /path" -> value or () => value; "POST /path" -> (body) => value;
// "DOWNLOAD url" -> Buffer.
function fakeApi(routes) {
  const calls = [];
  const lookup = (key) => {
    if (!(key in routes)) {
      const error = new Error(`unexpected ${key}`);
      error.status = 404;
      throw error;
    }
    return routes[key];
  };
  return {
    calls,
    async get(endpoint) {
      calls.push(['GET', endpoint]);
      const value = lookup(`GET ${endpoint}`);
      return typeof value === 'function' ? value() : value;
    },
    async request(method, endpoint, body) {
      if (method === 'GET') return this.get(endpoint);
      calls.push([method, endpoint, body]);
      return lookup(`${method} ${endpoint}`)(body);
    },
    async download(url) {
      calls.push(['DOWNLOAD', url]);
      return lookup(`DOWNLOAD ${url}`);
    },
  };
}

function sourceFixture() {
  return {
    tag: 'app-latest',
    version: '2026.11.12.1',
    commit: 'c1',
    files: {
      'project.json': toStableJson({
        keyCount: 4,
        name: 'Monorepo v5',
        slug: 'app',
        source: { baseLanguage: 'en_US' },
        languages: [
          { iso: 'en_US', name: 'English' },
          { iso: 'zh_CN', name: 'Chinese Simplified' },
        ],
      }),
      'keys.json': toStableJson({
        'global::cancel': { id: 1, platforms: ['web'] },
        'global::ok': { id: 5, platforms: ['web'] },
        'dup@@2': { id: 2, name: 'dup' },
        'dup@@3': { id: 3, name: 'dup' },
        'old::title': { id: 4, archived: true },
      }),
      'locales/en_US.json': toStableJson({
        'global::cancel': 'Cancel',
        'global::ok': 'OK',
      }),
      'locales/zh_CN.json': toStableJson({}),
      'review.json': toStableJson({
        zh_CN: { reviewed: ['global::ok'], unverified: [] },
      }),
    },
  };
}

function commitRoutes({ main = 'c1', listing, base = 'main' } = {}) {
  const blobs = [];
  const bodies = {};
  return {
    blobs,
    bodies,
    routes: {
      [`GET ${REPO}/git/ref/heads/${base}`]: { object: { sha: main } },
      [`GET ${REPO}/git/commits/${main}`]: { tree: { sha: 't1' } },
      ...(listing
        ? {
            [`GET ${REPO}/contents/projects/app?ref=${main}`]: listing.root,
            [`GET ${REPO}/contents/projects/app/locales?ref=${main}`]:
              listing.locales,
          }
        : {}),
      [`POST ${REPO}/git/blobs`]: (body) => {
        blobs.push(body.content);
        return { sha: `b${blobs.length}` };
      },
      [`POST ${REPO}/git/trees`]: (body) => {
        bodies.tree = body;
        return { sha: 't2' };
      },
      [`POST ${REPO}/git/commits`]: (body) => {
        bodies.commit = body;
        return { sha: 'c2abcdef0123' };
      },
      [`POST ${REPO}/git/refs`]: (body) => {
        bodies.ref = body;
        return {};
      },
      [`POST ${REPO}/pulls`]: (body) => {
        bodies.pull = body;
        return {
          number: 9,
          html_url: 'https://github.com/OneKeyHQ/onekey-i18n/pull/9',
        };
      },
    },
  };
}

test('reads release source data through the interface the workflow expects', async () => {
  const client = new CentralClient({
    api: fakeApi({}),
    source: sourceFixture(),
  });
  const project = await client.project();
  assert.equal(project.name, 'Monorepo v5');
  assert.deepEqual(
    project.languages.map((item) => item.lang_iso),
    ['en_US', 'zh_CN'],
  );

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

test('edits commit canonical files to a new onekey-i18n branch and open a PR', async () => {
  const { routes, blobs, bodies } = commitRoutes();
  const api = fakeApi(routes);
  const client = new CentralClient({ api, source: sourceFixture() });
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
  await client.remove('global::ok');

  const proposal = await client.finalize({
    title: 'feat: app copy from feat/x',
    body: 'b',
    branchHint: 'app-feat-x',
  });
  assert.equal(proposal.number, 9);
  assert.equal(proposal.branch, 'i18n/app-feat-x-c2abcde');
  assert.deepEqual(proposal.files, [
    'keys.json',
    'locales/en_US.json',
    'locales/zh_CN.json',
    'project.json',
    'review.json',
  ]);
  assert.equal(bodies.tree.base_tree, 't1');
  assert.deepEqual(
    bodies.tree.tree.map((item) => item.path),
    proposal.files.map((file) => `projects/app/${file}`),
  );
  assert.deepEqual(bodies.commit.parents, ['c1']);
  assert.deepEqual(bodies.ref, {
    ref: 'refs/heads/i18n/app-feat-x-c2abcde',
    sha: 'c2abcdef0123',
  });
  assert.equal(bodies.pull.base, 'main');

  const written = Object.fromEntries(
    proposal.files.map((file, index) => [file, blobs[index]]),
  );
  for (const text of Object.values(written))
    assert.equal(text, toStableJson(JSON.parse(text)));
  const keys = JSON.parse(written['keys.json']);
  assert.deepEqual(keys.travel_mode__title.platforms, ['web']);
  assert.equal(keys['global::ok'], undefined);
  assert.deepEqual(JSON.parse(written['locales/zh_CN.json']), {
    'global::cancel': '取消',
    travel_mode__title: '旅行模式',
  });
  assert.deepEqual(JSON.parse(written['review.json']).zh_CN.reviewed, []);
  assert.equal(JSON.parse(written['project.json']).keyCount, 4);
  assert.equal(await client.finalize({ title: 't' }), null);
});

test('finalize refuses to overwrite files main changed after the release', async () => {
  const source = sourceFixture();
  const entry = (file, sha) => ({ path: `projects/app/${file}`, sha });
  const listing = (zhSha) => ({
    root: ['project.json', 'keys.json', 'review.json'].map((file) =>
      entry(file, blobSha(source.files[file])),
    ),
    locales: [
      entry('locales/en_US.json', blobSha(source.files['locales/en_US.json'])),
      entry('locales/zh_CN.json', zhSha),
    ],
  });

  const moved = new CentralClient({
    api: fakeApi(
      commitRoutes({ main: 'c9', listing: listing('deadbeef') }).routes,
    ),
    source: sourceFixture(),
  });
  await moved.updateTranslation(
    translationId('global::cancel', 'zh_CN'),
    '取消',
  );
  await assert.rejects(
    moved.finalize({ title: 't' }),
    /main changed locales\/zh_CN\.json after app-latest 2026\.11\.12\.1/,
  );

  const untouched = commitRoutes({
    main: 'c9',
    listing: listing(blobSha(source.files['locales/zh_CN.json'])),
  });
  const client = new CentralClient({
    api: fakeApi(untouched.routes),
    source: sourceFixture(),
  });
  await client.updateTranslation(
    translationId('global::cancel', 'zh_CN'),
    '取消',
  );
  assert.equal((await client.finalize({ title: 't' })).number, 9);
  assert.deepEqual(untouched.bodies.commit.parents, ['c9']);
});

test('finalize can open the PR against another onekey-i18n branch', async () => {
  const base = 'feat/per-project-releases';
  const { routes, bodies } = commitRoutes({ main: 'c7', base });
  const client = new CentralClient({
    api: fakeApi(routes),
    source: { ...sourceFixture(), commit: 'c7' },
    base,
  });
  await client.updateTranslation(
    translationId('global::cancel', 'zh_CN'),
    '取消',
  );
  await client.finalize({ title: 't' });
  assert.deepEqual(bodies.commit.parents, ['c7']);
  assert.equal(bodies.pull.base, base);
});

test('pulls the release of a channel into the locale directory', async (t) => {
  const exported = {
    'json/en_US.json': '{\n  "global.cancel": "Cancel"\n}',
    'json/zh_CN.json': '{\n  "global.cancel": "取消"\n}',
    'enum/translations.ts':
      "export enum ETranslations {\n  global_cancel = 'global.cancel',\n}\n",
    'localeJsonMap.ts': 'export const LOCALES = {};\n',
  };
  const zip = createZip(exported);
  const release = (tag, sums = `${sha256(zip)}  app.zip\n`) => ({
    [`GET ${REPO}/releases/tags/${tag}`]: {
      assets: ['app.zip', 'SHA256SUMS', 'manifest.json'].map((name) => ({
        name,
        url: `${tag}:${name}`,
      })),
    },
    [`DOWNLOAD ${tag}:app.zip`]: zip,
    [`DOWNLOAD ${tag}:SHA256SUMS`]: Buffer.from(sums),
    [`DOWNLOAD ${tag}:manifest.json`]: Buffer.from(
      JSON.stringify({ version: '2026.11.13.2', commit: 'c1' }),
    ),
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-app-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, LOCALE_ROOT, 'json'), { recursive: true });
  fs.writeFileSync(path.join(root, LOCALE_ROOT, 'json/stale.json'), '{}');

  const latest = await fromRelease({ api: fakeApi(release('app-latest')) });
  assert.deepEqual(
    { tag: latest.tag, version: latest.version, commit: latest.commit },
    { tag: 'app-latest', version: '2026.11.13.2', commit: 'c1' },
  );
  assert.equal(writeLocaleFiles(root, latest), 4);
  assert.equal(
    fs.existsSync(path.join(root, LOCALE_ROOT, 'json/stale.json')),
    false,
  );
  assert.equal(
    fs.readFileSync(path.join(root, LOCALE_ROOT, 'json/zh_CN.json'), 'utf8'),
    exported['json/zh_CN.json'],
  );

  // ONEKEY_I18N_CHANNEL=test reads the release an onekey-i18n branch publishes.
  const previous = process.env.ONEKEY_I18N_CHANNEL;
  t.after(() => {
    if (previous === undefined) delete process.env.ONEKEY_I18N_CHANNEL;
    else process.env.ONEKEY_I18N_CHANNEL = previous;
  });
  process.env.ONEKEY_I18N_CHANNEL = 'test';
  const branchBuild = await fromRelease({
    api: fakeApi(release('app-test')),
  });
  assert.equal(branchBuild.tag, 'app-test');
  delete process.env.ONEKEY_I18N_CHANNEL;

  // A read caught in the middle of a release update is retried once.
  const racing = release('app-latest');
  const stale = createZip({ 'json/en_US.json': '{}' });
  let downloads = 0;
  Object.defineProperty(racing, 'DOWNLOAD app-latest:app.zip', {
    enumerable: true,
    get: () => ((downloads += 1) === 1 ? stale : zip),
  });
  await fromRelease({ api: fakeApi(racing), retryDelayMs: 0 });
  assert.equal(downloads, 2);

  // Files that never match SHA256SUMS are rejected.
  await assert.rejects(
    fromRelease({
      api: fakeApi(release('app-latest', `${'0'.repeat(64)}  app.zip\n`)),
      retryDelayMs: 0,
    }),
    /does not match SHA256SUMS/,
  );
});

test('PR previews wait for CI and come from the i18n-preview artifact', async () => {
  const inner = createZip({ 'json/en_US.json': '{}' });
  const outer = createZip({
    'app/app.zip': inner,
    'app/SHA256SUMS': `${sha256(inner)}  app.zip\n`,
  });
  let polls = 0;
  const routes = {
    [`GET ${REPO}/pulls/12`]: { head: { sha: 'h1' } },
    [`GET ${REPO}/actions/runs?event=pull_request&head_sha=h1`]: () => {
      polls += 1;
      return {
        workflow_runs:
          polls === 1
            ? [{ id: 77, status: 'in_progress' }]
            : [{ id: 77, status: 'completed', conclusion: 'success' }],
      };
    },
    [`GET ${REPO}/actions/runs/77/artifacts`]: {
      artifacts: [
        {
          name: 'i18n-preview',
          expired: false,
          archive_download_url: 'artifact:77',
        },
      ],
    },
    'DOWNLOAD artifact:77': outer,
  };
  await assert.rejects(
    fromPullRequest({ pr: 12, api: fakeApi(routes) }),
    /not ready yet/,
  );
  polls = 0;
  const result = await fromPullRequest({
    pr: 12,
    wait: true,
    intervalMs: 1,
    api: fakeApi(routes),
  });
  assert.deepEqual(
    { source: result.source, pr: result.pr, commit: result.commit },
    { source: 'pr', pr: 12, commit: 'h1' },
  );
  assert.deepEqual(Object.keys(result.files), ['json/en_US.json']);
});

test('locale files are never written outside the locale directory', () => {
  assert.throws(
    () =>
      writeLocaleFiles(os.tmpdir(), {
        source: 'release',
        commit: 'x',
        files: { '../escape.json': '{}' },
      }),
    /Unsafe path/,
  );
});

test('the shared read-only token is never used for writes', async () => {
  const env = { ONEKEY_I18N_TOKEN: 'shared-read', GH_TOKEN: 'own' };
  assert.equal(resolveToken({ env }), 'shared-read');
  assert.equal(resolveToken({ write: true, env }), 'own');

  const seen = [];
  const api = githubApi({
    token: 'shared-read',
    writeToken: 'own',
    fetchImpl: async (url, init) => {
      seen.push(`${init.method} ${init.headers.Authorization}`);
      return new Response('{}', { status: 200 });
    },
  });
  await api.get(`${REPO}/git/ref/heads/main`);
  await api.request('POST', `${REPO}/git/blobs`, { content: 'x' });
  assert.deepEqual(seen, ['GET Bearer shared-read', 'POST Bearer own']);
});

test('a write the token cannot make explains the access it needs', async () => {
  const api = githubApi({
    token: 'r',
    writeToken: 'w',
    fetchImpl: async () => new Response('{}', { status: 404 }),
  });
  await assert.rejects(
    api.request('POST', `${REPO}/pulls`, {}),
    /needs write access to OneKeyHQ\/onekey-i18n/,
  );
});
