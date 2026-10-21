/* eslint-disable onekey/no-raw-error */
// Mobile web-embed must carry both zcash runtimes: keys (signing) and wallet
// (scanning). Either half missing means a broken build; the gzip budget
// catches bloat (the wasm is base64-inlined into JS).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const buildDir = path.resolve(__dirname, '../web-build');
// The self-contained Worker contains both modules; count shared assets once.
const maxRuntimeGzipBytes = 7.1 * 1000 * 1000;
const keysMarkers = ['onekey_zcash_keys', 'UnifiedSpendingKey'];
const walletMarkers = ['__onekeyZcashSdkStateV2', 'onekey_zcash_runtime'];

function collectJavaScriptFiles(directoryPath) {
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return collectJavaScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
    });
}

function includesAny(source, markers) {
  return markers.some((marker) => source.includes(marker));
}

function gzipTotal(files) {
  return files.reduce(
    (total, { source }) =>
      total +
      zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION })
        .length,
    0,
  );
}

function checkZcashBundleBoundary() {
  const javaScriptFiles = collectJavaScriptFiles(buildDir);
  const entries = javaScriptFiles.map((filePath) => ({
    filePath,
    source: fs.readFileSync(filePath),
  }));

  const keysFiles = entries.filter(({ source }) =>
    includesAny(source, keysMarkers),
  );
  if (keysFiles.length === 0) {
    throw new Error('Zcash keys runtime is missing from mobile web-embed.');
  }
  const walletFiles = entries.filter(({ source }) =>
    includesAny(source, walletMarkers),
  );
  if (walletFiles.length === 0) {
    throw new Error(
      'Zcash wallet runtime is missing from mobile web-embed; on-device scanning would silently break.',
    );
  }

  const runtimeFiles = [...new Set([...keysFiles, ...walletFiles])];
  const runtimeGzipBytes = gzipTotal(runtimeFiles);
  if (runtimeGzipBytes > maxRuntimeGzipBytes) {
    throw new Error(
      `Zcash runtime exceeds the ${maxRuntimeGzipBytes}-byte gzip budget: ${runtimeGzipBytes} bytes.`,
    );
  }
  console.log(
    `Verified mobile Zcash bundle: keys and wallet present, ${runtimeGzipBytes} unique gzip bytes.`,
  );
}

if (require.main === module) {
  checkZcashBundleBoundary();
}

module.exports = { checkZcashBundleBoundary };
