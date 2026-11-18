const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { transformSync } = require('@babel/core');

const {
  generateMetadataJson,
} = require('../../../apps/mobile/build-bundle-base');
const sentryRelativeSourcePath = require('../../babel-plugins/sentry-relative-source-path');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

test('sentry-relative-source-path normalizes absolute paths across checkout roots', () => {
  const relativeFile = 'packages/kit/src/Foo.tsx';
  const rootA = path.resolve('/Users/expo/workingdir/build');
  const rootB = path.resolve('/home/runner/work/app-monorepo');
  const fileA = path.join(rootA, relativeFile);
  const fileB = path.join(rootB, relativeFile);

  const pluginA = sentryRelativeSourcePath(null, { rootDir: rootA });
  const pluginB = sentryRelativeSourcePath(null, { rootDir: rootB });

  const babelFileA = {
    opts: {
      filename: fileA,
      parserOpts: { sourceFileName: fileA },
    },
  };
  const babelFileB = {
    opts: {
      filename: fileB,
      parserOpts: { sourceFileName: fileB },
    },
  };

  pluginA.pre(babelFileA);
  pluginB.pre(babelFileB);

  assert.equal(babelFileA.opts.parserOpts.sourceFileName, relativeFile);
  assert.equal(babelFileB.opts.parserOpts.sourceFileName, relativeFile);
  assert.equal(babelFileA.opts.filename, fileA);
  assert.equal(babelFileB.opts.filename, fileB);

  // Fallback when parserOpts.sourceFileName is unset but filename is absolute
  const fallbackFile = {
    opts: {
      filename: fileA,
      parserOpts: {},
    },
  };
  pluginA.pre(fallbackFile);
  assert.equal(fallbackFile.opts.parserOpts.sourceFileName, relativeFile);
  assert.equal(fallbackFile.opts.filename, fileA);

  // End-to-end Babel transform with @sentry/babel-plugin-component-annotate
  const source = 'function Foo() { return <View><Text>Hi</Text></View>; }';
  const transform = (rootDir, filename) =>
    transformSync(source, {
      babelrc: false,
      configFile: false,
      filename,
      parserOpts: { plugins: ['jsx'] },
      plugins: [
        [sentryRelativeSourcePath, { rootDir }],
        '@sentry/babel-plugin-component-annotate',
      ],
    }).code;

  const outA = transform(rootA, fileA);
  const outB = transform(rootB, fileB);
  assert.equal(outA, outB);
  assert.ok(outA.includes(`data-sentry-source-file="${relativeFile}"`));
  assert.ok(!outA.includes('/Users/expo'));
  assert.ok(!outB.includes('/home/runner'));
});

test('generateMetadataJson produces deterministic JSON and SHA-256 regardless of file creation order', async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-metadata-test-'));
  t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

  const dirA = path.join(tmpRoot, 'build-a');
  const dirB = path.join(tmpRoot, 'build-b');

  const files = [
    ['common.bundle', 'common-content'],
    ['main.jsbundle.hbc', 'main-content'],
    ['background.bundle', 'bg-content'],
    ['segments/10.seg.js', 'seg-10'],
    ['segments/2.seg.js', 'seg-2'],
    ['assets/images/logo.png', 'png-bytes'],
    ['.DS_Store', 'junk'],
    ['dist.zip', 'zip-bytes'],
    ['metadata.json', '{"stale":true}'],
  ];

  const writeAll = (targetDir, entries) => {
    for (const [relPath, content] of entries) {
      const fullPath = path.join(targetDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  };

  writeAll(dirA, files);
  writeAll(dirB, files.toReversed());

  await generateMetadataJson(dirA, { version: '1.0.0', commit: 'deadbeef' });
  await generateMetadataJson(dirB, { commit: 'deadbeef', version: '1.0.0' });

  const jsonA = fs.readFileSync(path.join(dirA, 'metadata.json'), 'utf8');
  const jsonB = fs.readFileSync(path.join(dirB, 'metadata.json'), 'utf8');

  assert.equal(jsonA, jsonB);
  assert.equal(sha256(jsonA), sha256(jsonB));

  const parsed = JSON.parse(jsonA);
  assert.equal(parsed['.DS_Store'], undefined);
  assert.equal(parsed['dist.zip'], undefined);
  assert.equal(parsed['metadata.json'], undefined);
  assert.equal(parsed['segments/2.seg.js'], sha256('seg-2'));
  assert.equal(parsed['segments/10.seg.js'], sha256('seg-10'));
  assert.equal(parsed['assets/images/logo.png'], sha256('png-bytes'));

  const keys = Object.keys(parsed);
  assert.deepEqual(keys, keys.toSorted());
});
