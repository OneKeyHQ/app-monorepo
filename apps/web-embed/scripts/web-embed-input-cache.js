const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_CACHE_BYTES = 32 * 1024 * 1024;

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getPathStamp(filePath, kind = 'path', contents) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) return `link:${fs.readlinkSync(filePath)}`;
    if (stat.isDirectory()) {
      return kind === 'context'
        ? `directory:${digest(JSON.stringify(fs.readdirSync(filePath).toSorted()))}`
        : 'directory';
    }
    if (stat.isFile()) {
      return `file:${stat.mode & 0o111}:${digest(contents ?? fs.readFileSync(filePath))}`;
    }
    return `other:${stat.mode}`;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'missing';
    throw error;
  }
}

function validateSnapshot(records) {
  return records.every(
    ([filePath, kind, stamp]) => getPathStamp(filePath, kind) === stamp,
  );
}

function createInputSnapshot() {
  const records = new Map();
  let consistent = true;
  const record = (filePath, kind, stamp) => {
    const key = `${kind}\0${filePath}`;
    const previous = records.get(key);
    if (previous && previous[2] !== stamp) consistent = false;
    else records.set(key, [filePath, kind, stamp]);
  };
  const track = (kind) => ({
    add(filePath) {
      const key = `${kind}\0${filePath}`;
      if (!records.has(key))
        record(filePath, kind, getPathStamp(filePath, kind));
    },
  });
  const fileDependencies = track('path');
  return {
    fileDependencies,
    contextDependencies: track('context'),
    // Resolver misses include existing paths of the wrong type, such as a directory instead of a file.
    missingDependencies: fileDependencies,
    recordContents(filePath, contents) {
      const stamp = getPathStamp(filePath, 'path', contents);
      record(filePath, 'path', stamp);
      if (stamp.startsWith('link:')) {
        const target = fs.realpathSync(filePath);
        record(target, 'path', getPathStamp(target, 'path', contents));
      }
    },
    finish() {
      const result = [...records.values()];
      return consistent && validateSnapshot(result) ? result : undefined;
    },
  };
}

function getInputCacheKey(options) {
  try {
    const serialized = JSON.stringify(options, (_key, value) => {
      if (typeof value === 'function' || value instanceof RegExp)
        throw new TypeError('Unsupported resolver cache input');
      return value;
    });
    return digest(`${serialized}\0${fs.readFileSync(__filename)}`);
  } catch {
    return undefined;
  }
}

function readInputCache(cachePath, cacheKey) {
  if (!cachePath || !cacheKey) return undefined;
  try {
    const stat = fs.lstatSync(cachePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CACHE_BYTES)
      return undefined;
    const { payload, checksum } = JSON.parse(
      fs.readFileSync(cachePath, 'utf8'),
    );
    if (
      payload.schemaVersion !== 1 ||
      payload.cacheKey !== cacheKey ||
      !/^[0-9a-f]{64}$/u.test(payload.inputKey) ||
      !Array.isArray(payload.records) ||
      payload.records.length === 0 ||
      checksum !== digest(JSON.stringify(payload)) ||
      !validateSnapshot(payload.records)
    )
      return undefined;
    return payload.inputKey;
  } catch {
    return undefined;
  }
}

function writeInputCache({ cachePath, cacheKey, inputKey, snapshot }) {
  if (!cachePath || !cacheKey) return;
  let temporaryPath;
  try {
    const records = snapshot.finish();
    if (!records) return;
    const payload = { schemaVersion: 1, cacheKey, inputKey, records };
    const serialized = JSON.stringify({
      payload,
      checksum: digest(JSON.stringify(payload)),
    });
    if (Buffer.byteLength(serialized) > MAX_CACHE_BYTES) return;
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    temporaryPath = `${cachePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
    fs.writeFileSync(temporaryPath, serialized, { flag: 'wx' });
    fs.renameSync(temporaryPath, cachePath);
  } catch {
    // A missing or read-only optimization cache must not prevent a fresh input scan.
  } finally {
    if (temporaryPath) {
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch {
        // Temporary cache cleanup must not fail the source scan either.
      }
    }
  }
}

module.exports = {
  createInputSnapshot,
  getInputCacheKey,
  readInputCache,
  writeInputCache,
};
