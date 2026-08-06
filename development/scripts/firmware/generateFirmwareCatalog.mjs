import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import yauzl from 'yauzl';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const outputPath = resolve(
  root,
  'packages/kit-bg/src/services/ServiceFirmwareUpdate/trustedFirmwareCatalog.generated.ts',
);
const generatedAt =
  process.env.FIRMWARE_CATALOG_GENERATED_AT ?? new Date().toISOString();
const maxArtifactBytes = 512 * 1024 * 1024;
const maxEntries = 4096;
const archiveSuffixes = new Set(['.zip']);
const sources = {
  stable: 'https://data.onekey.so/config.json',
  preRelease: 'https://data.onekey.so/pre-config.json',
};
const selectedFields = {
  stable: {
    classic: ['firmware', 'firmware-v2', 'firmware-v8', 'ble'],
    classic1s: ['firmware-v8', 'firmware-btc-v8', 'ble'],
    classicpure: ['firmware-v8', 'firmware-btc-v8', 'ble'],
    mini: ['firmware', 'firmware-v2', 'firmware-v8'],
    touch: ['firmware-v8', 'ble'],
    pro: ['firmware-v8', 'firmware-btc-v8', 'ble'],
  },
  preRelease: {
    pro2: ['firmware-v1'],
  },
};
const deviceModels = [
  'classic',
  'classic1s',
  'classicpure',
  'mini',
  'touch',
  'pro',
  'pro2',
];
const artifactRoles = new Set([
  'firmware',
  'ble',
  'bootloader',
  'resource',
  'fullResource',
  'component',
  'resourceBundle',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function assertHttpsUrl(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new Error(`${label} must be a non-empty URL`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error(`${label} must be a plain HTTPS URL`);
  }
  return value;
}

function getReleaseIdentity(release, label) {
  if (
    !Array.isArray(release.version) ||
    release.version.length === 0 ||
    release.version.some((part) => !Number.isSafeInteger(part) || part < 0)
  ) {
    throw new Error(`${label}.version must be a non-empty integer array`);
  }
  return release.version.join('.');
}

async function fetchBytes(url, maxBytes = 1024 * 1024) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Unable to fetch ${url}: HTTP ${response.status}`);
      }
      const chunks = [];
      let total = 0;
      for await (const chunk of response.body) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          throw new Error(`Response exceeds the byte limit: ${url}`);
        }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) {
    throw new Error(lastError.message, { cause: lastError });
  }
  throw new Error(`Unable to fetch ${url}`);
}

function createEmptyConfig() {
  return Object.fromEntries(
    deviceModels.map((model) => [
      model,
      {
        firmware: [],
        ble: [],
      },
    ]),
  );
}

function collectReleaseUrls(release, field, label = field) {
  if (!release || typeof release !== 'object' || Array.isArray(release)) {
    throw new Error(`${label} must be an object`);
  }
  const urls = [];
  const add = (url, role, logicalName, required = false) => {
    if (!artifactRoles.has(role)) {
      throw new Error(`${label} has an unknown artifact role: ${role}`);
    }
    if (url === undefined || url === null || url === '') {
      if (required) {
        throw new Error(`${label}.${role} URL is required`);
      }
      return;
    }
    urls.push({
      url: assertHttpsUrl(url, `${label}.${role}`),
      role,
      logicalName,
    });
  };
  const components = release.components ?? {};
  if (
    !components ||
    typeof components !== 'object' ||
    Array.isArray(components)
  ) {
    throw new Error(`${label}.components must be an object`);
  }
  if (field === 'ble') {
    if (Object.hasOwn(release, 'webUpdate')) {
      add(release.webUpdate, 'ble', undefined, true);
    } else {
      add(release.url, 'ble', undefined, true);
    }
  } else {
    if (Object.keys(components).length === 0) {
      add(release.url, 'firmware', undefined, true);
    }
    add(release.bootloaderResource, 'bootloader');
    add(release.resource, 'resource');
    add(release.fullResource, 'fullResource');
  }
  for (const [logicalName, component] of Object.entries(components)) {
    if (!component || typeof component !== 'object') {
      throw new Error(`${label}.components.${logicalName} must be an object`);
    }
    add(component.url, 'component', logicalName, true);
  }
  const bundles = release.resourceBundles ?? [];
  if (!Array.isArray(bundles)) {
    throw new Error(`${label}.resourceBundles must be an array`);
  }
  for (const [index, bundle] of bundles.entries()) {
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
      throw new Error(`${label}.resourceBundles[${index}] must be an object`);
    }
    add(
      bundle.url,
      'resourceBundle',
      typeof bundle.name === 'string' && bundle.name ? bundle.name : undefined,
      true,
    );
  }
  return urls;
}

function selectConfig(manifest, channel) {
  const config = createEmptyConfig();
  const artifacts = new Map();
  for (const [model, fields] of Object.entries(selectedFields[channel])) {
    const sourceDevice = manifest[model];
    if (!sourceDevice || typeof sourceDevice !== 'object') {
      throw new Error(`Manifest is missing ${channel}.${model}`);
    }
    for (const field of fields) {
      const releases = sourceDevice[field];
      if (!Array.isArray(releases)) {
        throw new Error(`Manifest is missing ${channel}.${model}.${field}`);
      }
      if (releases.length === 0) {
        throw new Error(
          `Manifest has no releases for ${channel}.${model}.${field}`,
        );
      }
      config[model][field] = structuredClone(releases);
      const releaseIdentities = new Set();
      for (const [index, release] of config[model][field].entries()) {
        const label = `${channel}.${model}.${field}[${index}]`;
        const releaseIdentity = getReleaseIdentity(release, label);
        if (releaseIdentities.has(releaseIdentity)) {
          throw new Error(
            `Manifest has a duplicate release for ${channel}.${model}.${field}: ${releaseIdentity}`,
          );
        }
        releaseIdentities.add(releaseIdentity);
        for (const artifact of collectReleaseUrls(release, field, label)) {
          const existing = artifacts.get(artifact.url);
          if (
            existing &&
            (existing.role !== artifact.role ||
              existing.logicalName !== artifact.logicalName)
          ) {
            throw new Error(
              `Artifact URL has conflicting roles: ${artifact.url}`,
            );
          }
          artifacts.set(artifact.url, artifact);
        }
      }
    }
  }
  return { config, artifacts };
}

async function downloadToFileOnce(url, filePath) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Unable to fetch ${url}: HTTP ${response.status}`);
  }
  let total = 0;
  const limiter = new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxArtifactBytes) {
        throw new Error(`Artifact exceeds the byte limit: ${url}`);
      }
      controller.enqueue(chunk);
    },
  });
  await pipeline(
    response.body.pipeThrough(limiter),
    createWriteStream(filePath, { flags: 'wx' }),
  );
  return filePath;
}

async function downloadToFile(url, directory) {
  const filePath = join(
    directory,
    `${sha256(url).slice(0, 20)}-${basename(new URL(url).pathname)}`,
  );
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await downloadToFileOnce(url, filePath);
    } catch (error) {
      lastError = error;
      await rm(filePath, { force: true });
    }
  }
  if (lastError instanceof Error) {
    throw new Error(lastError.message, { cause: lastError });
  }
  throw new Error(`Unable to download ${url}`);
}

function openZip(filePath) {
  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(
      filePath,
      {
        autoClose: false,
        lazyEntries: true,
        strictFileNames: true,
        validateEntrySizes: true,
      },
      (error, zipFile) => {
        if (error || !zipFile) {
          rejectPromise(error ?? new Error('Unable to open ZIP'));
        } else {
          resolvePromise(zipFile);
        }
      },
    );
  });
}

function openEntry(zipFile, entry) {
  return new Promise((resolvePromise, rejectPromise) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        rejectPromise(error ?? new Error('Unable to read ZIP entry'));
      } else {
        stream.pause();
        resolvePromise(stream);
      }
    });
  });
}

async function inspectArchive(filePath, artifactSha) {
  const zipFile = await openZip(filePath);
  try {
    if (zipFile.entryCount <= 0 || zipFile.entryCount > maxEntries) {
      throw new Error('Archive entry count is outside the trusted limits');
    }
    const entries = [];
    while (entries.length < zipFile.entryCount) {
      const entry = await new Promise((resolvePromise, rejectPromise) => {
        const onEntry = (value) => {
          cleanup();
          resolvePromise(value);
        };
        const onError = (error) => {
          cleanup();
          rejectPromise(error);
        };
        const onEnd = () => {
          cleanup();
          rejectPromise(
            new Error(
              `Archive ended after ${entries.length} of ${zipFile.entryCount} entries`,
            ),
          );
        };
        const cleanup = () => {
          zipFile.off('entry', onEntry);
          zipFile.off('error', onError);
          zipFile.off('end', onEnd);
        };
        zipFile.once('entry', onEntry);
        zipFile.once('error', onError);
        zipFile.once('end', onEnd);
        zipFile.readEntry();
      });
      if (
        entry.fileName.endsWith('/') ||
        entry.uncompressedSize <= 0 ||
        entry.uncompressedSize > 128 * 1024 * 1024
      ) {
        throw new Error(
          `Archive contains a forbidden entry: ${entry.fileName}`,
        );
      }
      const stream = await openEntry(zipFile, entry);
      const digest = createHash('sha256');
      let actualSize = 0;
      await new Promise((resolvePromise, rejectPromise) => {
        stream.on('data', (chunk) => {
          actualSize += chunk.byteLength;
          if (actualSize > entry.uncompressedSize) {
            stream.destroy(
              new Error(
                `Archive entry exceeds its declared size: ${entry.fileName}`,
              ),
            );
            return;
          }
          digest.update(chunk);
        });
        stream.once('end', resolvePromise);
        stream.once('error', rejectPromise);
        stream.resume();
      });
      if (actualSize !== entry.uncompressedSize) {
        throw new Error(`Archive entry has a short read: ${entry.fileName}`);
      }
      entries.push({
        artifactId: `fw-entry-${artifactSha.slice(0, 16)}-${entries.length}`,
        entryName: entry.fileName,
        expectedSize: actualSize,
        expectedSha256: digest.digest('hex'),
      });
    }
    return entries;
  } finally {
    zipFile.close();
  }
}

async function inspectArtifact(artifact, directory) {
  console.log(`Inspecting ${artifact.url}`);
  const filePath = await downloadToFile(artifact.url, directory);
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
  }
  const artifactSha = digest.digest('hex');
  const info = await stat(filePath);
  const isArchive = archiveSuffixes.has(
    artifact.url.slice(artifact.url.lastIndexOf('.')).toLowerCase(),
  );
  const result = {
    url: artifact.url,
    role: artifact.role,
    ...(artifact.logicalName ? { logicalName: artifact.logicalName } : {}),
    expectedSize: info.size,
    expectedSha256: artifactSha,
    container: isArchive ? 'zip' : 'raw',
    ...(isArchive
      ? { expectedEntries: await inspectArchive(filePath, artifactSha) }
      : {}),
  };
  console.log(`Verified ${artifact.url}`);
  return result;
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index], index);
      }
    }),
  );
  return results;
}

function applyArtifactFacts(config, factsByUrl) {
  const getFact = (url) => {
    const fact = url ? factsByUrl[url] : undefined;
    if (!fact) {
      throw new Error(`Missing trusted artifact for ${url}`);
    }
    return fact;
  };
  for (const device of Object.values(config)) {
    for (const [field, releases] of Object.entries(device)) {
      if (Array.isArray(releases)) {
        for (const release of releases) {
          const primaryUrl =
            field === 'ble' ? release.webUpdate || release.url : release.url;
          if (primaryUrl) {
            const fact = getFact(primaryUrl);
            release.fingerprint = fact.expectedSha256;
            release.expectedSize = fact.expectedSize;
            if (field === 'ble') {
              release.fingerprintWeb = fact.expectedSha256;
            }
          }
          for (const [urlField, sizeField, fingerprintField] of [
            [
              'bootloaderResource',
              'bootloaderExpectedSize',
              'bootloaderFingerprint',
            ],
            ['resource', 'resourceExpectedSize', 'resourceFingerprint'],
            [
              'fullResource',
              'fullResourceExpectedSize',
              'fullResourceFingerprint',
            ],
          ]) {
            const url = release[urlField];
            if (url) {
              const fact = getFact(url);
              release[sizeField] = fact.expectedSize;
              release[fingerprintField] = fact.expectedSha256;
            }
          }
          for (const item of [
            ...Object.values(release.components ?? {}),
            ...Object.values(release.resourceBundles ?? {}),
          ]) {
            if (item?.url) {
              const fact = getFact(item.url);
              item.fingerprint = fact.expectedSha256;
              item.expectedSize = fact.expectedSize;
            }
          }
        }
      }
    }
  }
}

async function main() {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'onekey-firmware-catalog-'),
  );
  try {
    const stableBytes = await fetchBytes(sources.stable);
    const preReleaseBytes = await fetchBytes(sources.preRelease);
    const stable = selectConfig(JSON.parse(stableBytes), 'stable');
    const preRelease = selectConfig(JSON.parse(preReleaseBytes), 'preRelease');
    const candidates = [
      ...new Map(
        [...stable.artifacts, ...preRelease.artifacts].map(([url, value]) => [
          url,
          value,
        ]),
      ).values(),
    ];
    const inspected = await mapWithConcurrency(candidates, 4, (artifact) =>
      inspectArtifact(artifact, temporaryDirectory),
    );
    const factsByUrl = Object.fromEntries(
      inspected
        .toSorted((left, right) => left.url.localeCompare(right.url))
        .map((artifact) => [artifact.url, artifact]),
    );
    applyArtifactFacts(stable.config, factsByUrl);
    applyArtifactFacts(preRelease.config, factsByUrl);
    const metadata = {
      schemaVersion: 1,
      generatedAt,
      sourceDigests: {
        stable: sha256(stableBytes),
        preRelease: sha256(preReleaseBytes),
      },
      unsupportedLegacyPaths: [
        'stable.touch.firmware',
        'stable.touch.firmware-v2',
      ],
    };
    const artifactLines = Object.entries(factsByUrl)
      .map(
        ([url, artifact]) =>
          `  ${JSON.stringify(url)}: ${JSON.stringify(artifact)}`,
      )
      .join(',\n');
    const content = `/* eslint-disable */\n// Generated by development/scripts/firmware/generateFirmwareCatalog.mjs.\n// Review the generator and the complete catalog facts. Do not edit this file manually.\n\nimport type { RemoteConfigResponse } from '@onekeyfe/hd-core';\n\nexport const trustedFirmwareCatalog = {\n  metadata: ${JSON.stringify(
      metadata,
    )},\n  stableConfig: ${JSON.stringify(
      stable.config,
    )},\n  preReleaseConfig: ${JSON.stringify(
      preRelease.config,
    )},\n  artifactsByUrl: {\n${artifactLines}\n  },\n} as const;\n\nexport const trustedStableFirmwareConfig = trustedFirmwareCatalog.stableConfig as unknown as RemoteConfigResponse;\nexport const trustedPreReleaseFirmwareConfig = trustedFirmwareCatalog.preReleaseConfig as unknown as RemoteConfigResponse;\n`;
    const stagingPath = `${outputPath}.tmp`;
    await writeFile(stagingPath, content);
    await rename(stagingPath, outputPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.env.FIRMWARE_CATALOG_SKIP_MAIN !== '1') {
  await main();
}

export { assertHttpsUrl, collectReleaseUrls, selectConfig };
