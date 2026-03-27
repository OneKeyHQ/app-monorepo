const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) {
    return 'n/a';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function normalizeArchivePath(filePath) {
  return filePath.startsWith('/') ? filePath.slice(1) : filePath;
}

function readSnippet(filePath, offset, length = 96) {
  const stat = fs.statSync(filePath);
  if (offset >= stat.size) {
    return '';
  }
  const size = Math.min(length, stat.size - offset);
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(size);
  try {
    fs.readSync(fd, buffer, 0, size, offset);
  } finally {
    fs.closeSync(fd);
  }
  return buffer
    .toString('utf8')
    .replace(/[^\x20-\x7E]+/g, '.')
    .slice(0, length);
}

function summarizeTopLevel(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const normalized = normalizeArchivePath(entry.path);
    const topLevel = normalized.split('/')[0] || '.';
    const current = groups.get(topLevel) || {
      path: topLevel,
      size: 0,
      packedSize: 0,
      unpackedSize: 0,
      fileCount: 0,
    };
    current.size += entry.size;
    current.fileCount += 1;
    if (entry.unpacked) {
      current.unpackedSize += entry.size;
    } else {
      current.packedSize += entry.size;
    }
    groups.set(topLevel, current);
  }
  return Array.from(groups.values())
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((group) => ({
      path: group.path,
      size: group.size,
      sizeText: formatBytes(group.size),
      packedSize: group.packedSize,
      packedSizeText: formatBytes(group.packedSize),
      unpackedSize: group.unpackedSize,
      unpackedSizeText: formatBytes(group.unpackedSize),
      fileCount: group.fileCount,
    }));
}

function summarizeAsar(asarPath) {
  if (!fs.existsSync(asarPath)) {
    return {
      exists: false,
      asarPath,
    };
  }

  if (typeof asar.uncache === 'function') {
    try {
      asar.uncache(asarPath);
    } catch {
      // Ignore cache reset failures for diagnostics.
    }
  }

  const stat = fs.statSync(asarPath);
  const { headerSize } = asar.getRawHeader(asarPath);
  const physicalContentOffset = 8 + headerSize;
  const list = asar.listPackage(asarPath);
  const entries = [];

  for (const rawPath of list) {
    const info = asar.statFile(asarPath, normalizeArchivePath(rawPath), false);
    if (info.files) {
      continue;
    }
    entries.push({
      path: rawPath,
      size: Number(info.size || 0),
      offset: info.offset == null ? null : Number(info.offset),
      unpacked: !!info.unpacked,
    });
  }

  const packedEntries = entries
    .filter((entry) => entry.offset != null && !entry.unpacked)
    .sort((a, b) => a.offset - b.offset);
  const unpackedEntries = entries.filter((entry) => entry.unpacked);
  const packedBytes = packedEntries.reduce((sum, entry) => sum + entry.size, 0);
  const unpackedBytes = unpackedEntries.reduce((sum, entry) => sum + entry.size, 0);
  const firstPacked = packedEntries[0] || null;
  const lastPacked =
    packedEntries.length > 0
      ? [...packedEntries].sort(
          (a, b) => a.offset + a.size - (b.offset + b.size),
        )[packedEntries.length - 1]
      : null;

  return {
    exists: true,
    asarPath,
    actualSize: stat.size,
    actualSizeText: formatBytes(stat.size),
    headerSize,
    headerSizeText: formatBytes(headerSize),
    physicalContentOffset,
    packedFileCount: packedEntries.length,
    unpackedFileCount: unpackedEntries.length,
    packedBytes,
    packedBytesText: formatBytes(packedBytes),
    unpackedBytes,
    unpackedBytesText: formatBytes(unpackedBytes),
    listFirst10: list.slice(0, 10),
    firstPacked,
    lastPacked,
    firstPackedAbsoluteOffset:
      firstPacked == null ? null : physicalContentOffset + firstPacked.offset,
    firstPackedGap:
      firstPacked == null ? null : firstPacked.offset - packedEntries[0].offset,
    prefixGapBeforeFirstPacked:
      firstPacked == null ? null : firstPacked.offset,
    headerStartSnippet: readSnippet(asarPath, physicalContentOffset),
    firstPackedSnippet:
      firstPacked == null
        ? ''
        : readSnippet(asarPath, physicalContentOffset + firstPacked.offset),
    packedByOffsetFirst10: packedEntries.slice(0, 10),
    packedByOffsetLast10: packedEntries.slice(-10),
    topLevelSummary: summarizeTopLevel(entries),
  };
}

function getResourcesDir(context) {
  const { appOutDir, electronPlatformName } = context;
  const appName = context.packager.appInfo.productFilename;
  return electronPlatformName === 'darwin' || electronPlatformName === 'mas'
    ? path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources')
    : path.join(appOutDir, 'resources');
}

function logAsarDiagnostics(stage, context, extra = {}) {
  try {
    const resourcesDir = getResourcesDir(context);
    const summary = summarizeAsar(path.join(resourcesDir, 'app.asar'));
    console.log(
      `[asar-diag:${stage}] ${JSON.stringify(
        {
          stage,
          platform: context.electronPlatformName,
          appOutDir: context.appOutDir,
          resourcesDir,
          ...extra,
          summary,
        },
        null,
        2,
      )}`,
    );
  } catch (error) {
    console.log(
      `[asar-diag:${stage}:error] ${
        error && error.stack ? error.stack : String(error)
      }`,
    );
  }
}

module.exports = {
  formatBytes,
  getResourcesDir,
  logAsarDiagnostics,
  summarizeAsar,
};
