#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
/* cspell:words POSTBUILD prebundle */

const { execFile, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const { builtinModules } = require('module');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const babelParser = require('@babel/parser');
const enhancedResolve = require('enhanced-resolve');

const {
  createBaseResolveOptions,
} = require('../../../development/rspack/rspack.resolve.config');

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const WEB_EMBED_ROOT = path.resolve(__dirname, '..');
const SCHEMA_VERSION = 2;
const RELEASE_SCHEMA_VERSION = 1;
const OCI_ARTIFACT_TYPE = 'application/vnd.onekey.web-embed-prebundle.v1';
const OCI_MANIFEST_MEDIA_TYPE = 'application/vnd.oci.image.manifest.v1+json';
const OCI_REGISTRY = 'ghcr.io';
const OCI_REPOSITORY = 'onekeyhq/web-embed-prebundle';
const SOURCE_REPOSITORY = 'OneKeyHQ/app-monorepo';
const RELEASE_TAG_PREFIX = `web-embed-prebundle-v${RELEASE_SCHEMA_VERSION}`;
const ARCHIVE_NAME = 'web-embed.tar.gz';
const RELEASE_MANIFEST_NAME = 'web-embed-prebundle-release.json';
const CANONICAL_BUILD_RECEIPT_NAME = 'web-embed-prebundle-build.json';
const ATTESTATION_BUNDLE_NAME = 'web-embed-prebundle-attestations.jsonl';
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ATTESTATION_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 50_000;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_OCI_TOKEN_BYTES = 32 * 1024;
const OCI_DOWNLOAD_MAX_ATTEMPTS = 3;
const SIGNER_WORKFLOW =
  'OneKeyHQ/app-monorepo/.github/workflows/web-embed-prebundle.yml';
const TRUSTED_ROOT_PATH = path.join(
  REPO_ROOT,
  'apps/mobile/bundle-registry/metro-dev-prebundle-trusted-root.jsonl',
);
const INPUT_PATHS = [
  'apps/ext/src/assets/preload-html-head.js',
  'apps/web-embed/babel.config.js',
  'apps/web-embed/index.js',
  'apps/web-embed/public/static/images/icons/favicon/favicon.png',
  'apps/web-embed/rspack.config.ts',
  'apps/web-embed/scripts/finalize-production-assets.js',
  'apps/web-embed/sentry.js',
  'packages/shared/src/web/index.html.ejs',
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
const EXCLUDED_GENERATED_INPUT_PATHS = new Set([
  'packages/kit-bg/src/desktopApis/injectedDesktopCode.text-js',
  'packages/kit/src/components/LightweightChart/utils/lightweightChartsStandalone.text-js',
  'packages/kit/src/components/WebView/injectedNative.js.txt',
  'packages/kit/src/components/WebView/translateInject.text-js',
  'packages/kit/src/components/WebViewWebEmbed/injectedWebEmbed.js.LICENSE.txt',
  'packages/kit/src/components/WebViewWebEmbed/injectedWebEmbed.text-js',
  'packages/shared/src/web/index.html',
]);
const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
]);
const WEB_EMBED_RESOLVE_EXTENSIONS = [
  '.web-embed.ts',
  '.web-embed.tsx',
  '.web-embed.js',
  '.web-embed.jsx',
  '.web-only.ts',
  '.web-only.tsx',
  '.web-only.mjs',
  '.web-only.js',
  '.web-only.jsx',
  '.web.ts',
  '.web.tsx',
  '.web.mjs',
  '.web.js',
  '.web.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.js',
  '.jsx',
  '.json',
  '.wasm',
  '.d.ts',
];
const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);
let cachedDefaultInputKey;
const CANONICAL_EMPTY_ENV_KEYS = [
  'BUILD_APP_VERSION',
  'CI_BUILD_APP_VERSION',
  'CI_BUILD_NUMBER',
  'DESKTOP_E2E_MODE',
  'E2E_MODE',
  'ENABLE_ANALYZER',
  'ENABLE_ANALYZER_HTML_REPORT',
  'GITHUB_TAG',
  'ONEKEY_PROXY',
  'PERF_FUNCTION_THRESHOLD_MS',
  'PERF_FUNCTION_WARN_MS',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_RELEASE_NAME',
  'SENTRY_TOKEN',
  'SENTRY_UPLOAD_BY_CLI',
];

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function toRepoPath(absolutePath, root = REPO_ROOT) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function listFiles(inputPaths = INPUT_PATHS, root = REPO_ROOT) {
  const files = [];
  const visit = (absolutePath) => {
    if (EXCLUDED_GENERATED_INPUT_PATHS.has(toRepoPath(absolutePath, root))) {
      return;
    }
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
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[webEmbedPrebundle] Hash input is missing: ${relativePath}`,
      );
    }
    visit(absolutePath);
  }
  return files.toSorted((left, right) =>
    compareStrings(toRepoPath(left, root), toRepoPath(right, root)),
  );
}

function parseModuleSpecifiers(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const commonPlugins = [
    'classProperties',
    'decorators-legacy',
    'dynamicImport',
    'importMeta',
    'jsx',
    'topLevelAwait',
  ];
  let ast;
  try {
    ast = babelParser.parse(source, {
      errorRecovery: false,
      plugins: [...commonPlugins, 'typescript'],
      sourceType: 'unambiguous',
    });
  } catch {
    try {
      ast = babelParser.parse(source, {
        errorRecovery: false,
        plugins: [...commonPlugins, 'flow', 'flowComments'],
        sourceType: 'unambiguous',
      });
    } catch {
      const specifiers = new Set();
      const importPattern =
        /(?:\b(?:import|export)\b[\s\S]*?\bfrom\s*|\brequire(?:\.resolve)?\s*\(|\bimport\s*\()\s*['"]([^'"]+)['"]/gu;
      for (const match of source.matchAll(importPattern)) {
        specifiers.add(match[1]);
      }
      return [...specifiers].toSorted(compareStrings);
    }
  }
  const specifiers = new Set();
  const addSource = (sourceNode) => {
    if (sourceNode?.type === 'StringLiteral') specifiers.add(sourceNode.value);
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
      addSource(node.source);
    } else if (
      ['ExportAllDeclaration', 'ExportNamedDeclaration'].includes(node.type) &&
      node.exportKind !== 'type'
    ) {
      addSource(node.source);
    } else if (node.type === 'ImportExpression') {
      addSource(node.source);
    } else if (node.type === 'CallExpression') {
      const isRequire =
        node.callee?.type === 'Identifier' && node.callee.name === 'require';
      const isDynamicImport = node.callee?.type === 'Import';
      const isRequireResolve =
        node.callee?.type === 'MemberExpression' &&
        node.callee.object?.type === 'Identifier' &&
        node.callee.object.name === 'require' &&
        node.callee.property?.type === 'Identifier' &&
        node.callee.property.name === 'resolve';
      if (isRequire || isDynamicImport || isRequireResolve) {
        addSource(node.arguments?.[0]);
      }
    } else if (
      node.type === 'NewExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'URL'
    ) {
      addSource(node.arguments?.[0]);
    }
    for (const [key, value] of Object.entries(node)) {
      if (!['comments', 'errors', 'loc', 'tokens'].includes(key)) visit(value);
    }
  };
  visit(ast.program);
  return [...specifiers].toSorted(compareStrings);
}

function createWebEmbedResolver(root, inputResolveOptions) {
  const resolveOptions =
    inputResolveOptions ||
    createBaseResolveOptions({
      basePath: path.join(root, 'apps/web-embed'),
      enableSentryMinimalCompat: true,
      extensions: WEB_EMBED_RESOLVE_EXTENSIONS,
    });
  const { fallback = {}, ...resolverOptions } = resolveOptions;
  return {
    fallback,
    resolve: enhancedResolve.create.sync({
      ...resolverOptions,
      conditionNames: ['browser', 'import', 'require', 'default'],
      modules: [path.join(root, 'node_modules'), 'node_modules'],
    }),
  };
}

function resolveWebEmbedSpecifier({ fallback, resolve }, context, specifier) {
  if (BUILTIN_MODULES.has(specifier)) {
    const builtinName = specifier.startsWith('node:')
      ? specifier.slice('node:'.length)
      : specifier;
    const replacement = fallback[builtinName];
    if (replacement === false || replacement === undefined) return false;
    return resolve(context, replacement);
  }
  return resolve(context, specifier);
}

function findPackageRoot(filePath, root) {
  let current = path.dirname(filePath);
  while (current.startsWith(root) && current !== root) {
    const packagePath = path.join(current, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (
        typeof packageJson.name === 'string' &&
        typeof packageJson.version === 'string'
      ) {
        return { packageJson, packagePath, packageRoot: current };
      }
    }
    current = path.dirname(current);
  }
  return undefined;
}

function readYarnLockResolutionRecords(root) {
  const records = new Map();
  let activeKey;
  let activeRecord;
  const flush = () => {
    if (!activeRecord?.resolution || !activeRecord.version) return;
    const key = `${activeRecord.resolution}\0${activeRecord.version}`;
    records.set(key, {
      checksum: activeRecord.checksum || null,
      resolution: activeRecord.resolution,
      version: activeRecord.version,
    });
  };
  for (const line of fs
    .readFileSync(path.join(root, 'yarn.lock'), 'utf8')
    .split('\n')) {
    if (line && !line.startsWith(' ') && line.endsWith(':')) {
      flush();
      activeKey = line.slice(0, -1);
      activeRecord = activeKey === '__metadata' ? undefined : {};
    } else if (activeRecord) {
      const field = line.match(/^  (checksum|resolution|version): (.+)$/u);
      if (field) {
        activeRecord[field[1]] = field[2].startsWith('"')
          ? JSON.parse(field[2])
          : field[2];
      }
    }
  }
  flush();
  return [...records.values()];
}

function getPackageResolutionRecords(packageJson, lockRecords) {
  const exactNpmResolution = `${packageJson.name}@npm:${packageJson.version}`;
  const matches = lockRecords.filter(
    ({ resolution, version }) =>
      version === packageJson.version &&
      (resolution === exactNpmResolution ||
        resolution.startsWith(`${packageJson.name}@`)),
  );
  if (matches.length === 0) {
    throw new Error(
      `[webEmbedPrebundle] Installed dependency is missing from yarn.lock: ${packageJson.name}@${packageJson.version}`,
    );
  }
  return matches.toSorted((left, right) =>
    compareStrings(JSON.stringify(left), JSON.stringify(right)),
  );
}

function getWebEmbedInputDescriptor({
  inputPaths = INPUT_PATHS,
  resolveOptions,
  root = REPO_ROOT,
} = {}) {
  const resolver = createWebEmbedResolver(root, resolveOptions);
  const repoFiles = new Set(listFiles(inputPaths, root));
  const pending = [...repoFiles];
  const visited = new Set();
  const externalPackages = new Map();
  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!visited.has(filePath)) {
      visited.add(filePath);
      if (SOURCE_EXTENSIONS.has(path.extname(filePath))) {
        const specifiers = parseModuleSpecifiers(filePath);
        for (const specifier of specifiers) {
          let resolved;
          try {
            resolved = resolveWebEmbedSpecifier(
              resolver,
              path.dirname(filePath),
              specifier,
            );
          } catch (error) {
            const adjacentPath = path.resolve(
              path.dirname(filePath),
              specifier,
            );
            if (
              fs.existsSync(adjacentPath) &&
              fs.lstatSync(adjacentPath).isFile()
            ) {
              resolved = adjacentPath;
            } else {
              throw new Error(
                `[webEmbedPrebundle] Unable to resolve ${specifier} from ${toRepoPath(filePath, root)}. Run yarn install first.`,
                { cause: error },
              );
            }
          }
          if (resolved !== false && typeof resolved === 'string') {
            const normalizedPath = resolved
              .replaceAll('\0#', '#')
              .replaceAll('\0?', '?');
            const relativePath = toRepoPath(normalizedPath, root);
            if (!relativePath.startsWith('node_modules/')) {
              if (!repoFiles.has(normalizedPath)) {
                repoFiles.add(normalizedPath);
              }
            } else {
              const resolvedPackage = findPackageRoot(normalizedPath, root);
              if (!resolvedPackage) {
                throw new Error(
                  `[webEmbedPrebundle] Unable to identify dependency for ${relativePath}.`,
                );
              }
              externalPackages.set(
                resolvedPackage.packageRoot,
                resolvedPackage,
              );
            }
            pending.push(normalizedPath);
          }
        }
      }
    }
  }

  const packages = [];
  const lockRecords = readYarnLockResolutionRecords(root);
  for (const dependency of externalPackages.values()) {
    const { packageJson } = dependency;
    packages.push({
      browser: packageJson.browser ?? null,
      dependencies: packageJson.dependencies || {},
      exports: packageJson.exports ?? null,
      main: packageJson.main ?? null,
      module: packageJson.module ?? null,
      name: packageJson.name,
      optionalDependencies: packageJson.optionalDependencies || {},
      peerDependencies: packageJson.peerDependencies || {},
      resolutions: getPackageResolutionRecords(packageJson, lockRecords),
      sideEffects: packageJson.sideEffects ?? null,
      version: packageJson.version,
    });
  }

  return {
    files: [...repoFiles].toSorted((left, right) =>
      compareStrings(toRepoPath(left, root), toRepoPath(right, root)),
    ),
    packages: packages.toSorted((left, right) =>
      compareStrings(
        `${left.name}@${left.version}`,
        `${right.name}@${right.version}`,
      ),
    ),
  };
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

function getInputKey(options = {}) {
  if (Object.keys(options).length === 0 && cachedDefaultInputKey) {
    return cachedDefaultInputKey;
  }
  const {
    inputPaths = INPUT_PATHS,
    resolveOptions,
    root = REPO_ROOT,
    traceDependencies = inputPaths === INPUT_PATHS,
  } = options;
  const hash = crypto.createHash('sha256');
  hash.update(`schema:${SCHEMA_VERSION}\0`);
  if (traceDependencies) {
    const descriptor = getWebEmbedInputDescriptor({
      inputPaths,
      resolveOptions,
      root,
    });
    hash.update(hashFiles(descriptor.files, root));
    hash.update('\0');
    hash.update(JSON.stringify(descriptor.packages));
  } else {
    hash.update(hashFiles(listFiles(inputPaths, root), root));
  }
  const inputKey = hash.digest('hex');
  if (Object.keys(options).length === 0) cachedDefaultInputKey = inputKey;
  return inputKey;
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

function getCanonicalBuildReceiptPath() {
  return path.join(
    WEB_EMBED_ROOT,
    'out-dir-bundle',
    CANONICAL_BUILD_RECEIPT_NAME,
  );
}

function getCanonicalBuildEnvironment({ env = process.env, inputKey } = {}) {
  const resolvedInputKey = inputKey || getInputKey();
  if (!/^[0-9a-f]{64}$/.test(resolvedInputKey)) {
    throw new Error('[webEmbedPrebundle] Invalid canonical build input key.');
  }
  const { buildEnvExposedToClientDangerously } = require(
    path.join(REPO_ROOT, 'development/envExposedToClient'),
  );
  const canonicalEnv = { ...env };
  for (const name of [
    ...buildEnvExposedToClientDangerously({ platform: 'web-embed' }),
    ...CANONICAL_EMPTY_ENV_KEYS,
  ]) {
    canonicalEnv[name] = '';
  }
  delete canonicalEnv.VERSION;
  return {
    ...canonicalEnv,
    BUILD_NUMBER: '0',
    BUILD_TIME: '0',
    BUNDLE_VERSION: '0',
    GITHUB_SHA: resolvedInputKey,
    NODE_ENV: 'production',
    ONEKEY_WEB_EMBED_BUILD_INPUT_KEY: resolvedInputKey,
    ONEKEY_WEB_EMBED_CANONICAL_BUILD: 'true',
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    SENTRY_UPLOAD_BY_CLI: 'false',
    WEB_EMBED_SKIP_POSTBUILD: 'true',
    WORKFLOW_GITHUB_SHA: resolvedInputKey,
  };
}

async function buildCanonicalWebEmbed({
  env = process.env,
  inputKey,
  receiptPath = getCanonicalBuildReceiptPath(),
  webBuildDirectory = path.join(WEB_EMBED_ROOT, 'web-build'),
} = {}) {
  const canonicalEnv = getCanonicalBuildEnvironment({ env, inputKey });
  await fs.promises.rm(receiptPath, { force: true });
  const result = spawnSync(
    'yarn',
    ['workspace', '@onekeyhq/web-embed', 'build'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: canonicalEnv,
      stdio: 'inherit',
    },
  );
  if (result.status !== 0 || result.error) {
    throw new Error('[webEmbedPrebundle] Canonical web-embed build failed.', {
      cause: result.error,
    });
  }
  const outputTreeDigest = hashFiles(
    listOutputFiles(webBuildDirectory),
    webBuildDirectory,
  );
  await writeJson(receiptPath, {
    inputKey: canonicalEnv.ONEKEY_WEB_EMBED_BUILD_INPUT_KEY,
    outputTreeDigest,
    schemaVersion: 1,
  });
  return canonicalEnv.ONEKEY_WEB_EMBED_BUILD_INPUT_KEY;
}

function assertCanonicalBuildReceipt({
  inputKey,
  outputTreeDigest,
  receiptPath = getCanonicalBuildReceiptPath(),
}) {
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (
    receipt?.schemaVersion !== 1 ||
    receipt.inputKey !== inputKey ||
    receipt.outputTreeDigest !== outputTreeDigest
  ) {
    throw new Error(
      '[webEmbedPrebundle] web-build was not produced by the canonical prebundle build.',
    );
  }
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

function getFileMetadata(filePath, { maxBytes } = {}) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`[webEmbedPrebundle] Expected a regular file: ${filePath}`);
  }
  if (maxBytes !== undefined && stat.size > maxBytes) {
    throw new Error(
      `[webEmbedPrebundle] File exceeds the ${maxBytes}-byte limit: ${filePath}`,
    );
  }
  const content = fs.readFileSync(filePath);
  return {
    bytes: stat.size,
    file: path.basename(filePath),
    sha256: sha256(content),
  };
}

async function writeJson(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    await fs.promises.writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      { flag: 'wx' },
    );
    await fs.promises.rename(temporaryPath, filePath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
}

async function createArchive({ archivePath, webBuildDirectory }) {
  const tar = require('tar');
  const relativeFiles = listOutputFiles(webBuildDirectory)
    .map((filePath) =>
      path.relative(webBuildDirectory, filePath).split(path.sep).join('/'),
    )
    .toSorted();
  await tar.create.asyncFile(
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
  const inputKey = getInputKey();
  assertCanonicalBuildReceipt({ inputKey, outputTreeDigest });
  await fs.promises.rm(releaseDirectory, { force: true, recursive: true });
  await fs.promises.mkdir(releaseDirectory, { recursive: true });
  const archivePath = path.join(releaseDirectory, ARCHIVE_NAME);
  await createArchive({ archivePath, webBuildDirectory });
  const releaseManifest = {
    archive: getFileMetadata(archivePath, { maxBytes: MAX_ARCHIVE_BYTES }),
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
    manifest.archive.bytes > MAX_ARCHIVE_BYTES ||
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

async function readResponseBody({ fileName, maxBytes, response }) {
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new Error(`[webEmbedPrebundle] Download is too large: ${fileName}.`);
  }
  if (!response.body) {
    throw new Error(
      `[webEmbedPrebundle] Download has no response body: ${fileName}.`,
    );
  }
  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    receivedBytes += bytes.length;
    if (receivedBytes > maxBytes) {
      throw new Error(
        `[webEmbedPrebundle] Download is too large: ${fileName}.`,
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
      '[webEmbedPrebundle] OCI registry returned an unsupported authentication challenge.',
    );
  }
  const parameters = {};
  const pattern = /(?:^|,)\s*([a-z][a-z0-9_-]*)="([^"]*)"/giu;
  for (const match of scheme[1].matchAll(pattern)) {
    parameters[match[1].toLowerCase()] = match[2];
  }
  if (!parameters.realm) {
    throw new Error(
      '[webEmbedPrebundle] OCI authentication challenge has no realm.',
    );
  }
  return parameters;
}

function createOciClient({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('[webEmbedPrebundle] This Node.js runtime has no fetch.');
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
          'User-Agent': 'OneKey-Web-Embed-Prebundle',
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
        '[webEmbedPrebundle] OCI registry requested an unexpected scope.',
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
        '[webEmbedPrebundle] OCI registry returned an untrusted token realm.',
      );
    }
    if (challenge.service) {
      tokenUrl.searchParams.set('service', challenge.service);
    }
    tokenUrl.searchParams.set('scope', challenge.scope || repositoryScope);
    const tokenResponse = await fetchImpl(tokenUrl, {
      headers: { 'User-Agent': 'OneKey-Web-Embed-Prebundle' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) {
      throw new Error(
        `[webEmbedPrebundle] OCI token request failed: HTTP ${tokenResponse.status}.`,
      );
    }
    const tokenBytes = await readResponseBody({
      fileName: 'OCI token',
      maxBytes: MAX_OCI_TOKEN_BYTES,
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
        '[webEmbedPrebundle] OCI registry returned an invalid token.',
      );
    }
    authorization = `Bearer ${token}`;
    response = await request();
    return response;
  }

  return {
    fetchBlob(digest) {
      if (!/^sha256:[0-9a-f]{64}$/.test(digest || '')) {
        throw new Error('[webEmbedPrebundle] Invalid OCI blob digest.');
      }
      return fetchRegistry(`${repositoryUrl}/blobs/${digest}`, {
        accept: 'application/octet-stream',
        timeoutMs: 180_000,
      });
    },
    fetchManifest(tagName) {
      return fetchRegistry(
        `${repositoryUrl}/manifests/${encodeURIComponent(tagName)}`,
        { accept: OCI_MANIFEST_MEDIA_TYPE, timeoutMs: 15_000 },
      );
    },
  };
}

function verifyOciManifest(manifest) {
  const layers = manifest.layers;
  const titles = layers
    ?.map((layer) => layer.annotations?.['org.opencontainers.image.title'])
    .toSorted();
  const expectedTitles = [
    ARCHIVE_NAME,
    ATTESTATION_BUNDLE_NAME,
    RELEASE_MANIFEST_NAME,
  ].toSorted();
  const layerLimits = {
    [ARCHIVE_NAME]: MAX_ARCHIVE_BYTES,
    [ATTESTATION_BUNDLE_NAME]: MAX_ATTESTATION_BYTES,
    [RELEASE_MANIFEST_NAME]: MAX_MANIFEST_BYTES,
  };
  const hasValidLayerSizes = layers?.every((layer) => {
    const title = layer.annotations?.['org.opencontainers.image.title'];
    const limit = layerLimits[title];
    return (
      limit !== undefined &&
      Number.isSafeInteger(layer.size) &&
      layer.size > 0 &&
      layer.size <= limit &&
      typeof layer.mediaType === 'string' &&
      layer.mediaType.length > 0 &&
      /^sha256:[0-9a-f]{64}$/.test(layer.digest || '')
    );
  });
  if (
    manifest.schemaVersion !== 2 ||
    manifest.mediaType !== OCI_MANIFEST_MEDIA_TYPE ||
    manifest.artifactType !== OCI_ARTIFACT_TYPE ||
    typeof manifest.config?.mediaType !== 'string' ||
    manifest.config.mediaType.length === 0 ||
    !Number.isSafeInteger(manifest.config?.size) ||
    manifest.config.size <= 0 ||
    !/^sha256:[0-9a-f]{64}$/.test(manifest.config?.digest || '') ||
    manifest.annotations?.['org.opencontainers.image.source'] !==
      `https://github.com/${SOURCE_REPOSITORY}` ||
    JSON.stringify(titles) !== JSON.stringify(expectedTitles) ||
    !hasValidLayerSizes
  ) {
    throw new Error('[webEmbedPrebundle] Invalid OCI artifact manifest.');
  }
  return new Map(
    layers.map((layer) => [
      layer.annotations['org.opencontainers.image.title'],
      layer,
    ]),
  );
}

async function resolveOciArtifact({ fetchImpl, tagName }) {
  const client = createOciClient({ fetchImpl });
  const response = await client.fetchManifest(tagName);
  if (!response.ok) {
    throw new Error(
      `[webEmbedPrebundle] OCI manifest download failed: HTTP ${response.status}.`,
    );
  }
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (contentType !== OCI_MANIFEST_MEDIA_TYPE) {
    throw new Error(
      `[webEmbedPrebundle] OCI registry returned an unexpected manifest type: ${contentType || 'missing'}.`,
    );
  }
  const manifestBytes = await readResponseBody({
    fileName: 'OCI manifest',
    maxBytes: MAX_MANIFEST_BYTES,
    response,
  });
  const ociDigest = response.headers.get('docker-content-digest');
  const actualDigest = `sha256:${sha256(manifestBytes)}`;
  if (
    !/^sha256:[0-9a-f]{64}$/.test(ociDigest || '') ||
    ociDigest !== actualDigest
  ) {
    throw new Error('[webEmbedPrebundle] OCI manifest digest mismatch.');
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  return {
    client,
    layers: verifyOciManifest(manifest),
    ociDigest,
  };
}

function isRetryableDownloadError(error) {
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

async function downloadOciLayerOnce({
  client,
  descriptor,
  filePath,
  maxBytes,
}) {
  if (descriptor.size > maxBytes) {
    throw new Error(
      `[webEmbedPrebundle] Download is too large: ${path.basename(filePath)}.`,
    );
  }
  const response = await client.fetchBlob(descriptor.digest);
  if (!response.ok) {
    const error = new Error(
      `[webEmbedPrebundle] OCI blob download failed: HTTP ${response.status}.`,
    );
    error.retryable =
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500;
    throw error;
  }
  if (!response.body) {
    throw new Error(
      `[webEmbedPrebundle] OCI blob has no response body: ${path.basename(filePath)}.`,
    );
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
          `[webEmbedPrebundle] Download is too large: ${path.basename(filePath)}.`,
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
      `[webEmbedPrebundle] OCI blob integrity mismatch: ${path.basename(filePath)}.`,
    );
  }
}

async function downloadOciLayer({
  client,
  descriptor,
  filePath,
  maxAttempts = OCI_DOWNLOAD_MAX_ATTEMPTS,
  maxBytes,
  retryDelayMs = 250,
  wait = (durationMs) =>
    new Promise((resolve) => setTimeout(resolve, durationMs)),
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await downloadOciLayerOnce({
        client,
        descriptor,
        filePath,
        maxBytes,
      });
      return;
    } catch (error) {
      await fs.promises.rm(filePath, { force: true });
      if (attempt === maxAttempts || !isRetryableDownloadError(error)) {
        throw error;
      }
      console.error(
        `[webEmbedPrebundle] Retrying ${path.basename(filePath)} after a transient download failure (${String(attempt)}/${String(maxAttempts)}): ${error instanceof Error ? error.message : String(error)}`,
      );
      await wait(retryDelayMs * attempt);
    }
  }
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

function createArchiveEntryFilter({
  maxEntries = MAX_ARCHIVE_ENTRIES,
  maxExtractedBytes = MAX_EXTRACTED_BYTES,
} = {}) {
  let entryCount = 0;
  let extractedBytes = 0;
  return (entryPath, entry) => {
    const normalized = path.posix.normalize(entryPath);
    const entryBytes = entry.size;
    entryCount += 1;
    if (
      !Number.isSafeInteger(entryBytes) ||
      entryBytes < 0 ||
      entryCount > maxEntries ||
      extractedBytes + entryBytes > maxExtractedBytes
    ) {
      throw new Error(
        `[webEmbedPrebundle] Archive exceeds extraction limits: ${entryPath}`,
      );
    }
    extractedBytes += entryBytes;
    const isRegularEntry =
      entry.type === 'File' ||
      entry.type === 'OldFile' ||
      entry.type === 'Directory';
    const isSafePath =
      normalized.startsWith('web-embed/') &&
      !path.posix.isAbsolute(normalized) &&
      !entryPath.includes('\\') &&
      !normalized.includes('/../');
    const isSafe = isSafePath && isRegularEntry;
    if (!isSafe) {
      throw new Error(`[webEmbedPrebundle] Unsafe archive entry: ${entryPath}`);
    }
    return true;
  };
}

async function extractArchive({ archivePath, outputDirectory }) {
  const tar = require('tar');
  const outputParent = path.dirname(outputDirectory);
  await fs.promises.mkdir(outputParent, { recursive: true });
  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(outputParent, `${path.basename(outputDirectory)}.tmp-`),
  );
  try {
    await tar.extract.asyncFile(
      {
        cwd: temporaryDirectory,
        file: archivePath,
        filter: createArchiveEntryFilter(),
        preservePaths: false,
        strict: true,
      },
      [],
    );
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
  const previousDirectory = `${outputDirectory}.previous-${process.pid}-${crypto.randomUUID()}`;
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

async function restoreRelease({
  fetchImpl,
  outputDirectory,
  receiptPath,
} = {}) {
  const tagName = getReleaseTag();
  const pullDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'onekey-web-embed-prebundle-'),
  );
  try {
    const artifact = await resolveOciArtifact({ fetchImpl, tagName });
    const { ociDigest } = artifact;
    const reference = `${OCI_REGISTRY}/${OCI_REPOSITORY}@${ociDigest}`;
    const layerLimits = {
      [ARCHIVE_NAME]: MAX_ARCHIVE_BYTES,
      [ATTESTATION_BUNDLE_NAME]: MAX_ATTESTATION_BYTES,
      [RELEASE_MANIFEST_NAME]: MAX_MANIFEST_BYTES,
    };
    for (const [fileName, maxBytes] of Object.entries(layerLimits)) {
      await downloadOciLayer({
        client: artifact.client,
        descriptor: artifact.layers.get(fileName),
        filePath: path.join(pullDirectory, fileName),
        maxBytes,
      });
    }
    const manifestPath = path.join(pullDirectory, RELEASE_MANIFEST_NAME);
    getFileMetadata(manifestPath, { maxBytes: MAX_MANIFEST_BYTES });
    getFileMetadata(path.join(pullDirectory, ATTESTATION_BUNDLE_NAME), {
      maxBytes: MAX_ATTESTATION_BYTES,
    });
    const manifest = parseManifest(manifestPath);
    await verifyAttestations(pullDirectory, manifest.sourceCommit);
    const archivePath = path.join(pullDirectory, ARCHIVE_NAME);
    const archiveMetadata = getFileMetadata(archivePath, {
      maxBytes: MAX_ARCHIVE_BYTES,
    });
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
      receiptPath ||
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
  if (!['build', 'input-key', 'package', 'restore', 'tag'].includes(command)) {
    throw new Error(
      'Usage: web-embed-prebundle.js <build|input-key|tag|package|restore> [--output <path>] [--source-commit <sha>]',
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
  if (args.command === 'build') {
    const inputKey = await buildCanonicalWebEmbed();
    console.log(`[webEmbedPrebundle] built inputKey=${inputKey}`);
  } else if (args.command === 'input-key') {
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
  CANONICAL_BUILD_RECEIPT_NAME,
  INPUT_PATHS,
  MAX_EXTRACTED_BYTES,
  OCI_ARTIFACT_TYPE,
  OCI_REGISTRY,
  OCI_REPOSITORY,
  RELEASE_MANIFEST_NAME,
  assertCanonicalBuildReceipt,
  buildCanonicalWebEmbed,
  createArchiveEntryFilter,
  getCanonicalBuildEnvironment,
  getInputKey,
  getReleaseTag,
  getWebEmbedInputDescriptor,
  hashFiles,
  listFiles,
  packageRelease,
  parseManifest,
  restoreRelease,
};
