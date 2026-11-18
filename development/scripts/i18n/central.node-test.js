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
  loadLocalSettings,
  localeDestination,
  sourceFromRelease,
  writeLocaleFiles,
} = require('./central');
const { run: pull } = require('./i18n-pull');
const { buildCentralDeletePlan } = require('./i18n-unused');
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
  // Archived keys are not found, but preview can still see that the name is
  // taken; i18n:unused lists them as missing instead of blocking deletion.
  assert.equal(await client.findKey('old.title'), null);
  assert.deepEqual(await client.archivedRefs('old.title'), ['old::title']);
  assert.deepEqual(await client.archivedRefs('global.cancel'), []);
  const deletion = await buildCentralDeletePlan({
    client,
    unused: [{ key: 'old.title' }, { key: 'global.cancel' }],
  });
  assert.deepEqual(
    [deletion.toDelete, deletion.missing, deletion.ambiguous],
    [
      [{ key: 'global.cancel', ref: 'global::cancel' }],
      [{ key: 'old.title' }],
      [],
    ],
  );
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
  // onekey-i18n stores no key count, so adding and removing keys leaves
  // project.json alone, and two copy PRs don't conflict there.
  assert.deepEqual(proposal.files, [
    'keys.json',
    'locales/en_US.json',
    'locales/zh_CN.json',
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
  assert.deepEqual(keys.travel_mode__title, { platforms: ['web'] });
  assert.equal(keys['global::ok'], undefined);
  assert.deepEqual(JSON.parse(written['locales/zh_CN.json']), {
    'global::cancel': '取消',
    travel_mode__title: '旅行模式',
  });
  assert.deepEqual(JSON.parse(written['review.json']).zh_CN.reviewed, []);
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

test('finalize with a key reuses the PR an earlier run of the plan opened', async () => {
  const branch = 'i18n/app-feat-x-0123456789ab';
  const lookup = `GET ${REPO}/pulls?state=open&head=${encodeURIComponent(
    `OneKeyHQ:${branch}`,
  )}`;
  const proposal = {
    title: 't',
    branchHint: 'app-feat-x',
    key: '0123456789ab',
  };
  const edit = (client) =>
    client.updateTranslation(translationId('global::cancel', 'zh_CN'), '取消');
  // The git blob id of the edited file, as the branch would hold it.
  const zhFile = 'projects/app/locales/zh_CN.json';
  const probe = new CentralClient({
    api: fakeApi({}),
    source: sourceFixture(),
  });
  await edit(probe);
  const zhSha = blobSha(probe.fileText('locales/zh_CN.json'));
  const comparison = (overrides) => ({
    behind_by: 3,
    commits: [{ sha: 'c5' }],
    ahead_by: 1,
    files: [{ filename: zhFile, sha: zhSha }],
    ...overrides,
  });

  // GitHub opened the PR but its answer was lost: the rerun finds that PR and
  // reuses it while its branch still holds exactly this change.
  const openPr = (compared) =>
    fakeApi({
      ...commitRoutes().routes,
      [lookup]: [
        {
          number: 7,
          html_url: 'https://github.com/OneKeyHQ/onekey-i18n/pull/7',
          user: { login: 'originalix' },
          head: { sha: compared.commits.at(-1).sha },
        },
      ],
      [`GET ${REPO}/compare/main...${branch}`]: compared,
    });
  const opened = openPr(comparison({}));
  const rerun = new CentralClient({ api: opened, source: sourceFixture() });
  await edit(rerun);
  assert.deepEqual(await rerun.finalize(proposal), {
    number: 7,
    url: 'https://github.com/OneKeyHQ/onekey-i18n/pull/7',
    author: 'originalix',
    branch,
    commit: 'c5',
    files: ['locales/zh_CN.json'],
  });
  assert.deepEqual(
    opened.calls.filter(([method]) => method !== 'GET'),
    [],
  );

  // Copy pushed to that PR since: the rerun stops instead of adopting it.
  for (const compared of [
    comparison({ ahead_by: 2, commits: [{ sha: 'c5' }, { sha: 'c6' }] }),
    comparison({
      files: [
        { filename: zhFile, sha: zhSha },
        { filename: 'projects/app/keys.json', sha: 'b8' },
      ],
    }),
  ]) {
    const appended = openPr(compared);
    const retry = new CentralClient({ api: appended, source: sourceFixture() });
    await edit(retry);
    await assert.rejects(
      retry.finalize(proposal),
      /PR #7 \(i18n\/app-feat-x-0123456789ab\) no longer holds exactly this plan's change/,
    );
    assert.deepEqual(
      appended.calls.filter(([method]) => method !== 'GET'),
      [],
    );
  }

  // The branch exists without a PR. It is used as is when it is one commit
  // holding exactly this change, even if main has moved on since (behind_by);
  // with anything else on it, it is left alone and apply stops.
  const existingBranch = (compared) => {
    const { routes, bodies } = commitRoutes();
    const api = fakeApi({
      ...routes,
      [lookup]: [],
      [`POST ${REPO}/git/refs`]: () => {
        throw Object.assign(new Error('Reference already exists'), {
          status: 422,
        });
      },
      [`GET ${REPO}/compare/main...${branch}`]: comparison({
        commits: [{ sha: 'c8' }],
        ...compared,
      }),
    });
    return {
      api,
      bodies,
      client: new CentralClient({ api, source: sourceFixture() }),
    };
  };
  const same = existingBranch({});
  await edit(same.client);
  const result = await same.client.finalize(proposal);
  assert.deepEqual(
    [result.number, result.branch, result.commit, same.bodies.pull.head],
    [9, branch, 'c8', branch],
  );
  for (const compared of [
    { ahead_by: 2, commits: [{ sha: 'c8' }, { sha: 'c9' }] },
    { files: [{ filename: zhFile, sha: 'b7' }] },
    {
      files: [
        { filename: zhFile, sha: zhSha },
        { filename: 'projects/app/keys.json', sha: 'b8' },
      ],
    },
  ]) {
    const other = existingBranch(compared);
    await edit(other.client);
    await assert.rejects(
      other.client.finalize(proposal),
      /already exists without an open PR and holds other content/,
    );
    assert.equal(other.bodies.pull, undefined);
    assert.equal(
      other.api.calls.some(([method]) => !['GET', 'POST'].includes(method)),
      false,
    );
  }
});

test('a plan that adds a key can be rerun after its PR failed to open', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: Date.parse('2026-11-17T00:00:00Z'),
  });
  const branch = 'i18n/app-feat-x-0123456789ab';
  const proposal = {
    title: 't',
    branchHint: 'app-feat-x',
    key: '0123456789ab',
  };
  const lookup = `GET ${REPO}/pulls?state=open&head=${encodeURIComponent(
    `OneKeyHQ:${branch}`,
  )}`;
  // Blob ids depend on content, as in git.
  const blobsByContent = {
    [`POST ${REPO}/git/blobs`]: (body) => ({ sha: blobSha(body.content) }),
  };
  const addKey = (client) =>
    client.create(
      {
        key: 'travel_mode__title',
        translations: { en_US: 'Travel Mode', zh_CN: '旅行模式' },
      },
      { en_US: 'en_US', zh_CN: 'zh_CN' },
    );

  // First run: the branch is created, then opening the PR fails.
  const first = commitRoutes();
  const run1 = new CentralClient({
    api: fakeApi({
      ...first.routes,
      ...blobsByContent,
      [lookup]: [],
      [`POST ${REPO}/pulls`]: () => {
        throw Object.assign(new Error('HTTP 502'), { status: 502 });
      },
    }),
    source: sourceFixture(),
  });
  await addKey(run1);
  await assert.rejects(run1.finalize(proposal), /502/);

  // The rerun, a second later, builds the same files and opens the PR from
  // the branch the first run left.
  t.mock.timers.tick(1000);
  const second = commitRoutes();
  const run2 = new CentralClient({
    api: fakeApi({
      ...second.routes,
      ...blobsByContent,
      [lookup]: [],
      [`POST ${REPO}/git/refs`]: () => {
        throw Object.assign(new Error('Reference already exists'), {
          status: 422,
        });
      },
      [`GET ${REPO}/compare/main...${branch}`]: {
        ahead_by: 1,
        behind_by: 0,
        commits: [{ sha: 'c8' }],
        files: first.bodies.tree.tree.map((item) => ({
          filename: item.path,
          sha: item.sha,
        })),
      },
    }),
    source: sourceFixture(),
  });
  await addKey(run2);
  const result = await run2.finalize(proposal);
  assert.deepEqual(
    [result.number, result.commit, second.bodies.pull.head],
    [9, 'c8', branch],
  );
});

test('a client bound to a commit reads that commit instead of the release', async () => {
  const { files } = sourceFixture();
  const project = `${REPO}/contents/projects/app`;
  const entry = (name) => ({
    type: 'file',
    name: name.split('/').pop(),
    path: `projects/app/${name}`,
  });
  const api = fakeApi({
    [`GET ${project}?ref=c2`]: [
      ...['project.json', 'keys.json', 'review.json'].map(entry),
      { type: 'dir', name: 'locales', path: 'projects/app/locales' },
    ],
    [`GET ${project}/locales?ref=c2`]: [
      'locales/en_US.json',
      'locales/zh_CN.json',
    ].map(entry),
    ...Object.fromEntries(
      Object.entries(files).map(([name, text]) => [
        `DOWNLOAD ${project}/${name}?ref=c2`,
        Buffer.from(text),
      ]),
    ),
  });
  const client = new CentralClient({ api, ref: 'c2' });
  const key = await client.findKey('global.cancel');
  assert.equal(key.key_id, 'global::cancel');
  assert.equal(client.source.commit, 'c2');
  assert.equal(
    api.calls.some(([, endpoint]) => endpoint.includes('/releases/')),
    false,
  );
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
  const manifest = {
    version: '2026.11.13.2',
    commit: 'c1',
    assets: [{ name: 'app.zip', sha256: sha256(zip) }],
  };
  const release = (
    tag,
    sums = `${sha256(zip)}  app.zip\n`,
    described = manifest,
  ) => ({
    [`GET ${REPO}/releases/tags/${tag}`]: {
      html_url: `https://github.com/OneKeyHQ/onekey-i18n/releases/tag/${tag}`,
      assets: ['app.zip', 'SHA256SUMS', 'manifest.json'].map((name) => ({
        name,
        url: `${tag}:${name}`,
      })),
    },
    [`DOWNLOAD ${tag}:app.zip`]: zip,
    [`DOWNLOAD ${tag}:SHA256SUMS`]: Buffer.from(sums),
    [`DOWNLOAD ${tag}:manifest.json`]: Buffer.from(JSON.stringify(described)),
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
  assert.equal(
    latest.url,
    'https://github.com/OneKeyHQ/onekey-i18n/releases/tag/app-latest',
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

  // The command says which credentials and which release it used.
  const logs = [];
  await pull(['--output-root', root], {
    api: {
      ...fakeApi(release('app-latest')),
      identity: async () => ({ source: 'gh auth token', login: 'originalix' }),
    },
    log: (line) => logs.push(line),
  });
  assert.deepEqual(logs.slice(0, 2), [
    'GitHub access: gh auth token, GitHub user originalix',
    'Release: https://github.com/OneKeyHQ/onekey-i18n/releases/tag/app-latest (app-latest 2026.11.13.2, commit c1)',
  ]);
  assert.match(logs[2], /^Pulled 4 files into /);

  // Files that never match SHA256SUMS are rejected.
  await assert.rejects(
    fromRelease({
      api: fakeApi(release('app-latest', `${'0'.repeat(64)}  app.zip\n`)),
      retryDelayMs: 0,
    }),
    /does not match SHA256SUMS/,
  );

  // The version and commit it reports must describe the archive it pulled: a
  // manifest read before its update is read once more, and one that never
  // matches (or is malformed) is refused.
  const outdated = {
    version: '2026.11.13.1',
    commit: 'c0',
    assets: [{ name: 'app.zip', sha256: '0'.repeat(64) }],
  };
  const updating = release('app-latest');
  let manifests = 0;
  Object.defineProperty(updating, 'DOWNLOAD app-latest:manifest.json', {
    enumerable: true,
    get: () =>
      Buffer.from(JSON.stringify((manifests += 1) === 1 ? outdated : manifest)),
  });
  const updated = await fromRelease({
    api: fakeApi(updating),
    retryDelayMs: 0,
  });
  assert.deepEqual(
    [manifests, updated.version, updated.commit],
    [2, '2026.11.13.2', 'c1'],
  );
  for (const described of [
    { ...manifest, assets: outdated.assets },
    { ...manifest, assets: {} },
    null,
  ]) {
    await assert.rejects(
      fromRelease({
        api: fakeApi(release('app-latest', undefined, described)),
        retryDelayMs: 0,
      }),
      /app\.zip of app-latest does not match manifest\.json/,
    );
  }
});

test('release source data must match its manifest too', async () => {
  const zip = createZip(sourceFixture().files);
  const routes = (assets) => ({
    [`GET ${REPO}/releases/tags/app-latest`]: {
      html_url:
        'https://github.com/OneKeyHQ/onekey-i18n/releases/tag/app-latest',
      assets: ['app.source.zip', 'SHA256SUMS', 'manifest.json'].map((name) => ({
        name,
        url: `app-latest:${name}`,
      })),
    },
    'DOWNLOAD app-latest:app.source.zip': zip,
    'DOWNLOAD app-latest:SHA256SUMS': Buffer.from(
      `${sha256(zip)}  app.source.zip\n`,
    ),
    'DOWNLOAD app-latest:manifest.json': Buffer.from(
      JSON.stringify({ version: '2026.11.16.1', commit: 'c1', assets }),
    ),
  });
  const source = await sourceFromRelease({
    api: fakeApi(routes([{ name: 'app.source.zip', sha256: sha256(zip) }])),
  });
  assert.deepEqual([source.version, source.commit], ['2026.11.16.1', 'c1']);
  await assert.rejects(
    sourceFromRelease({
      api: fakeApi(routes([{ name: 'app.zip', sha256: sha256(zip) }])),
      retryDelayMs: 0,
    }),
    /app\.source\.zip of app-latest does not match manifest\.json/,
  );
});

test('PR previews wait for CI and come from the i18n-preview artifact', async () => {
  const inner = createZip({ 'json/en_US.json': '{}' });
  const outer = createZip({
    'app/app.zip': inner,
    'app/SHA256SUMS': `${sha256(inner)}  app.zip\n`,
  });
  let polls = 0;
  // Another workflow for the same head succeeds first, without the preview.
  const other = {
    id: 76,
    status: 'completed',
    conclusion: 'success',
    html_url: 'run:76',
  };
  const routes = {
    [`GET ${REPO}/pulls/12`]: { head: { sha: 'h1' } },
    [`GET ${REPO}/actions/runs?event=pull_request&head_sha=h1`]: () => {
      polls += 1;
      return {
        workflow_runs:
          polls === 1
            ? [other, { id: 77, status: 'in_progress' }]
            : [
                other,
                {
                  id: 77,
                  status: 'completed',
                  conclusion: 'success',
                  html_url: 'run:77',
                },
              ],
      };
    },
    [`GET ${REPO}/actions/runs/76/artifacts`]: { artifacts: [] },
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
  assert.equal(result.runUrl, 'run:77');
  assert.deepEqual(Object.keys(result.files), ['json/en_US.json']);

  // Every run finished and none uploaded the preview.
  await assert.rejects(
    fromPullRequest({
      pr: 12,
      wait: true,
      intervalMs: 1,
      api: fakeApi({
        ...routes,
        [`GET ${REPO}/actions/runs?event=pull_request&head_sha=h1`]: {
          workflow_runs: [other],
        },
      }),
    }),
    /have no i18n-preview artifact/,
  );

  // apply passes the commit it created: a PR head that moved since is refused
  // before anything is downloaded, and the same head is pulled as usual.
  const moved = fakeApi(routes);
  await assert.rejects(
    fromPullRequest({ pr: 12, commit: 'h0', wait: true, api: moved }),
    /onekey-i18n PR #12 has moved to h1 since h0/,
  );
  assert.deepEqual(
    moved.calls.map(([kind, endpoint]) => `${kind} ${endpoint}`),
    [`GET ${REPO}/pulls/12`],
  );

  // A PR closed without merging is refused before anything is downloaded.
  const closed = fakeApi({
    ...routes,
    [`GET ${REPO}/pulls/12`]: {
      state: 'closed',
      merged_at: null,
      head: { sha: 'h1' },
    },
  });
  await assert.rejects(
    fromPullRequest({ pr: 12, commit: 'h1', wait: true, api: closed }),
    /onekey-i18n PR #12 was closed without merging/,
  );
  assert.deepEqual(
    closed.calls.map(([kind, endpoint]) => `${kind} ${endpoint}`),
    [`GET ${REPO}/pulls/12`],
  );
  polls = 0;
  const pinned = await fromPullRequest({
    pr: 12,
    commit: 'h1',
    wait: true,
    intervalMs: 1,
    api: fakeApi(routes),
  });
  assert.equal(pinned.commit, 'h1');
});

test('locale files are never written outside the locale directory', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-app-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stale = path.join(root, LOCALE_ROOT, 'json/stale.json');
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  fs.writeFileSync(stale, '{}');
  for (const name of [
    '../escape.json',
    '..\\escape.json',
    'json\\..\\..\\escape.json',
  ]) {
    assert.throws(
      () =>
        writeLocaleFiles(root, {
          source: 'release',
          commit: 'x',
          files: { 'json/en_US.json': '{}', [name]: '{}' },
        }),
      /Unsafe path/,
    );
  }
  // Every file is checked before anything is deleted or written.
  assert.equal(fs.existsSync(stale), true);
  assert.equal(
    fs.existsSync(path.join(root, LOCALE_ROOT, 'json/en_US.json')),
    false,
  );

  // Windows also treats backslashes and drive-relative names as paths.
  const windowsRoot = 'C:\\repo\\packages\\shared\\src\\locale';
  for (const name of ['json\\..\\..\\escape.json', 'D:escape.json']) {
    assert.throws(
      () => localeDestination(windowsRoot, name, path.win32),
      /Unsafe path/,
    );
  }
  assert.equal(
    localeDestination(windowsRoot, 'json/en_US.json', path.win32),
    `${windowsRoot}\\json\\en_US.json`,
  );
  assert.equal(
    localeDestination('/repo/locale', 'json/en_US.json', path.posix),
    '/repo/locale/json/en_US.json',
  );
});

test('.env fills only unset ONEKEY_I18N_* settings', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-env-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, '.env');
  fs.writeFileSync(
    file,
    [
      '# i18n',
      'ONEKEY_I18N_TOKEN="from-dotenv" # read-only',
      'export ONEKEY_I18N_CHANNEL=test # trying a branch',
      'ONEKEY_I18N_BASE=feat/x',
      'ONEKEY_I18N_EMPTY=',
      'GH_TOKEN=release-token',
    ].join('\n'),
  );
  const env = { ONEKEY_I18N_BASE: 'main' };
  assert.deepEqual(loadLocalSettings({ env, file }), [
    'ONEKEY_I18N_TOKEN',
    'ONEKEY_I18N_CHANNEL',
  ]);
  // The shell wins, and other .env entries such as GH_TOKEN stay unread.
  assert.deepEqual(
    [
      env.ONEKEY_I18N_TOKEN,
      env.ONEKEY_I18N_CHANNEL,
      env.ONEKEY_I18N_BASE,
      env.ONEKEY_I18N_EMPTY,
      env.GH_TOKEN,
    ],
    ['from-dotenv', 'test', 'main', undefined, undefined],
  );
  assert.deepEqual(resolveToken({ env }), {
    token: 'from-dotenv',
    source: 'ONEKEY_I18N_TOKEN from .env',
  });
  assert.deepEqual(
    loadLocalSettings({ env: {}, file: path.join(dir, 'missing') }),
    [],
  );
});

test('the shared read-only token is never used for writes', async () => {
  const env = {
    ONEKEY_I18N_TOKEN: 'shared-read',
    GH_TOKEN: 'own',
    OP_RUN_LOADED: 'LOKALISE_TOKEN ONEKEY_I18N_TOKEN',
  };
  assert.deepEqual(resolveToken({ env }), {
    token: 'shared-read',
    source: 'ONEKEY_I18N_TOKEN from 1Password (yarn op)',
  });
  assert.deepEqual(resolveToken({ write: true, env }), {
    token: 'own',
    source: 'GH_TOKEN environment variable',
  });

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

test('identity names the token source and its GitHub account', async () => {
  const api = githubApi({
    token: 'r',
    fetchImpl: async (url, init) =>
      url.endsWith('/user') && init.headers.Authorization === 'Bearer r'
        ? Response.json({ login: 'originalix' })
        : new Response('{}', { status: 404 }),
  });
  assert.deepEqual(await api.identity(), {
    source: 'token argument',
    login: 'originalix',
  });
});
