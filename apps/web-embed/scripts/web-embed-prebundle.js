#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words prebundle */

const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const WEB_EMBED_ROOT = path.resolve(__dirname, '..');
const SCHEMA_VERSION = 1;
const RELEASE_SCHEMA_VERSION = 1;
const OCI_ARTIFACT_TYPE = 'application/vnd.onekey.web-embed-prebundle.v1';
const OCI_REGISTRY = 'ghcr.io';
const OCI_REPOSITORY = 'onekeyhq/web-embed-prebundle';
const SOURCE_REPOSITORY = 'OneKeyHQ/app-monorepo';
const RELEASE_TAG_PREFIX = `web-embed-prebundle-v${RELEASE_SCHEMA_VERSION}`;
const ARCHIVE_NAME = 'web-embed.tar.gz';
const RELEASE_MANIFEST_NAME = 'web-embed-prebundle-release.json';
const ATTESTATION_BUNDLE_NAME = 'web-embed-prebundle-attestations.jsonl';
const SIGNER_WORKFLOW =
  'OneKeyHQ/app-monorepo/.github/workflows/web-embed-prebundle.yml';
const TRUSTED_ROOT_PATH = path.join(
  REPO_ROOT,
  'apps/mobile/bundle-registry/metro-dev-prebundle-trusted-root.jsonl',
);
const INPUT_PATHS = [
  '.env.expo',
  '.env.version',
  'apps/web-embed',
  'development',
  'package.json',
  'packages/components',
  'packages/core',
  'packages/kit',
  'packages/kit-bg',
  'packages/shared',
  'patches',
  'yarn.lock',
];
const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.tamagui',
  'build',
  'dist',
  'node_modules',
  'out-dir-bundle',
  'web-build',
]);

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function toRepoPath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

function listFiles(inputPaths = INPUT_PATHS) {
  const files = [];
  const visit = (absolutePath) => {
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink() || stat.isFile()) {
      files.push(absolutePath);
      return;
    }
    if (!stat.isDirectory()) {
      throw new Error(`[webEmbedPrebundle] Unsupported input: ${absolutePath}`);
    }
    for (const entry of fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .toSorted((left, right) => compareStrings(left.name, right.name))) {
      if (!(entry.isDirectory() && EXCLUDED_DIRECTORY_NAMES.has(entry.name))) {
        visit(path.join(absolutePath, entry.name));
      }
    }
  };
  for (const relativePath of inputPaths) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[webEmbedPrebundle] Hash input is missing: ${relativePath}`,
      );
    }
    visit(absolutePath);
  }
  return files.toSorted((left, right) =>
    compareStrings(toRepoPath(left), toRepoPath(right)),
  );
}

function hashFiles(absolutePaths, root = REPO_ROOT) {
  const hash = crypto.createHash('sha256');
  for (const absolutePath of absolutePaths) {
    const stat = fs.lstatSync(absolutePath);
    const relativePath = path
      .relative(root, absolutePath)
      .split(path.sep)
      .join('/');
    hash.update(relativePath);
    hash.update('\0');
    if (stat.isSymbolicLink()) {
      hash.update('symlink\0');
      hash.update(fs.readlinkSync(absolutePath));
    } else {
      hash.update(stat.mode & 0o111 ? 'executable\0' : 'file\0');
      hash.update(fs.readFileSync(absolutePath));
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

function getInputKey() {
  const hash = crypto.createHash('sha256');
  hash.update(`schema:${SCHEMA_VERSION}\0`);
  hash.update(hashFiles(listFiles()));
  return hash.digest('hex');
}

function getReleaseTag() {
  return `${RELEASE_TAG_PREFIX}-${getInputKey()}`;
}

function getReleaseDirectory() {
  return path.join(
    WEB_EMBED_ROOT,
    'out-dir-bundle/web-embed-prebundle-release',
  );
}

function assertSourceCommit(sourceCommit) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit || '')) {
    throw new Error(
      '[webEmbedPrebundle] --source-commit must be a 40-character commit SHA.',
    );
  }
  return sourceCommit;
}

function assertWebBuildDirectory(webBuildDirectory) {
  const resolved = path.resolve(webBuildDirectory);
  if (resolved !== path.join(WEB_EMBED_ROOT, 'web-build')) {
    throw new Error(
      `[webEmbedPrebundle] Build input must be ${path.join(WEB_EMBED_ROOT, 'web-build')}.`,
    );
  }
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      '[webEmbedPrebundle] web-build is not a regular directory.',
    );
  }
  return resolved;
}

function listOutputFiles(outputDirectory) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .toSorted((left, right) => compareStrings(left.name, right.name))) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `[webEmbedPrebundle] Symlinks are not allowed in web-build: ${absolutePath}`,
        );
      }
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
      else {
        throw new Error(
          `[webEmbedPrebundle] Unsupported web-build entry: ${absolutePath}`,
        );
      }
    }
  };
  visit(outputDirectory);
  if (files.length === 0) {
    throw new Error('[webEmbedPrebundle] web-build is empty.');
  }
  return files;
}

function getFileMetadata(filePath) {
  const content = fs.readFileSync(filePath);
  return {
    bytes: content.length,
    file: path.basename(filePath),
    sha256: sha256(content),
  };
}

async function createArchive({ archivePath, webBuildDirectory }) {
  const tar = require('tar');
  const relativeFiles = listOutputFiles(webBuildDirectory)
    .map((filePath) =>
      path.relative(webBuildDirectory, filePath).split(path.sep).join('/'),
    )
    .toSorted();
  await tar.create(
    {
      cwd: webBuildDirectory,
      file: archivePath,
      gzip: true,
      mtime: new Date(0),
      noMtime: false,
      portable: true,
      prefix: 'web-embed',
    },
    relativeFiles,
  );
}

async function packageRelease({ outputDirectory, sourceCommit }) {
  const releaseDirectory = path.resolve(
    outputDirectory || getReleaseDirectory(),
  );
  const allowedRoot = path.join(WEB_EMBED_ROOT, 'out-dir-bundle');
  const relativeOutput = path.relative(allowedRoot, releaseDirectory);
  if (
    !relativeOutput ||
    relativeOutput === '..' ||
    relativeOutput.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeOutput)
  ) {
    throw new Error(
      `[webEmbedPrebundle] Release output must be inside ${allowedRoot}.`,
    );
  }
  const webBuildDirectory = assertWebBuildDirectory(
    path.join(WEB_EMBED_ROOT, 'web-build'),
  );
  const outputTreeDigest = hashFiles(
    listOutputFiles(webBuildDirectory),
    webBuildDirectory,
  );
  await fs.promises.rm(releaseDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(releaseDirectory, { recursive: true });
  const archivePath = path.join(releaseDirectory, ARCHIVE_NAME);
  await createArchive({ archivePath, webBuildDirectory });
  const inputKey = getInputKey();
  const releaseManifest = {
    archive: getFileMetadata(archivePath),
    artifactRepository: `${OCI_REGISTRY}/${OCI_REPOSITORY}`,
    inputKey,
    outputTreeDigest,
    repository: SOURCE_REPOSITORY,
    schemaVersion: RELEASE_SCHEMA_VERSION,
    sourceCommit: assertSourceCommit(sourceCommit),
    tagName: `${RELEASE_TAG_PREFIX}-${inputKey}`,
  };
  await fs.promises.writeFile(
    path.join(releaseDirectory, RELEASE_MANIFEST_NAME),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
  );
  return releaseManifest;
}

function parseManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expectedInputKey = getInputKey();
  if (
    manifest?.schemaVersion !== RELEASE_SCHEMA_VERSION ||
    manifest.artifactRepository !== `${OCI_REGISTRY}/${OCI_REPOSITORY}` ||
    manifest.repository !== SOURCE_REPOSITORY ||
    manifest.inputKey !== expectedInputKey ||
    manifest.tagName !== `${RELEASE_TAG_PREFIX}-${expectedInputKey}` ||
    !/^[0-9a-f]{40}$/.test(manifest.sourceCommit || '') ||
    !/^[0-9a-f]{64}$/.test(manifest.outputTreeDigest || '') ||
    manifest.archive?.file !== ARCHIVE_NAME ||
    !Number.isSafeInteger(manifest.archive?.bytes) ||
    manifest.archive.bytes <= 0 ||
    !/^[0-9a-f]{64}$/.test(manifest.archive?.sha256 || '')
  ) {
    throw new Error(
      '[webEmbedPrebundle] Release manifest is incompatible with this checkout.',
    );
  }
  return manifest;
}

async function run(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    throw new Error(
      `[webEmbedPrebundle] Command failed: ${command} ${args.slice(0, 2).join(' ')}`,
      { cause: error },
    );
  }
}

async function verifyOciManifest(reference) {
  const [{ stdout }, { stdout: descriptorText }] = await Promise.all([
    run('oras', ['manifest', 'fetch', reference]),
    run('oras', ['manifest', 'fetch', '--descriptor', reference]),
  ]);
  const manifest = JSON.parse(stdout);
  const descriptor = JSON.parse(descriptorText);
  const titles = manifest.layers
    ?.map((layer) => layer.annotations?.['org.opencontainers.image.title'])
    .toSorted();
  const expectedTitles = [
    ARCHIVE_NAME,
    ATTESTATION_BUNDLE_NAME,
    RELEASE_MANIFEST_NAME,
  ].toSorted();
  if (
    manifest.schemaVersion !== 2 ||
    manifest.artifactType !== OCI_ARTIFACT_TYPE ||
    manifest.annotations?.['org.opencontainers.image.source'] !==
      `https://github.com/${SOURCE_REPOSITORY}` ||
    JSON.stringify(titles) !== JSON.stringify(expectedTitles)
  ) {
    throw new Error('[webEmbedPrebundle] Invalid OCI artifact manifest.');
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(descriptor.digest || '')) {
    throw new Error('[webEmbedPrebundle] Invalid OCI artifact digest.');
  }
  return descriptor.digest;
}

async function verifyAttestations(pullDirectory, sourceCommit) {
  const bundlePath = path.join(pullDirectory, ATTESTATION_BUNDLE_NAME);
  for (const fileName of [ARCHIVE_NAME, RELEASE_MANIFEST_NAME]) {
    await run('gh', [
      'attestation',
      'verify',
      path.join(pullDirectory, fileName),
      '--repo',
      SOURCE_REPOSITORY,
      '--bundle',
      bundlePath,
      '--custom-trusted-root',
      TRUSTED_ROOT_PATH,
      '--signer-workflow',
      SIGNER_WORKFLOW,
      '--source-ref',
      'refs/heads/x',
      '--source-digest',
      sourceCommit,
      '--deny-self-hosted-runners',
    ]);
  }
}

async function extractArchive({ archivePath, outputDirectory }) {
  const tar = require('tar');
  const temporaryDirectory = `${outputDirectory}.tmp-${process.pid}`;
  await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(temporaryDirectory, { recursive: true });
  try {
    await tar.extract({
      cwd: temporaryDirectory,
      file: archivePath,
      filter(entryPath, entry) {
        const normalized = path.posix.normalize(entryPath);
        const isSafe =
          normalized.startsWith('web-embed/') &&
          !normalized.includes('/../') &&
          !path.posix.isAbsolute(normalized) &&
          !entry.isSymbolicLink() &&
          !entry.isLink();
        if (!isSafe) {
          throw new Error(
            `[webEmbedPrebundle] Unsafe archive entry: ${entryPath}`,
          );
        }
        return true;
      },
      preservePaths: false,
      strict: true,
    });
    const extractedDirectory = path.join(temporaryDirectory, 'web-embed');
    const digest = hashFiles(
      listOutputFiles(extractedDirectory),
      extractedDirectory,
    );
    return { digest, extractedDirectory, temporaryDirectory };
  } catch (error) {
    await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
    throw error;
  }
}

async function replaceDirectory({
  extractedDirectory,
  outputDirectory,
  temporaryDirectory,
}) {
  const previousDirectory = `${outputDirectory}.previous-${process.pid}`;
  await fs.promises.rm(previousDirectory, { force: true, recursive: true });
  if (fs.existsSync(outputDirectory)) {
    await fs.promises.rename(outputDirectory, previousDirectory);
  }
  try {
    await fs.promises.rename(extractedDirectory, outputDirectory);
    await fs.promises.rm(previousDirectory, { force: true, recursive: true });
    await fs.promises.rm(temporaryDirectory, { force: true, recursive: true });
  } catch (error) {
    if (fs.existsSync(previousDirectory) && !fs.existsSync(outputDirectory)) {
      await fs.promises.rename(previousDirectory, outputDirectory);
    }
    throw error;
  }
}

async function restoreRelease({ outputDirectory }) {
  const tagName = getReleaseTag();
  const reference = `${OCI_REGISTRY}/${OCI_REPOSITORY}:${tagName}`;
  const pullDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'onekey-web-embed-prebundle-'),
  );
  try {
    const ociDigest = await verifyOciManifest(reference);
    await run('oras', ['pull', '--output', pullDirectory, reference]);
    const manifest = parseManifest(
      path.join(pullDirectory, RELEASE_MANIFEST_NAME),
    );
    await verifyAttestations(pullDirectory, manifest.sourceCommit);
    const archivePath = path.join(pullDirectory, ARCHIVE_NAME);
    const archiveMetadata = getFileMetadata(archivePath);
    if (
      archiveMetadata.bytes !== manifest.archive.bytes ||
      archiveMetadata.sha256 !== manifest.archive.sha256
    ) {
      throw new Error('[webEmbedPrebundle] Archive integrity mismatch.');
    }
    const resolvedOutput = path.resolve(
      outputDirectory || path.join(WEB_EMBED_ROOT, 'web-build'),
    );
    const extracted = await extractArchive({
      archivePath,
      outputDirectory: resolvedOutput,
    });
    if (extracted.digest !== manifest.outputTreeDigest) {
      await fs.promises.rm(extracted.temporaryDirectory, {
        force: true,
        recursive: true,
      });
      throw new Error(
        '[webEmbedPrebundle] Restored output tree digest mismatch.',
      );
    }
    await replaceDirectory({ ...extracted, outputDirectory: resolvedOutput });
    await writeJson(
      path.join(
        WEB_EMBED_ROOT,
        'out-dir-bundle/web-embed-prebundle-restored.json',
      ),
      { ...manifest, ociDigest, reference },
    );
    return manifest;
  } finally {
    await fs.promises.rm(pullDirectory, { force: true, recursive: true });
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!['input-key', 'package', 'restore', 'tag'].includes(command)) {
    throw new Error(
      'Usage: web-embed-prebundle.js <input-key|tag|package|restore> [--output <path>] [--source-commit <sha>]',
    );
  }
  let outputDirectory;
  let sourceCommit;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--output') {
      outputDirectory = argv[index + 1];
      index += 1;
    } else if (argument === '--source-commit') {
      sourceCommit = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`[webEmbedPrebundle] Unknown argument: ${argument}`);
    }
  }
  return { command, outputDirectory, sourceCommit };
}

async function main() {
  const args = parseArgs();
  if (args.command === 'input-key') {
    process.stdout.write(`${getInputKey()}\n`);
  } else if (args.command === 'tag') {
    process.stdout.write(`${getReleaseTag()}\n`);
  } else if (args.command === 'package') {
    const manifest = await packageRelease(args);
    console.log(
      `[webEmbedPrebundle] packaged tag=${manifest.tagName} outputTree=${manifest.outputTreeDigest}`,
    );
  } else {
    const manifest = await restoreRelease(args);
    console.log(
      `[webEmbedPrebundle] restored tag=${manifest.tagName} outputTree=${manifest.outputTreeDigest}`,
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  ARCHIVE_NAME,
  ATTESTATION_BUNDLE_NAME,
  OCI_ARTIFACT_TYPE,
  OCI_REGISTRY,
  OCI_REPOSITORY,
  RELEASE_MANIFEST_NAME,
  getInputKey,
  getReleaseTag,
  hashFiles,
  listFiles,
  packageRelease,
  parseManifest,
};
