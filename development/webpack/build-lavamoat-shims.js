// cspell:ignore LavaMoat lavamoat

const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

let staticShimPath;

function getLavaMoatStaticShimPath() {
  if (staticShimPath) {
    return staticShimPath;
  }

  const { buildSync } = require('esbuild');
  const repoRoot = path.resolve(__dirname, '../..');
  const { outputFiles } = buildSync({
    absWorkingDir: repoRoot,
    entryPoints: [path.join(__dirname, 'lavamoat-shims.js')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2017',
    write: false,
    logLevel: 'silent',
  });
  const source = outputFiles[0].contents;
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const cacheDir = path.join(repoRoot, 'node_modules/.cache/lavamoat');
  const outputFile = path.join(cacheDir, `static-shims-${sourceHash}.js`);
  fs.mkdirSync(cacheDir, { recursive: true });

  // Atomic publication keeps parallel builds from reading a partial shim.
  const temporaryDir = fs.mkdtempSync(path.join(cacheDir, 'building-shims-'));
  try {
    const temporaryFile = path.join(temporaryDir, 'static-shims.js');
    fs.writeFileSync(temporaryFile, source);
    fs.renameSync(temporaryFile, outputFile);
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }

  staticShimPath = outputFile;
  return staticShimPath;
}

module.exports = { getLavaMoatStaticShimPath };
