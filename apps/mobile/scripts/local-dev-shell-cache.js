/* eslint-disable onekey/no-raw-error */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_ROOT = path.resolve(
  __dirname,
  '../out-dir-bundle/dev-shell/local-cache',
);
const BUILD_INPUT_FILES = [
  'build-mobile-dev-shell.js',
  'mobile-dev-shell-resource.js',
];

function getPaths(compatibility, cacheRoot) {
  if (
    !['ios', 'android'].includes(compatibility.platform) ||
    !/^[0-9a-f]{64}$/u.test(compatibility.shellInputKey) ||
    !/^OneKeyWallet-DevShell-[A-Za-z0-9.-]+\.(zip|apk)$/u.test(
      compatibility.artifactFile,
    )
  )
    throw new Error('[localDevShellCache] Invalid shell compatibility.');
  const directory = path.join(cacheRoot, compatibility.platform);
  return {
    directory,
    artifactPath: path.join(directory, compatibility.artifactFile),
    receiptPath: path.join(directory, 'receipt.json'),
  };
}

function getBuildDigest(
  platform,
  { repoRoot = path.resolve(__dirname, '../../..') } = {},
) {
  const { getNativeContractInputPaths } = require('../plugins/devVendor');
  const inputFiles = [
    ...BUILD_INPUT_FILES.map((name) => `apps/mobile/scripts/${name}`),
    ...getNativeContractInputPaths(platform, repoRoot),
    ...(platform === 'ios'
      ? [
          'apps/mobile/ios/OneKeyWallet.xcodeproj/project.pbxproj',
          'apps/mobile/ios/OneKeyWallet/OneKeyWallet.entitlements',
          'apps/mobile/ios/Podfile',
        ]
      : []),
  ];
  const hash = crypto.createHash('sha256');
  for (const name of [...new Set(inputFiles)].toSorted()) {
    hash.update(name);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(repoRoot, name)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function getArtifactMetadata(artifactPath) {
  const stat = await fs.promises.lstat(artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) {
    throw new Error(
      '[localDevShellCache] Expected a nonempty regular archive.',
    );
  }
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(artifactPath))
    hash.update(chunk);
  return { bytes: stat.size, sha256: hash.digest('hex') };
}

async function readLocalShellCache({ compatibility, cacheRoot = CACHE_ROOT }) {
  const { artifactPath, receiptPath } = getPaths(compatibility, cacheRoot);
  try {
    const receipt = JSON.parse(await fs.promises.readFile(receiptPath, 'utf8'));
    if (
      receipt.schemaVersion !== 1 ||
      receipt.shellInputKey !== compatibility.shellInputKey ||
      receipt.buildDigest !== getBuildDigest(compatibility.platform)
    )
      return undefined;
    const metadata = await getArtifactMetadata(artifactPath);
    if (metadata.bytes !== receipt.bytes || metadata.sha256 !== receipt.sha256)
      return undefined;
    return { artifactPath, source: 'local-cache' };
  } catch {
    return undefined;
  }
}

async function cacheLocalShellBuild({
  artifactPath,
  compatibility,
  cacheRoot = CACHE_ROOT,
  buildDigest = getBuildDigest(compatibility.platform),
}) {
  if (buildDigest !== getBuildDigest(compatibility.platform)) return;
  const paths = getPaths(compatibility, cacheRoot);
  await fs.promises.mkdir(paths.directory, { recursive: true });
  const suffix = `.tmp-${process.pid}-${crypto.randomUUID()}`;
  const temporaryArtifact = `${paths.artifactPath}${suffix}`;
  const temporaryReceipt = `${paths.receiptPath}${suffix}`;
  try {
    await fs.promises.copyFile(artifactPath, temporaryArtifact);
    const metadata = await getArtifactMetadata(temporaryArtifact);
    await fs.promises.writeFile(
      temporaryReceipt,
      `${JSON.stringify(
        {
          ...metadata,
          schemaVersion: 1,
          shellInputKey: compatibility.shellInputKey,
          buildDigest,
        },
        null,
        2,
      )}\n`,
      { flag: 'wx' },
    );
    // The launcher holds the worktree preparation lock while reading or replacing this cache.
    await fs.promises.rename(temporaryArtifact, paths.artifactPath);
    await fs.promises.rename(temporaryReceipt, paths.receiptPath);
  } finally {
    await fs.promises.rm(temporaryArtifact, { force: true });
    await fs.promises.rm(temporaryReceipt, { force: true });
  }
}

async function getIosSigningCacheOptions({
  artifactPath,
  cacheRoot = path.join(CACHE_ROOT, 'signed'),
}) {
  const { sha256 } = await getArtifactMetadata(artifactPath);
  return {
    cacheRoot: path.join(cacheRoot, sha256),
    compatibility: {
      artifactFile: 'OneKeyWallet-DevShell-ios-simulator-arm64.zip',
      platform: 'ios',
      // A repaired archive belongs to exactly one original artifact, not just its ABI.
      shellInputKey: sha256,
    },
  };
}

module.exports = {
  cacheLocalShellBuild,
  getBuildDigest,
  getIosSigningCacheOptions,
  readLocalShellCache,
};
