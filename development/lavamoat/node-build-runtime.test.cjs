// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const { javascriptLiteral } = require('./javascript-literal.cjs');

const cliRequire = createRequire(
  path.resolve(__dirname, '../../apps/cli/package.json'),
);

function write(directory, name, source) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

test('fixture literals preserve data without escaping a JavaScript or HTML script boundary', () => {
  const { parse } = createRequire(require.resolve('jsdom'))('parse5');
  for (const value of [
    '</script><script>globalThis.injected=true</script>',
    '<!-- <script> & -->',
    '\u2028\u2029\n\r\t\0',
    String.raw`C:\fixture\"quoted"\'single'\file.js`,
    '");globalThis.injected=true;//',
    undefined,
  ]) {
    const source = `globalThis.value = ${javascriptLiteral(value)};`;
    const document = parse(`<script>${source}</script>`);
    const scripts = [];
    const visit = (node) => {
      if (node.tagName === 'script') scripts.push(node);
      node.childNodes?.forEach(visit);
    };
    visit(document);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].childNodes[0].value, source);
    const context = {};
    vm.runInNewContext(source, context);
    assert.equal(context.value, value);
    assert.equal(Object.hasOwn(context, 'value'), true);
    assert.equal(Object.hasOwn(context, 'injected'), false);
  }
});

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
      `exports.read = () => require('node:fs').readFileSync(${javascriptLiteral(path.join(directory, 'private-fixture.txt'))}, 'utf8');`,
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
      `import { generatePolicy, run } from ${javascriptLiteral(pathToFileURL(path.join(path.dirname(require.resolve('@lavamoat/node/package.json')), 'src/index.js')).href)};
      const entry = ${javascriptLiteral(path.join(directory, 'entry.cjs'))};
      const policy = await generatePolicy(entry, { projectRoot: ${javascriptLiteral(directory)}, write: false });
      if (!policy.resources.esbuild) throw Error('esbuild must be a protected package, not an implicit native exit');
      policy.resources.denied = {};
      const namespace = await run(entry, { policy, projectRoot: ${javascriptLiteral(directory)} });
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
