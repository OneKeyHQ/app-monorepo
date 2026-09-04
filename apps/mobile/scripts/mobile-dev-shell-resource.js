#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words SIMCTL */

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { withCacheLock } = require('./metro-dev-prebundle');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const OCI_REGISTRY = 'ghcr.io';
const OCI_REPOSITORY = 'onekeyhq/mobile-dev-shell';
const OCI_ARTIFACT_TYPE = 'application/vnd.onekey.mobile-dev-shell.v1';
const OCI_MANIFEST_MEDIA_TYPE = 'application/vnd.oci.image.manifest.v1+json';
const SOURCE_REPOSITORY = 'OneKeyHQ/app-monorepo';
const SOURCE_ANNOTATION = 'org.opencontainers.image.source';
const REVISION_ANNOTATION = 'org.opencontainers.image.revision';
const LAYER_TITLE_ANNOTATION = 'org.opencontainers.image.title';
const ATTESTATION_FILE = 'mobile-dev-shell-attestations.jsonl';
const RECEIPT_FILE = 'mobile-dev-shell-oci-receipt.json';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 32 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 1536 * 1024 * 1024;
const MAX_CACHED_SHELLS = 4;
const SHELL_DOWNLOAD_MAX_ATTEMPTS = 3;
const CACHE_LEASE_DIRECTORY = '.leases';
const CURRENT_PROCESS_STARTED_AT_MS = Date.now() - process.uptime() * 1000;
const ANDROID_APPLICATION_ID = 'so.onekey.app.wallet';
const ANDROID_REINSTALL_REQUIRED_PATTERN =
  /\bINSTALL_FAILED_(?:UPDATE_INCOMPATIBLE|VERSION_DOWNGRADE)\b/u;

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function hashValues(namespace, values) {
  const hash = crypto.createHash('sha256');
  hash.update(namespace);
  hash.update('\0');
  for (const value of values) {
    hash.update(String(value));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function getSidecarFile(artifactFile) {
  return artifactFile.replace(/\.(apk|zip)$/u, '.json');
}

function getCacheRoot(env = process.env) {
  const baseDirectory = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(baseDirectory, 'onekey/mobile-dev-shell/v3');
}

function assertCompatibility(compatibility) {
  const expectedShellCompatibilityKey = hashValues(
    'onekey-mobile-dev-shell-compatibility-v3',
    [
      `platform=${compatibility?.platform || ''}`,
      `architecture=${compatibility?.architecture || ''}`,
      `native-contract=${compatibility?.nativeContractKey || ''}`,
      `web-embed=${compatibility?.webEmbedInputKey || ''}`,
    ],
  );
  if (
    !['android', 'ios'].includes(compatibility?.platform) ||
    !['android', 'ios-simulator'].includes(compatibility?.resourcePlatform) ||
    !['arm64-v8a', 'arm64'].includes(compatibility?.architecture) ||
    !/^[0-9a-f]{64}$/.test(compatibility?.nativeContractKey || '') ||
    !/^[0-9a-f]{64}$/.test(compatibility?.shellCompatibilityKey || '') ||
    !/^[0-9a-f]{64}$/.test(compatibility?.shellInputKey || '') ||
    !/^[0-9a-f]{64}$/.test(compatibility?.webEmbedInputKey || '') ||
    compatibility?.shellCompatibilityKey !== expectedShellCompatibilityKey ||
    !/^mobile-dev-shell-contract-v3-[a-z0-9-]+-[a-z0-9-]+-[0-9a-f]{64}$/.test(
      compatibility?.compatibilityTag || '',
    ) ||
    !/^mobile-dev-shell-input-v3-[a-z0-9-]+-[a-z0-9-]+-[0-9a-f]{64}$/.test(
      compatibility?.exactTag || '',
    ) ||
    !/^OneKeyWallet-DevShell-[A-Za-z0-9.-]+\.(apk|zip)$/.test(
      compatibility?.artifactFile || '',
    ) ||
    !compatibility.compatibilityTag.endsWith(
      compatibility.shellCompatibilityKey,
    ) ||
    !compatibility.exactTag.endsWith(compatibility.shellInputKey)
  ) {
    throw new Error('[mobileDevShellResource] Invalid shell compatibility.');
  }
  return compatibility;
}

async function readResponseBody({ fileName, maxBytes, response }) {
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new Error(
      `[mobileDevShellResource] Download exceeds size limit: ${fileName}.`,
    );
  }
  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    receivedBytes += bytes.length;
    if (receivedBytes > maxBytes) {
      throw new Error(
        `[mobileDevShellResource] Download exceeds size limit: ${fileName}.`,
      );
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, receivedBytes);
}

function parseBearerChallenge(value) {
  const scheme = value?.match(/^Bearer\s+(.+)$/iu);
  if (!scheme) {
    throw new Error(
      '[mobileDevShellResource] OCI registry returned an unsupported authentication challenge.',
    );
  }
  const parameters = {};
  const pattern = /(?:^|,)\s*([a-z][a-z0-9_-]*)="([^"]*)"/giu;
  for (const match of scheme[1].matchAll(pattern)) {
    parameters[match[1].toLowerCase()] = match[2];
  }
  if (!parameters.realm) {
    throw new Error(
      '[mobileDevShellResource] OCI authentication challenge has no realm.',
    );
  }
  return parameters;
}

function createOciClient({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error(
      '[mobileDevShellResource] This Node.js runtime has no fetch.',
    );
  }
  const baseUrl = `https://${OCI_REGISTRY}`;
  const repositoryScope = `repository:${OCI_REPOSITORY}:pull`;
  const repositoryUrl = `${baseUrl}/v2/${OCI_REPOSITORY}`;
  let authorization;

  async function fetchRegistry(url, { accept, timeoutMs }) {
    const request = () =>
      fetchImpl(url, {
        headers: {
          Accept: accept,
          ...(authorization ? { Authorization: authorization } : {}),
          'User-Agent': 'OneKey-Mobile-Dev-Shell',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
    let response = await request();
    if (response.status !== 401) return response;

    const challenge = parseBearerChallenge(
      response.headers.get('www-authenticate'),
    );
    if (challenge.scope && challenge.scope !== repositoryScope) {
      throw new Error(
        '[mobileDevShellResource] OCI registry requested an unexpected scope.',
      );
    }
    const tokenUrl = new URL(challenge.realm);
    if (
      tokenUrl.protocol !== 'https:' ||
      tokenUrl.username ||
      tokenUrl.password ||
      tokenUrl.origin !== baseUrl
    ) {
      throw new Error(
        '[mobileDevShellResource] OCI registry returned an untrusted token realm.',
      );
    }
    if (challenge.service) {
      tokenUrl.searchParams.set('service', challenge.service);
    }
    tokenUrl.searchParams.set('scope', challenge.scope || repositoryScope);
    const tokenResponse = await fetchImpl(tokenUrl, {
      headers: { 'User-Agent': 'OneKey-Mobile-Dev-Shell' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) {
      throw new Error(
        `[mobileDevShellResource] OCI token request failed: HTTP ${tokenResponse.status}.`,
      );
    }
    const tokenBytes = await readResponseBody({
      fileName: 'OCI token',
      maxBytes: 32 * 1024,
      response: tokenResponse,
    });
    const tokenPayload = JSON.parse(tokenBytes.toString('utf8'));
    const token = tokenPayload.token || tokenPayload.access_token;
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > 16_384
    ) {
      throw new Error(
        '[mobileDevShellResource] OCI registry returned an invalid token.',
      );
    }
    authorization = `Bearer ${token}`;
    response = await request();
    return response;
  }

  return {
    fetchBlob(digest, timeoutMs = 180_000) {
      if (!/^sha256:[0-9a-f]{64}$/.test(digest || '')) {
        throw new Error('[mobileDevShellResource] Invalid OCI blob digest.');
      }
      return fetchRegistry(`${repositoryUrl}/blobs/${digest}`, {
        accept: 'application/octet-stream',
        timeoutMs,
      });
    },
    fetchManifest(tag) {
      return fetchRegistry(
        `${repositoryUrl}/manifests/${encodeURIComponent(tag)}`,
        { accept: OCI_MANIFEST_MEDIA_TYPE, timeoutMs: 15_000 },
      );
    },
  };
}

function verifyOciManifest({ compatibility, locator, manifest }) {
  const sidecarFile = getSidecarFile(compatibility.artifactFile);
  const expectedFiles = [
    ATTESTATION_FILE,
    compatibility.artifactFile,
    sidecarFile,
  ].toSorted(compareStrings);
  const actualFiles = manifest?.layers
    ?.map((layer) => layer.annotations?.[LAYER_TITLE_ANNOTATION])
    .toSorted(compareStrings);
  if (
    manifest?.schemaVersion !== 2 ||
    manifest.mediaType !== OCI_MANIFEST_MEDIA_TYPE ||
    manifest.artifactType !== OCI_ARTIFACT_TYPE ||
    manifest.annotations?.[SOURCE_ANNOTATION] !==
      `https://github.com/${SOURCE_REPOSITORY}` ||
    manifest.annotations?.['com.onekey.mobile.architecture'] !==
      compatibility.architecture ||
    manifest.annotations?.['com.onekey.mobile.platform'] !==
      compatibility.resourcePlatform ||
    manifest.annotations?.['com.onekey.mobile.native-contract-key'] !==
      compatibility.nativeContractKey ||
    manifest.annotations?.['com.onekey.mobile.shell-compatibility-key'] !==
      compatibility.shellCompatibilityKey ||
    !/^[0-9a-f]{64}$/.test(
      manifest.annotations?.['com.onekey.mobile.shell-input-key'] || '',
    ) ||
    (locator === 'exact' &&
      manifest.annotations?.['com.onekey.mobile.shell-input-key'] !==
        compatibility.shellInputKey) ||
    JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)
  ) {
    throw new Error('[mobileDevShellResource] Invalid OCI shell manifest.');
  }
  if (
    typeof manifest.config?.mediaType !== 'string' ||
    !Number.isSafeInteger(manifest.config?.size) ||
    manifest.config.size <= 0 ||
    !/^sha256:[0-9a-f]{64}$/.test(manifest.config?.digest || '')
  ) {
    throw new Error('[mobileDevShellResource] Invalid OCI shell config.');
  }
  const layers = new Map();
  for (const descriptor of manifest.layers) {
    const title = descriptor.annotations?.[LAYER_TITLE_ANNOTATION];
    if (
      !expectedFiles.includes(title) ||
      layers.has(title) ||
      !Number.isSafeInteger(descriptor.size) ||
      descriptor.size <= 0 ||
      !/^sha256:[0-9a-f]{64}$/.test(descriptor.digest || '')
    ) {
      throw new Error('[mobileDevShellResource] Invalid OCI shell layer.');
    }
    layers.set(title, descriptor);
  }
  return layers;
}

async function resolveOciShell({ compatibility, fetchImpl, locator, tag }) {
  const client = createOciClient({ fetchImpl });
  const response = await client.fetchManifest(tag);
  if (!response.ok) {
    const error = new Error(
      `[mobileDevShellResource] Shell locator unavailable: HTTP ${response.status}.`,
    );
    if (response.status === 404) error.code = 'SHELL_LOCATOR_NOT_FOUND';
    error.retryable =
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500;
    throw error;
  }
  const manifestBytes = await readResponseBody({
    fileName: 'OCI shell manifest',
    maxBytes: MAX_MANIFEST_BYTES,
    response,
  });
  const ociDigest = response.headers.get('docker-content-digest');
  const actualDigest = `sha256:${crypto.createHash('sha256').update(manifestBytes).digest('hex')}`;
  if (
    !/^sha256:[0-9a-f]{64}$/.test(ociDigest || '') ||
    ociDigest !== actualDigest
  ) {
    throw new Error(
      '[mobileDevShellResource] OCI shell manifest digest mismatch.',
    );
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const sourceCommit = manifest.annotations?.[REVISION_ANNOTATION];
  if (!/^[0-9a-f]{40}$/.test(sourceCommit || '')) {
    throw new Error('[mobileDevShellResource] OCI shell revision is invalid.');
  }
  return {
    client,
    layers: verifyOciManifest({ compatibility, locator, manifest }),
    ociDigest,
    sourceCommit,
  };
}

async function resolveExactMobileDevShell({
  compatibility: inputCompatibility,
  fetchImpl,
  maxAttempts = SHELL_DOWNLOAD_MAX_ATTEMPTS,
  retryDelayMs = 250,
  wait = (durationMs) =>
    new Promise((resolve) => setTimeout(resolve, durationMs)),
}) {
  const compatibility = assertCompatibility(inputCompatibility);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const resolved = await resolveOciShell({
        compatibility,
        fetchImpl,
        locator: 'exact',
        tag: compatibility.exactTag,
      });
      return {
        exists: true,
        ociDigest: resolved.ociDigest,
        sourceCommit: resolved.sourceCommit,
        tag: compatibility.exactTag,
      };
    } catch (error) {
      if (error?.code === 'SHELL_LOCATOR_NOT_FOUND') {
        return {
          exists: false,
          ociDigest: null,
          sourceCommit: null,
          tag: compatibility.exactTag,
        };
      }
      if (attempt === maxAttempts || !isRetryableOciError(error)) {
        throw error;
      }
      console.error(
        `[mobileDevShellResource] Retrying exact shell lookup after a transient failure (${String(attempt)}/${String(maxAttempts)}): ${error instanceof Error ? error.message : String(error)}`,
      );
      await wait(retryDelayMs * attempt);
    }
  }
  throw new Error('[mobileDevShellResource] Exact shell lookup exhausted.');
}

function isRetryableOciError(error) {
  const retryableCodes = new Set([
    'EAI_AGAIN',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ETIMEDOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET',
  ]);
  let current = error;
  while (current) {
    if (current.retryable === true || retryableCodes.has(current.code)) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

async function downloadLayerOnce({ client, descriptor, filePath, maxBytes }) {
  if (descriptor.size > maxBytes) {
    throw new Error(
      `[mobileDevShellResource] Shell layer exceeds size limit: ${path.basename(filePath)}.`,
    );
  }
  const response = await client.fetchBlob(descriptor.digest);
  if (!response.ok) {
    const error = new Error(
      `[mobileDevShellResource] Shell layer download failed: HTTP ${response.status}.`,
    );
    error.retryable =
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500;
    throw error;
  }
  const file = await fs.promises.open(filePath, 'wx', 0o600);
  const hash = crypto.createHash('sha256');
  let receivedBytes = 0;
  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      receivedBytes += bytes.length;
      if (receivedBytes > maxBytes || receivedBytes > descriptor.size) {
        throw new Error(
          `[mobileDevShellResource] Shell layer exceeds size limit: ${path.basename(filePath)}.`,
        );
      }
      hash.update(bytes);
      await file.write(bytes);
    }
    await file.sync();
  } finally {
    await file.close();
  }
  if (
    receivedBytes !== descriptor.size ||
    `sha256:${hash.digest('hex')}` !== descriptor.digest
  ) {
    throw new Error(
      `[mobileDevShellResource] Shell layer integrity mismatch: ${path.basename(filePath)}.`,
    );
  }
}

async function downloadLayerToFile({
  client,
  descriptor,
  filePath,
  maxBytes,
  maxAttempts = SHELL_DOWNLOAD_MAX_ATTEMPTS,
  retryDelayMs = 250,
  wait = (durationMs) =>
    new Promise((resolve) => setTimeout(resolve, durationMs)),
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await downloadLayerOnce({ client, descriptor, filePath, maxBytes });
      return;
    } catch (error) {
      await fs.promises.rm(filePath, { force: true });
      if (attempt === maxAttempts || !isRetryableOciError(error)) {
        throw error;
      }
      console.error(
        `[mobileDevShellResource] Retrying ${path.basename(filePath)} after a transient download failure (${String(attempt)}/${String(maxAttempts)}): ${error instanceof Error ? error.message : String(error)}`,
      );
      await wait(retryDelayMs * attempt);
    }
  }
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const input = fs.createReadStream(filePath);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest('hex');
}

async function readJsonFile(filePath, maxBytes = MAX_MANIFEST_BYTES) {
  const stat = await fs.promises.lstat(filePath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size <= 0 ||
    stat.size > maxBytes
  ) {
    throw new Error(
      `[mobileDevShellResource] Invalid cached file: ${path.basename(filePath)}.`,
    );
  }
  return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
}

async function verifyArtifactManifest({
  artifactPath,
  compatibility,
  locator,
  manifest,
}) {
  const stat = await fs.promises.lstat(artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      '[mobileDevShellResource] Cached shell is not a regular file.',
    );
  }
  const artifactSha256 = await sha256File(artifactPath);
  const expectedArtifactKey = hashValues(
    'onekey-mobile-dev-shell-artifact-v3',
    [manifest.shellInputKey, artifactSha256, stat.size],
  );
  const hasRemoteWebEmbed = /^sha256:[0-9a-f]{64}$/.test(
    manifest.webEmbed?.ociDigest || '',
  );
  const hasLocalWebEmbed =
    manifest.webEmbed?.source === 'local-build' &&
    manifest.webEmbed.ociDigest === undefined &&
    manifest.webEmbed.reference === undefined;
  if (
    manifest?.schemaVersion !== 3 ||
    manifest.platform !== compatibility.platform ||
    manifest.architecture !== compatibility.architecture ||
    manifest.nativeContractKey !== compatibility.nativeContractKey ||
    manifest.shellCompatibilityKey !== compatibility.shellCompatibilityKey ||
    !/^[0-9a-f]{64}$/.test(manifest.shellInputKey || '') ||
    (locator === 'exact' &&
      manifest.shellInputKey !== compatibility.shellInputKey) ||
    manifest.shellArtifactKey !== expectedArtifactKey ||
    manifest.webEmbed?.inputKey !== compatibility.webEmbedInputKey ||
    !/^[0-9a-f]{64}$/.test(manifest.webEmbed?.outputTreeDigest || '') ||
    (!hasRemoteWebEmbed && !hasLocalWebEmbed) ||
    manifest.artifact?.file !== compatibility.artifactFile ||
    manifest.artifact?.bytes !== stat.size ||
    manifest.artifact?.sha256 !== artifactSha256
  ) {
    throw new Error(
      '[mobileDevShellResource] Shell artifact does not match this checkout.',
    );
  }
  return manifest;
}

function getGhAttestationVerifyArgs({
  artifactPath,
  bundlePath,
  compatibility,
  sourceCommit,
}) {
  const signerWorkflow =
    compatibility.platform === 'android'
      ? 'OneKeyHQ/app-monorepo/.github/workflows/mobile-dev-shell-android.yml'
      : 'OneKeyHQ/app-monorepo/.github/workflows/mobile-dev-shell-ios-simulator.yml';
  return [
    'attestation',
    'verify',
    artifactPath,
    '--repo',
    SOURCE_REPOSITORY,
    '--bundle',
    bundlePath,
    '--custom-trusted-root',
    path.join(
      REPO_ROOT,
      'apps/mobile/bundle-registry/metro-dev-prebundle-trusted-root.jsonl',
    ),
    '--signer-workflow',
    signerWorkflow,
    '--source-ref',
    'refs/heads/x',
    '--source-digest',
    sourceCommit,
    '--deny-self-hosted-runners',
  ];
}

async function runGhAttestationVerify(options) {
  const result = spawnSync('gh', getGhAttestationVerifyArgs(options), {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `[mobileDevShellResource] GitHub attestation verification failed: ${result.stderr || result.error?.message || 'unknown error'}`,
    );
  }
}

async function verifyCache({
  attestationVerifier = runGhAttestationVerify,
  cacheDirectory,
  compatibility,
  locator,
  tag,
}) {
  const artifactPath = path.join(cacheDirectory, compatibility.artifactFile);
  const sidecarPath = path.join(
    cacheDirectory,
    getSidecarFile(compatibility.artifactFile),
  );
  const bundlePath = path.join(cacheDirectory, ATTESTATION_FILE);
  const receipt = await readJsonFile(path.join(cacheDirectory, RECEIPT_FILE));
  if (
    receipt.tag !== tag ||
    !/^sha256:[0-9a-f]{64}$/.test(receipt.ociDigest || '') ||
    !/^[0-9a-f]{40}$/.test(receipt.sourceCommit || '')
  ) {
    throw new Error('[mobileDevShellResource] Invalid cached OCI receipt.');
  }
  const manifest = await readJsonFile(sidecarPath);
  await verifyArtifactManifest({
    artifactPath,
    compatibility,
    locator,
    manifest,
  });
  const bundleStat = await fs.promises.lstat(bundlePath);
  if (
    !bundleStat.isFile() ||
    bundleStat.isSymbolicLink() ||
    bundleStat.size <= 0 ||
    bundleStat.size > MAX_ATTESTATION_BYTES
  ) {
    throw new Error(
      '[mobileDevShellResource] Invalid cached attestation bundle.',
    );
  }
  for (const targetPath of [artifactPath, sidecarPath]) {
    await attestationVerifier({
      artifactPath: targetPath,
      bundlePath,
      compatibility,
      sourceCommit: receipt.sourceCommit,
    });
  }
  return { artifactPath, manifest, ...receipt };
}

function getCacheTagLockDirectory(cacheRoot, tag) {
  return path.join(cacheRoot, '.locks', `${tag}.lock`);
}

function isProcessRunning(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    throw error;
  }
}

function getProcessStartedAtMs(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  if (pid === process.pid) return CURRENT_PROCESS_STARTED_AT_MS;
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
    timeout: 5000,
  });
  if (result.status !== 0 || result.error) return undefined;
  const startedAtMs = Date.parse(result.stdout.trim());
  return Number.isFinite(startedAtMs) ? startedAtMs : undefined;
}

function isLeaseOwnerRunning(lease, leaseMtimeMs) {
  if (!isProcessRunning(lease.pid)) return false;
  const currentStartedAtMs = getProcessStartedAtMs(lease.pid);
  if (currentStartedAtMs === undefined) {
    return true;
  }
  if (Number.isFinite(lease.processStartedAtMs)) {
    return Math.abs(lease.processStartedAtMs - currentStartedAtMs) <= 1000;
  }
  return currentStartedAtMs <= leaseMtimeMs + 1000;
}

async function hasActiveCacheLease(cacheDirectory) {
  const leaseDirectory = path.join(cacheDirectory, CACHE_LEASE_DIRECTORY);
  let entries;
  try {
    entries = await fs.promises.readdir(leaseDirectory, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  let active = false;
  for (const entry of entries) {
    const leasePath = path.join(leaseDirectory, entry.name);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      await fs.promises.rm(leasePath, { force: true, recursive: true });
    } else {
      try {
        const leaseStat = await fs.promises.lstat(leasePath);
        const lease = JSON.parse(await fs.promises.readFile(leasePath, 'utf8'));
        if (isLeaseOwnerRunning(lease, leaseStat.mtimeMs)) {
          active = true;
        } else {
          await fs.promises.rm(leasePath, { force: true });
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          await fs.promises.rm(leasePath, { force: true });
        }
      }
    }
  }
  return active;
}

async function listCacheTagDirectories(cacheRoot) {
  const entries = await fs.promises.readdir(cacheRoot, {
    withFileTypes: true,
  });
  const tagPattern =
    /^mobile-dev-shell-(?:contract|input)-v3-[a-z0-9-]+-[a-z0-9-]+-[0-9a-f]{64}$/u;
  const directories = [];
  for (const entry of entries) {
    if (entry.isDirectory() && tagPattern.test(entry.name)) {
      const directoryPath = path.join(cacheRoot, entry.name);
      const stat = await fs.promises.lstat(directoryPath);
      if (!stat.isSymbolicLink()) {
        directories.push({
          directoryPath,
          mtimeMs: stat.mtimeMs,
          tag: entry.name,
        });
      }
    }
  }
  return directories.toSorted(
    (first, second) => second.mtimeMs - first.mtimeMs,
  );
}

async function touchAndPruneMobileShellCache(cacheRoot, currentTag) {
  const currentDirectory = path.join(cacheRoot, currentTag);
  const now = new Date();
  await fs.promises.utimes(currentDirectory, now, now);
  const candidates = (await listCacheTagDirectories(cacheRoot))
    .filter(({ tag }) => tag !== currentTag)
    .slice(MAX_CACHED_SHELLS - 1);
  for (const candidate of candidates) {
    try {
      await withCacheLock(
        getCacheTagLockDirectory(cacheRoot, candidate.tag),
        async () => {
          const retainedTags = new Set([
            currentTag,
            ...(await listCacheTagDirectories(cacheRoot))
              .filter(({ tag }) => tag !== currentTag)
              .slice(0, MAX_CACHED_SHELLS - 1)
              .map(({ tag }) => tag),
          ]);
          if (
            !retainedTags.has(candidate.tag) &&
            !(await hasActiveCacheLease(candidate.directoryPath))
          ) {
            await fs.promises.rm(candidate.directoryPath, {
              force: true,
              recursive: true,
            });
          }
        },
        { waitTimeoutMs: 0 },
      );
    } catch (error) {
      if (error?.constructor?.name !== 'CacheLockTimeoutError') throw error;
    }
  }
}

async function createMobileShellCacheLease({ cacheRoot, tag }) {
  const cacheDirectory = path.join(cacheRoot, tag);
  const leaseDirectory = path.join(cacheDirectory, CACHE_LEASE_DIRECTORY);
  const leasePath = path.join(
    leaseDirectory,
    `${String(process.pid)}-${crypto.randomUUID()}.json`,
  );
  const processStartedAtMs = getProcessStartedAtMs(process.pid);
  await fs.promises.mkdir(leaseDirectory, { mode: 0o700, recursive: true });
  await fs.promises.writeFile(
    leasePath,
    `${JSON.stringify({ pid: process.pid, processStartedAtMs })}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  const removeLease = async () => {
    await fs.promises.rm(leasePath, { force: true });
    try {
      await fs.promises.rmdir(leaseDirectory);
    } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY'].includes(error?.code)) throw error;
    }
  };
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await withCacheLock(
        getCacheTagLockDirectory(cacheRoot, tag),
        async () => {
          let pruneError;
          try {
            await touchAndPruneMobileShellCache(cacheRoot, tag);
          } catch (error) {
            pruneError = error;
          }
          await removeLease();
          if (pruneError) {
            throw new Error(
              '[mobileDevShell] Failed to prune the shell cache.',
              { cause: pruneError },
            );
          }
        },
        { waitTimeoutMs: 0 },
      );
    } catch (error) {
      await removeLease();
      if (error?.constructor?.name !== 'CacheLockTimeoutError') {
        throw error;
      }
    }
  };
}

async function releaseCacheLeaseWithNotice(releaseCacheLease) {
  try {
    await releaseCacheLease?.();
  } catch (error) {
    console.error(
      `[ONEKEY_USER_NOTICE] Mobile shell cache lease cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runWithCacheLeaseCleanup({ operation, releaseCacheLease }) {
  let result;
  try {
    result = await operation();
  } catch (operationError) {
    await releaseCacheLeaseWithNotice(releaseCacheLease);
    throw operationError;
  }
  await releaseCacheLeaseWithNotice(releaseCacheLease);
  return result;
}

async function restoreLocator({
  attestationVerifier,
  cacheRoot,
  compatibility,
  fetchImpl,
  locator,
  tag,
}) {
  const cacheDirectory = path.join(cacheRoot, tag);
  const lockDirectory = getCacheTagLockDirectory(cacheRoot, tag);
  return withCacheLock(lockDirectory, async () => {
    await fs.promises.mkdir(cacheRoot, { mode: 0o700, recursive: true });
    try {
      const restored = await verifyCache({
        attestationVerifier,
        cacheDirectory,
        compatibility,
        locator,
        tag,
      });
      return {
        ...restored,
        cacheHit: true,
        releaseCacheLease: await createMobileShellCacheLease({
          cacheRoot,
          tag,
        }),
        source: 'remote-cache',
      };
    } catch (error) {
      if (await hasActiveCacheLease(cacheDirectory)) {
        throw new Error(
          '[mobileDevShellResource] Cached shell verification failed while the shell is in use.',
          { cause: error },
        );
      }
      await fs.promises.rm(cacheDirectory, { force: true, recursive: true });
    }

    const temporaryDirectory = await fs.promises.mkdtemp(
      path.join(cacheRoot, `${tag}.download-`),
    );
    try {
      const resolved = await resolveOciShell({
        compatibility,
        fetchImpl,
        locator,
        tag,
      });
      const files = [
        [compatibility.artifactFile, MAX_ARTIFACT_BYTES],
        [getSidecarFile(compatibility.artifactFile), MAX_MANIFEST_BYTES],
        [ATTESTATION_FILE, MAX_ATTESTATION_BYTES],
      ];
      for (const [fileName, maxBytes] of files) {
        await downloadLayerToFile({
          client: resolved.client,
          descriptor: resolved.layers.get(fileName),
          filePath: path.join(temporaryDirectory, fileName),
          maxBytes,
        });
      }
      await fs.promises.writeFile(
        path.join(temporaryDirectory, RECEIPT_FILE),
        `${JSON.stringify(
          {
            ociDigest: resolved.ociDigest,
            sourceCommit: resolved.sourceCommit,
            tag,
          },
          null,
          2,
        )}\n`,
        { mode: 0o600 },
      );
      const restored = await verifyCache({
        attestationVerifier,
        cacheDirectory: temporaryDirectory,
        compatibility,
        locator,
        tag,
      });
      await fs.promises.rename(temporaryDirectory, cacheDirectory);
      return {
        ...restored,
        artifactPath: path.join(cacheDirectory, compatibility.artifactFile),
        cacheHit: false,
        releaseCacheLease: await createMobileShellCacheLease({
          cacheRoot,
          tag,
        }),
        source: 'remote',
      };
    } catch (error) {
      await fs.promises.rm(temporaryDirectory, {
        force: true,
        recursive: true,
      });
      throw error;
    }
  });
}

async function restoreMobileDevShell({
  attestationVerifier,
  cacheRoot = getCacheRoot(),
  compatibility: inputCompatibility,
  fetchImpl,
}) {
  const compatibility = assertCompatibility(inputCompatibility);
  try {
    const restored = await restoreLocator({
      attestationVerifier,
      cacheRoot,
      compatibility,
      fetchImpl,
      locator: 'exact',
      tag: compatibility.exactTag,
    });
    return {
      ...restored,
      compatibilityFallback: false,
      fallbackReason: null,
      userNotice: null,
    };
  } catch (error) {
    if (error?.code !== 'SHELL_LOCATOR_NOT_FOUND') throw error;
    const restored = await restoreLocator({
      attestationVerifier,
      cacheRoot,
      compatibility,
      fetchImpl,
      locator: 'compatible',
      tag: compatibility.compatibilityTag,
    });
    const notice = `Exact mobile shell input ${compatibility.shellInputKey} is unavailable; using ABI-compatible shell ${restored.manifest.shellInputKey}.`;
    console.error(`[ONEKEY_USER_NOTICE] ${notice}`);
    return {
      ...restored,
      compatibilityFallback: true,
      fallbackReason: error.message,
      userNotice: notice,
    };
  }
}

function getCommandFailureDetails(result) {
  return [result.stdout, result.stderr, result.error?.message]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .trim();
}

function assertCommandSucceeded(command, args, result) {
  if (result.status !== 0 || result.error) {
    const details = getCommandFailureDetails(result);
    throw new Error(
      `[mobileDevShellResource] Command failed: ${command} ${args[0] || ''}${details ? `: ${details}` : ''}`,
      { cause: result.error },
    );
  }
}

function runChecked(command, args, options = {}, spawnCommand = spawnSync) {
  const result = spawnCommand(command, args, {
    stdio: 'inherit',
    ...options,
  });
  assertCommandSucceeded(command, args, result);
}

function assertDeviceId(deviceId) {
  let hasAsciiControl = false;
  if (typeof deviceId === 'string') {
    for (let index = 0; index < deviceId.length; index += 1) {
      if (deviceId.charCodeAt(index) < 0x20) {
        hasAsciiControl = true;
        break;
      }
    }
  }
  if (
    typeof deviceId !== 'string' ||
    !deviceId ||
    deviceId.length > 256 ||
    hasAsciiControl
  ) {
    throw new Error(
      '[mobileDevShellResource] A valid explicit device ID is required.',
    );
  }
  return deviceId;
}

async function installMobileDevShell({
  artifactPath,
  deviceId,
  platform,
  spawnCommand = spawnSync,
}) {
  const targetDeviceId = assertDeviceId(deviceId);
  if (platform === 'android') {
    const replaceArgs = [
      '-s',
      targetDeviceId,
      'install',
      '-r',
      '-d',
      artifactPath,
    ];
    const replaceResult = spawnCommand('adb', replaceArgs, {
      encoding: 'utf8',
    });
    if (replaceResult.status === 0 && !replaceResult.error) return;
    const failureDetails = getCommandFailureDetails(replaceResult);
    if (!ANDROID_REINSTALL_REQUIRED_PATTERN.test(failureDetails)) {
      assertCommandSucceeded('adb', replaceArgs, replaceResult);
    }
    const emulatorCheckArgs = [
      '-s',
      targetDeviceId,
      'shell',
      'getprop',
      'ro.kernel.qemu',
    ];
    const emulatorResult = spawnCommand('adb', emulatorCheckArgs, {
      encoding: 'utf8',
    });
    assertCommandSucceeded('adb', emulatorCheckArgs, emulatorResult);
    if (emulatorResult.stdout?.trim() !== '1') {
      throw new Error(
        `[mobileDevShellResource] Refusing to uninstall incompatible Android app ${ANDROID_APPLICATION_ID} from physical device ${targetDeviceId} because that would erase wallet data. Remove the app explicitly or use an emulator, then retry.`,
      );
    }
    console.error(
      `[ONEKEY_USER_NOTICE] Removing incompatible Android app ${ANDROID_APPLICATION_ID} from emulator ${targetDeviceId} before installing the development shell; emulator app data will be cleared.`,
    );
    runChecked(
      'adb',
      ['-s', targetDeviceId, 'uninstall', ANDROID_APPLICATION_ID],
      {},
      spawnCommand,
    );
    runChecked(
      'adb',
      ['-s', targetDeviceId, 'install', artifactPath],
      {},
      spawnCommand,
    );
    return;
  }
  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'onekey-ios-dev-shell-'),
  );
  try {
    runChecked('ditto', ['-x', '-k', artifactPath, temporaryDirectory]);
    const appDirectories = (
      await fs.promises.readdir(temporaryDirectory, {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
      .map((entry) => path.join(temporaryDirectory, entry.name));
    if (appDirectories.length !== 1) {
      throw new Error(
        '[mobileDevShellResource] iOS Simulator archive must contain one app.',
      );
    }
    runChecked('xcrun', [
      'simctl',
      'install',
      targetDeviceId,
      appDirectories[0],
    ]);
  } finally {
    await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  }
}

async function main() {
  const platformIndex = process.argv.indexOf('--platform');
  const platform = process.argv[platformIndex + 1];
  const deviceIndex = process.argv.indexOf('--device');
  const deviceId =
    deviceIndex === -1 ? undefined : process.argv[deviceIndex + 1];
  if (process.argv[2] !== 'restore' || !['android', 'ios'].includes(platform)) {
    throw new Error(
      'Usage: mobile-dev-shell-resource.js restore --platform <android|ios> [--install --device <id>]',
    );
  }
  if (process.argv.includes('--install') && !deviceId) {
    throw new Error(
      '[mobileDevShellResource] --install requires an explicit --device.',
    );
  }
  const { getShellCompatibility } = require('./native-dev-shell');
  const compatibility = getShellCompatibility({ platform });
  const result = await restoreMobileDevShell({ compatibility });
  await runWithCacheLeaseCleanup({
    operation: async () => {
      if (process.argv.includes('--install')) {
        await installMobileDevShell({
          artifactPath: result.artifactPath,
          deviceId,
          platform,
        });
      }
      console.log(result.artifactPath);
      if (result.userNotice) {
        console.error(`[ONEKEY_USER_NOTICE] ${result.userNotice}`);
      }
    },
    releaseCacheLease: result.releaseCacheLease,
  });
}

module.exports = {
  ATTESTATION_FILE,
  MAX_CACHED_SHELLS,
  assertDeviceId,
  createMobileShellCacheLease,
  downloadLayerToFile,
  getCacheRoot,
  getGhAttestationVerifyArgs,
  getSidecarFile,
  installMobileDevShell,
  resolveExactMobileDevShell,
  restoreMobileDevShell,
  runWithCacheLeaseCleanup,
  touchAndPruneMobileShellCache,
  verifyArtifactManifest,
  verifyOciManifest,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
