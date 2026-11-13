// App translations come from OneKeyHQ/onekey-i18n (projects/app) through the
// GitHub API: the project's release for normal pulls, a PR's CI preview while an
// onekey-i18n PR is open. No local checkout of onekey-i18n is involved.
// The release is app-latest (published from onekey-i18n main), or app-test with
// ONEKEY_I18N_CHANNEL=test (published from a branch while it is being tried).
// Auth: reads may use ONEKEY_I18N_TOKEN, a shared read-only token that the
// yarn scripts load from 1Password (yarn op). Writes, i.e. copy PRs, always use
// the developer's own identity: GH_TOKEN, GITHUB_TOKEN or `gh auth token`.

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '../../..');
const CENTRAL_REPO = 'OneKeyHQ/onekey-i18n';
const PROJECT_SLUG = 'app';
const PREVIEW_ARTIFACT = 'i18n-preview';
const LOCALE_ROOT = 'packages/shared/src/locale';

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const releaseChannel = () => process.env.ONEKEY_I18N_CHANNEL || 'latest';

/** Token for reads; with write, the developer's own token for the copy PR. */
function resolveToken({ write = false, env = process.env } = {}) {
  const fromEnv =
    (write ? '' : env.ONEKEY_I18N_TOKEN) || env.GH_TOKEN || env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    throw new Error(
      write
        ? `Opening the ${CENTRAL_REPO} PR uses your own GitHub identity; run gh auth login.`
        : `No GitHub token for ${CENTRAL_REPO}: run the yarn script (it loads ONEKEY_I18N_TOKEN from 1Password) or gh auth login.`,
      { cause: error },
    );
  }
}

const RETRYABLE = (status) => status === 429 || status >= 500;

/**
 * Minimal GitHub REST client; fetchImpl is injectable for tests. Reads retry
 * transient failures (5xx, 429, network) with backoff; writes never retry and
 * never use the shared read-only token.
 */
function githubApi({
  token,
  writeToken,
  fetchImpl = fetch,
  retryDelayMs = 1000,
} = {}) {
  const tokens = { read: token, write: writeToken };
  const headers = (write = false) => {
    const kind = write ? 'write' : 'read';
    tokens[kind] = tokens[kind] || resolveToken({ write });
    return {
      Authorization: `Bearer ${tokens[kind]}`,
      'User-Agent': 'onekey-app-i18n',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  };
  const url = (endpoint) =>
    endpoint.startsWith('https://')
      ? endpoint
      : `https://api.github.com${endpoint}`;
  // Runs a read up to three times; send returns a Response.
  const read = async (send) => {
    let lastError = new Error('No attempt was made.');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await delay(retryDelayMs * 2 ** attempt);
      try {
        const response = await send();
        if (!RETRYABLE(response.status)) return response;
        lastError = new Error(`HTTP ${response.status}`);
        lastError.status = response.status;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError;
  };
  return {
    async request(method, endpoint, body) {
      const send = () =>
        fetchImpl(url(endpoint), {
          method,
          headers: {
            ...headers(method !== 'GET'),
            Accept: 'application/vnd.github+json',
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      let response;
      try {
        response = method === 'GET' ? await read(send) : await send();
      } catch (error) {
        throw new Error(`${method} ${endpoint}: ${error.message}`, {
          cause: error,
        });
      }
      if (!response.ok) {
        // GitHub answers 404 when the token cannot write to the repository.
        const denied =
          method !== 'GET' && [401, 403, 404].includes(response.status);
        const error = new Error(
          `${method} ${endpoint}: HTTP ${response.status}${
            denied
              ? `; your GitHub login needs write access to ${CENTRAL_REPO}`
              : ''
          }`,
        );
        error.status = response.status;
        throw error;
      }
      return response.status === 204 ? null : response.json();
    },
    get(endpoint) {
      return this.request('GET', endpoint);
    },
    // Assets and artifacts redirect to object storage; follow without the token.
    async download(endpoint, accept = 'application/octet-stream') {
      const response = await read(async () => {
        const first = await fetchImpl(url(endpoint), {
          headers: { ...headers(), Accept: accept },
          redirect: 'manual',
        });
        return first.status >= 300 && first.status < 400
          ? fetchImpl(first.headers.get('location'))
          : first;
      });
      if (!response.ok)
        throw new Error(`Download ${endpoint}: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

/** Entries of a ZIP archive (stored or deflated) as { name: Buffer }. */
function readZip(buffer) {
  let end = -1;
  for (
    let i = buffer.length - 22;
    end === -1 && i >= Math.max(0, buffer.length - 65_557);
    i -= 1
  ) {
    if (buffer.readUInt32LE(i) === 0x06_05_4b_50) end = i;
  }
  if (end === -1) throw new Error('Not a ZIP archive.');
  const files = {};
  let pointer = buffer.readUInt32LE(end + 16);
  for (let index = buffer.readUInt16LE(end + 10); index > 0; index -= 1) {
    const method = buffer.readUInt16LE(pointer + 10);
    const size = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const local = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString(
      'utf8',
      pointer + 46,
      pointer + 46 + nameLength,
    );
    pointer +=
      46 +
      nameLength +
      buffer.readUInt16LE(pointer + 30) +
      buffer.readUInt16LE(pointer + 32);
    if (!name.endsWith('/')) {
      const start =
        local +
        30 +
        buffer.readUInt16LE(local + 26) +
        buffer.readUInt16LE(local + 28);
      const raw = buffer.subarray(start, start + size);
      if (method === 0) files[name] = Buffer.from(raw);
      else if (method === 8) files[name] = zlib.inflateRawSync(raw);
      else
        throw new Error(`Unsupported ZIP compression ${method} for ${name}.`);
    }
  }
  return files;
}

function parseSums(text) {
  const sums = {};
  for (const line of text.split('\n')) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line.trim());
    if (match) sums[match[2]] = match[1];
  }
  return sums;
}

function textFiles(files) {
  return Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, data.toString('utf8')]),
  );
}

/** Verify one archive against SHA256SUMS and return its files as text. */
function verifiedArchive(name, archive, sumsText) {
  const expected = parseSums(sumsText)[name];
  const actual = sha256(archive);
  if (expected !== actual)
    throw new Error(`${name} does not match SHA256SUMS.`);
  return { sha256: actual, files: textFiles(readZip(archive)) };
}

/** Assets of the project's release in a channel: app-latest by default. */
async function releaseAssets({
  channel = releaseChannel(),
  api = githubApi(),
} = {}) {
  const tag = `${PROJECT_SLUG}-${channel}`;
  const release = await api.get(
    `/repos/${CENTRAL_REPO}/releases/tags/${encodeURIComponent(tag)}`,
  );
  const download = (name) => {
    const asset = release.assets.find((item) => item.name === name);
    if (!asset) throw new Error(`${tag} has no ${name}.`);
    return api.download(asset.url);
  };
  return {
    tag,
    manifest: JSON.parse((await download('manifest.json')).toString('utf8')),
    sums: (await download('SHA256SUMS')).toString('utf8'),
    download,
  };
}

// Releases are replaced in place; a read caught between the files of an update
// fails its checksum or misses a file, and succeeds when read once more.
async function readRelease(read, retryDelayMs = 3000) {
  try {
    return await read();
  } catch (error) {
    if (!/does not match SHA256SUMS|has no |HTTP 404/.test(error.message))
      throw error;
    await delay(retryDelayMs);
    return read();
  }
}

/** Ready-to-use app files of a release. */
async function fromRelease({ channel, api, retryDelayMs } = {}) {
  return readRelease(async () => {
    const { tag, manifest, sums, download } = await releaseAssets({
      channel,
      api,
    });
    const name = `${PROJECT_SLUG}.zip`;
    return {
      source: 'release',
      tag,
      version: manifest.version,
      commit: manifest.commit,
      files: verifiedArchive(name, await download(name), sums).files,
    };
  }, retryDelayMs);
}

/** Canonical project data of a release (project.json, keys.json, locales/*). */
async function sourceFromRelease({ channel, api, retryDelayMs } = {}) {
  return readRelease(async () => {
    const { tag, manifest, sums, download } = await releaseAssets({
      channel,
      api,
    });
    const name = `${PROJECT_SLUG}.source.zip`;
    return {
      tag,
      version: manifest.version,
      commit: manifest.commit,
      files: verifiedArchive(name, await download(name), sums).files,
    };
  }, retryDelayMs);
}

/**
 * App files from an onekey-i18n PR's CI preview artifact. With wait, polls
 * until the PR head's CI run has finished (up to timeoutMs).
 */
async function fromPullRequest({
  pr,
  wait = false,
  timeoutMs = 10 * 60_000,
  intervalMs = 10_000,
  api = githubApi(),
}) {
  const pull = await api.get(`/repos/${CENTRAL_REPO}/pulls/${pr}`);
  const headSha = pull.head.sha;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { workflow_runs: runs } = await api.get(
      `/repos/${CENTRAL_REPO}/actions/runs?event=pull_request&head_sha=${headSha}`,
    );
    const finished = runs.find(
      (run) => run.status === 'completed' && run.conclusion === 'success',
    );
    const pending = runs.some((run) => run.status !== 'completed');
    if (finished) {
      const { artifacts } = await api.get(
        `/repos/${CENTRAL_REPO}/actions/runs/${finished.id}/artifacts`,
      );
      const artifact = artifacts.find(
        (item) => item.name === PREVIEW_ARTIFACT && !item.expired,
      );
      if (!artifact)
        throw new Error(
          `The CI run of PR #${pr} has no ${PREVIEW_ARTIFACT} artifact.`,
        );
      const outer = readZip(
        await api.download(
          artifact.archive_download_url,
          'application/vnd.github+json',
        ),
      );
      const sums = outer[`${PROJECT_SLUG}/SHA256SUMS`];
      const archive = outer[`${PROJECT_SLUG}/${PROJECT_SLUG}.zip`];
      if (!sums || !archive)
        throw new Error(
          `The preview of PR #${pr} has no ${PROJECT_SLUG} files.`,
        );
      const { files } = verifiedArchive(
        `${PROJECT_SLUG}.zip`,
        archive,
        sums.toString('utf8'),
      );
      return { source: 'pr', pr: Number(pr), commit: headSha, files };
    }
    if (!wait || (!pending && runs.length > 0) || Date.now() > deadline)
      throw new Error(
        pending || runs.length === 0
          ? `The CI preview of onekey-i18n PR #${pr} is not ready yet; retry with --wait.`
          : `The CI run of onekey-i18n PR #${pr} did not succeed; fix it there first.`,
      );
    await delay(intervalMs);
  }
}

function assertSafePath(relative) {
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.split('/').some((part) => part === '..' || part === '')
  )
    throw new Error(`Unsafe path in exported files: ${relative}`);
}

/** Write exported files under LOCALE_ROOT; returns how many were written. */
function writeLocaleFiles(outputRoot, result) {
  const localeRoot = path.join(outputRoot, LOCALE_ROOT);
  for (const relative of Object.keys(result.files)) assertSafePath(relative);
  // Locale JSON files that left the export must not linger.
  const jsonDir = path.join(localeRoot, 'json');
  if (fs.existsSync(jsonDir)) {
    for (const name of fs.readdirSync(jsonDir)) {
      if (
        name.endsWith('.json') &&
        !Object.hasOwn(result.files, `json/${name}`)
      )
        fs.unlinkSync(path.join(jsonDir, name));
    }
  }
  for (const [relative, content] of Object.entries(result.files)) {
    const target = path.join(localeRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return Object.keys(result.files).length;
}

module.exports = {
  ROOT,
  CENTRAL_REPO,
  PROJECT_SLUG,
  LOCALE_ROOT,
  githubApi,
  readZip,
  resolveToken,
  fromRelease,
  fromPullRequest,
  sourceFromRelease,
  parseSums,
  writeLocaleFiles,
};
