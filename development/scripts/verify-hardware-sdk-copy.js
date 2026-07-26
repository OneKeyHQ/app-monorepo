#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const defaultSourceDir = path.join(
  projectRoot,
  'node_modules',
  '@onekeyfe',
  'hd-web-sdk',
  'build',
);
const defaultDestinationDir = path.join(
  projectRoot,
  'apps',
  'desktop',
  'public',
  'static',
  'js-sdk',
);

function toPortablePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function collectManifest(rootDir, { runtimeOnly = false } = {}) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Hardware SDK directory does not exist: ${rootDir}`);
  }
  const manifest = new Map();

  function visit(directoryPath) {
    const entries = fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .toSorted((left, right) => left.name.localeCompare(right.name));
    entries.forEach((entry) => {
      const absolutePath = path.join(directoryPath, entry.name);
      const relativePath = toPortablePath(path.relative(rootDir, absolutePath));
      const stats = fs.lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new Error(
          `Hardware SDK copy contains a symbolic link: ${relativePath}`,
        );
      }
      if (stats.isDirectory()) {
        visit(absolutePath);
        return;
      }
      if (!stats.isFile()) {
        throw new Error(
          `Hardware SDK copy contains a non-regular entry: ${relativePath}`,
        );
      }
      if (
        runtimeOnly &&
        (relativePath.endsWith('.map') || relativePath.endsWith('.LICENSE.txt'))
      ) {
        return;
      }
      const hash = crypto
        .createHash('sha256')
        .update(fs.readFileSync(absolutePath))
        .digest('hex');
      manifest.set(relativePath, {
        size: stats.size,
        sha256: hash,
      });
    });
  }

  visit(rootDir);
  return manifest;
}

function compareManifests(sourceManifest, destinationManifest) {
  const sourceFiles = [...sourceManifest.keys()].toSorted();
  const destinationFiles = [...destinationManifest.keys()].toSorted();
  const missing = sourceFiles.filter(
    (filePath) => !destinationManifest.has(filePath),
  );
  const extra = destinationFiles.filter(
    (filePath) => !sourceManifest.has(filePath),
  );
  const changed = sourceFiles.filter((filePath) => {
    const source = sourceManifest.get(filePath);
    const destination = destinationManifest.get(filePath);
    return (
      destination &&
      (source.size !== destination.size || source.sha256 !== destination.sha256)
    );
  });
  if (missing.length > 0 || extra.length > 0 || changed.length > 0) {
    throw new Error(
      [
        'Desktop hardware SDK copy is incomplete.',
        `Missing: ${missing.join(', ') || 'none'}`,
        `Extra: ${extra.join(', ') || 'none'}`,
        `Changed: ${changed.join(', ') || 'none'}`,
      ].join('\n'),
    );
  }
}

function collectRuntimeReferences(filePath, content) {
  const references = new Set();
  const extension = path.posix.extname(filePath).toLowerCase();
  const patterns = [];
  if (extension === '.html') {
    patterns.push(
      /(?:src|href)\s*=\s*["']([^"']+)["']/giu,
      /setAttribute\(\s*["'](?:src|href)["']\s*,\s*["']([^"']+)["']\s*\)/giu,
    );
  }
  if (extension === '.js') {
    patterns.push(
      /setAttribute\(\s*["'](?:src|href)["']\s*,\s*["']([^"']+)["']\s*\)/giu,
      /new\s+(?:Shared)?Worker\(\s*["']([^"']+)["']/gu,
      /importScripts\(\s*["']([^"']+)["']/gu,
    );
  }
  if (extension === '.css') {
    patterns.push(/url\(\s*["']?([^"')]+)["']?\s*\)/giu);
  }
  patterns.forEach((pattern) => {
    let match = pattern.exec(content);
    while (match) {
      references.add(match[1]);
      match = pattern.exec(content);
    }
  });
  return [...references].map((reference) => ({
    owner: filePath,
    reference,
  }));
}

function resolveRuntimeReference(owner, reference) {
  const withoutQuery = reference.split(/[?#]/u, 1)[0];
  if (
    !withoutQuery ||
    withoutQuery.startsWith('#') ||
    /^(?:data|blob|https?|mailto|about):/iu.test(withoutQuery)
  ) {
    return undefined;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    throw new Error(
      `Hardware SDK resource reference is not valid URI text: ${owner} -> ${reference}`,
    );
  }
  const sdkPrefix = '/static/js-sdk/';
  let relative;
  if (decoded.startsWith(sdkPrefix)) {
    relative = decoded.slice(sdkPrefix.length);
  } else if (!decoded.startsWith('/')) {
    relative = path.posix.normalize(
      path.posix.join(path.posix.dirname(owner), decoded),
    );
  }
  if (
    !relative ||
    relative === '.' ||
    relative === '..' ||
    relative.startsWith('../') ||
    path.posix.isAbsolute(relative)
  ) {
    throw new Error(
      `Hardware SDK resource reference escapes its root: ${owner} -> ${reference}`,
    );
  }
  return relative;
}

function verifyRuntimeReferences(rootDir, manifest) {
  if (!manifest.has('iframe.html')) {
    throw new Error('Desktop hardware SDK copy is missing iframe.html');
  }
  const references = [];
  [...manifest.keys()]
    .filter((filePath) => /\.(?:css|html|js)$/iu.test(filePath))
    .forEach((filePath) => {
      const content = fs.readFileSync(path.join(rootDir, filePath), 'utf8');
      references.push(...collectRuntimeReferences(filePath, content));
    });
  const resolvedReferences = references
    .map(({ owner, reference }) => ({
      owner,
      reference,
      resolved: resolveRuntimeReference(owner, reference),
    }))
    .filter(({ resolved }) => Boolean(resolved));
  const missing = resolvedReferences.filter(
    ({ resolved }) => !manifest.has(resolved),
  );
  if (missing.length > 0) {
    throw new Error(
      `Hardware SDK runtime references are missing: ${missing
        .map(({ owner, reference }) => `${owner} -> ${reference}`)
        .join(', ')}`,
    );
  }
  const iframeScripts = resolvedReferences.filter(
    ({ owner, resolved }) =>
      owner === 'iframe.html' && resolved.endsWith('.js'),
  );
  if (iframeScripts.length === 0) {
    throw new Error('iframe.html does not reference a local runtime script');
  }
  return resolvedReferences;
}

function verifyHardwareSdkCopy({
  sourceDir = defaultSourceDir,
  destinationDir = defaultDestinationDir,
  runtimeOnly = false,
} = {}) {
  const sourceManifest = collectManifest(sourceDir, { runtimeOnly });
  const destinationManifest = collectManifest(destinationDir, { runtimeOnly });
  compareManifests(sourceManifest, destinationManifest);
  const references = verifyRuntimeReferences(
    destinationDir,
    destinationManifest,
  );
  return {
    fileCount: sourceManifest.size,
    referenceCount: references.length,
  };
}

function main() {
  const destinationDir = process.env.HARDWARE_SDK_DESTINATION
    ? path.resolve(process.cwd(), process.env.HARDWARE_SDK_DESTINATION)
    : defaultDestinationDir;
  const result = verifyHardwareSdkCopy({
    destinationDir,
    runtimeOnly: process.env.HARDWARE_SDK_RUNTIME_ONLY === 'true',
  });
  console.log(
    `Verified Desktop hardware SDK copy: ${result.fileCount} files, ${result.referenceCount} local references.`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  collectManifest,
  compareManifests,
  resolveRuntimeReference,
  verifyHardwareSdkCopy,
  verifyRuntimeReferences,
};
