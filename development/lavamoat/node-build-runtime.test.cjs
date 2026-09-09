// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');

const cliRequire = createRequire(
  path.resolve(__dirname, '../../apps/cli/package.json'),
);

function write(directory, name, source) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

test('official Node runtime executes real esbuild while denying an unrelated package filesystem access', () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-build-runtime-')),
  );
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'build-runtime-probe',
        dependencies: {
          esbuild: cliRequire('esbuild/package.json').version,
          denied: '1.0.0',
        },
      }),
    );
    fs.mkdirSync(path.join(directory, 'node_modules'), { recursive: true });
    fs.symlinkSync(
      path.dirname(cliRequire.resolve('esbuild/package.json')),
      path.join(directory, 'node_modules/esbuild'),
      'junction',
    );
    write(
      directory,
      'node_modules/denied/package.json',
      JSON.stringify({ name: 'denied', version: '1.0.0' }),
    );
    write(
      directory,
      'node_modules/denied/index.js',
      `exports.read = () => require('node:fs').readFileSync(${JSON.stringify(path.join(directory, 'private-fixture.txt'))}, 'utf8');`,
    );
    write(directory, 'private-fixture.txt', 'synthetic-fixture-only');
    write(
      directory,
      'entry.cjs',
      `const esbuild = require('esbuild'); const denied = require('denied');
      module.exports = async () => {
        let rejected = false;
        try { denied.read(); } catch (error) { rejected = /policy|not allowed|Cannot find/.test(error.message); }
        const transformed = await esbuild.transform('const answer: number = 42;', { loader: 'ts' });
        return { rejected, transformed: transformed.code, frozen: Object.isFrozen(Object.prototype) };
      };`,
    );
    write(
      directory,
      'driver.mjs',
      `import { generatePolicy, run } from ${JSON.stringify(pathToFileURL(path.join(path.dirname(require.resolve('@lavamoat/node/package.json')), 'src/index.js')).href)};
      const entry = ${JSON.stringify(path.join(directory, 'entry.cjs'))};
      const policy = await generatePolicy(entry, { projectRoot: ${JSON.stringify(directory)}, write: false });
      if (!policy.resources.esbuild) throw Error('esbuild must be a protected package, not an implicit native exit');
      policy.resources.denied = {};
      const namespace = await run(entry, { policy, projectRoot: ${JSON.stringify(directory)} });
      console.log(JSON.stringify(await namespace.default()));`,
    );
    const result = spawnSync(
      process.execPath,
      [path.join(directory, 'driver.mjs')],
      {
        encoding: 'utf8',
        timeout: 30_000,
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const output = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(output.rejected, true);
    assert.equal(output.frozen, true);
    assert.match(output.transformed, /const answer = 42/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
