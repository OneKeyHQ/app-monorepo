// cspell:ignore esbuild lavamoat

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { checkEsbuild } = require('./check-install-binaries.cjs');

test('esbuild checks support fresh and optimized CLI layouts without using fallback binaries', (t) => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-esbuild-migration-')),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const originalManifest = require.resolve('esbuild/package.json');
  const localRequire = createRequire(originalManifest);
  const manifest = localRequire(originalManifest);
  const wrapper = path.join(directory, 'node_modules/esbuild');
  const originalDirectory = path.dirname(originalManifest);
  fs.cpSync(originalDirectory, wrapper, {
    recursive: true,
    filter: (source) => source !== path.join(originalDirectory, 'node_modules'),
  });

  let lockedBinary;
  for (const name of Object.keys(manifest.optionalDependencies)) {
    try {
      const filename = localRequire.resolve(`${name}/package.json`);
      const distribution = localRequire(filename);
      if (
        distribution.os?.includes(process.platform) &&
        distribution.cpu?.includes(process.arch)
      ) {
        const destination = path.join(directory, 'node_modules', name);
        fs.cpSync(path.dirname(filename), destination, { recursive: true });
        lockedBinary = path.join(
          destination,
          process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild',
        );
      }
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  assert.ok(lockedBinary, 'The fixture needs the locked host platform binary');
  checkEsbuild(wrapper, manifest.version);

  if (process.platform !== 'win32') {
    // Reproduce the old npm installer's optimization without touching node_modules.
    const optimizedEntry = path.join(wrapper, 'bin/esbuild');
    fs.copyFileSync(lockedBinary, optimizedEntry);
    fs.chmodSync(optimizedEntry, 0o755);
    assert.notEqual(
      spawnSync(process.execPath, [optimizedEntry, '--version']).status,
      0,
      'Node must not interpret the optimized native executable as JavaScript',
    );
    checkEsbuild(wrapper, manifest.version);
  }

  fs.rmSync(lockedBinary);
  assert.throws(
    () => checkEsbuild(wrapper, manifest.version),
    /Missing locked binary/,
    'An existing optimized entry must not hide a missing locked platform package',
  );
});
