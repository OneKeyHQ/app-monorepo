import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const workspace = await fs.realpath(
  process.argv[process.argv.indexOf('--workspace') + 1],
);

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function relative(file) {
  return path.relative(workspace, file).split(path.sep).join('/');
}

async function workspaceFile(file, label) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file)) {
    throw new Error(`${label} must be a relative workspace file`);
  }
  const candidate = path.resolve(workspace, file);
  const candidateRelative = path.relative(workspace, candidate);
  if (
    !candidateRelative ||
    candidateRelative === '..' ||
    candidateRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(candidateRelative)
  ) {
    throw new Error(`${label} escapes the selected workspace`);
  }
  const resolved = await fs.realpath(candidate);
  const resolvedRelative = path.relative(workspace, resolved);
  if (
    !resolvedRelative ||
    resolvedRelative === '..' ||
    resolvedRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(resolvedRelative)
  ) {
    throw new Error(`${label} escapes the selected workspace`);
  }
  return resolved;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}

function parseProtocols(registryText, source, registrySha256) {
  const value = JSON.parse(registryText);
  const seenHostnames = new Set();
  return (Array.isArray(value.protocols) ? value.protocols : []).flatMap(
    (protocol) => {
      const id = String(protocol?.id || '').trim();
      const override = String(protocol?.target?.urlOverride || '');
      const resolved = String(protocol?.target?.resolvedDappUrl || '');
      const registryUrl = String(protocol?.sourceUrl || '');
      const url = override || resolved || registryUrl;
      if (!id || !safeUrl(url)) return [];
      const hostname = new URL(url).hostname.replace(/^www\./u, '');
      if (seenHostnames.has(hostname)) return [];
      seenHostnames.add(hostname);
      const state = ['processed', 'unsupported'].includes(
        protocol?.manualReview?.state,
      )
        ? protocol.manualReview.state
        : 'pending';
      const totalTvl = Number(protocol?.totalTvl);
      const bestRank = protocol?.priority?.bestRank;
      return [
        {
          key: `${source}:${id}`,
          source,
          id,
          name: String(protocol?.name || protocol?.slug || id),
          slug: String(protocol?.slug || protocol?.name || id),
          url,
          urlSource: override ? 'override' : resolved ? 'resolved' : 'registry',
          registryUrl: safeUrl(registryUrl) ? registryUrl : null,
          registrySha256,
          totalTvl: Number.isFinite(totalTvl) && totalTvl > 0 ? totalTvl : 0,
          bestRank:
            bestRank !== null &&
            bestRank !== undefined &&
            Number.isFinite(Number(bestRank))
              ? Number(bestRank)
              : null,
          manualReview: {
            state,
            reviewedAt: protocol?.manualReview?.reviewedAt || null,
            reviewedUrl: protocol?.manualReview?.reviewedUrl || null,
            injectedBundleSha256:
              protocol?.manualReview?.injectedBundleSha256 || null,
          },
        },
      ];
    },
  );
}

try {
  const manifestFile = await workspaceFile(
    'onekey-app-custom-injected.json',
    'Custom injection manifest',
  );
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  const sourceManifests =
    manifest.schemaVersion === 2
      ? [
          {
            source: manifest.dappSource,
            protocolRegistry: manifest.protocolRegistry,
            registryUpdater: manifest.registryUpdater,
            registryRefresher: manifest.registryRefresher,
          },
        ]
      : manifest.protocolSources;
  const sourceNames = new Set();
  for (const sourceManifest of sourceManifests || []) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(sourceManifest?.source || '') ||
      sourceNames.has(sourceManifest.source)
    ) {
      throw new Error(
        'Custom injection manifest protocol source must be unique and normalized',
      );
    }
    sourceNames.add(sourceManifest.source);
  }
  const protocolSources = await Promise.all(
    sourceManifests.map(async (sourceManifest) => {
      const registryFile = await workspaceFile(
        sourceManifest.protocolRegistry,
        `${sourceManifest.source}.protocolRegistry`,
      );
      const updaterFile = await workspaceFile(
        sourceManifest.registryUpdater,
        `${sourceManifest.source}.registryUpdater`,
      );
      const refresherFile = sourceManifest.registryRefresher
        ? await workspaceFile(
            sourceManifest.registryRefresher,
            `${sourceManifest.source}.registryRefresher`,
          )
        : null;
      const registryText = await fs.readFile(registryFile, 'utf8');
      const registrySha256 = digest(registryText);
      return {
        source: sourceManifest.source,
        protocolRegistry: relative(registryFile),
        registryUpdater: relative(updaterFile),
        registryRefresher: refresherFile ? relative(refresherFile) : null,
        registrySha256,
        protocols: parseProtocols(
          registryText,
          sourceManifest.source,
          registrySha256,
        ),
      };
    }),
  );
  const preloadFile = await workspaceFile(
    manifest.desktopPreload,
    'desktopPreload',
  );
  const generatorFile = manifest.recordingE2EGenerator
    ? await workspaceFile(
        manifest.recordingE2EGenerator,
        'recordingE2EGenerator',
      )
    : null;
  const registrySha256 =
    protocolSources.length === 1
      ? protocolSources[0].registrySha256
      : digest(
          JSON.stringify(
            protocolSources.map((source) => [
              source.source,
              source.registrySha256,
            ]),
          ),
        );
  const result = {
    schemaVersion: 1,
    kind: 'onekey-custom-injection-workspace-snapshot',
    workspace,
    manifest: relative(manifestFile),
    desktopPreload: relative(preloadFile),
    dappsDirectory: manifest.dappsDirectory,
    recordingE2EGenerator: generatorFile ? relative(generatorFile) : null,
    registrySha256,
    bundleSha256: digest(await fs.readFile(preloadFile)),
    protocolSources: protocolSources.map(
      ({ protocols: _protocols, ...source }) => source,
    ),
    protocols: protocolSources.flatMap((source) => source.protocols),
  };
  process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 4;
}
