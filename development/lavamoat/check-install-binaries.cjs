// cspell:ignore esbuild lavamoat

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const { parse } = require('yaml');

const checker = require('./supply-chain.cjs');

const root = path.resolve(__dirname, '../..');
function run(args, executable = process.execPath) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env: {
      ...process.env,
      // Verify the locked platform packages independently of local overrides.
      ESBUILD_BINARY_PATH: undefined,
      SENTRY_BINARY_PATH: undefined,
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  return result.stdout.trim();
}

function checkEsbuild(directory, version) {
  const manifestPath = path.join(directory, 'package.json');
  const localRequire = createRequire(manifestPath);
  const manifest = localRequire(manifestPath);
  const distributions = [];
  for (const name of Object.keys(manifest.optionalDependencies)) {
    try {
      const filename = localRequire.resolve(`${name}/package.json`);
      const distribution = localRequire(filename);
      if (
        distribution.os?.includes(process.platform) &&
        distribution.cpu?.includes(process.arch)
      ) {
        assert.equal(distribution.version, version);
        const binary = path.join(
          path.dirname(filename),
          process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild',
        );
        assert.ok(fs.existsSync(binary), `Missing locked binary: ${binary}`);
        distributions.push({ name, binary });
      }
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  assert.equal(
    distributions.length,
    1,
    `Missing host platform package: esbuild@${version}`,
  );
  // Older installers can replace bin/esbuild with a native executable. Execute
  // the verified platform binary directly instead of treating that entry as JS.
  assert.equal(run(['--version'], distributions[0].binary), version);
  assert.equal(
    run([
      '-e',
      `const assert = require('node:assert/strict');
         const tool = require(process.argv[1]);
         assert.match(tool.transformSync('const answer: number = 42', { loader: 'ts' }).code, /42/);
         console.log(tool.version);`,
      directory,
    ]),
    version,
  );
}

function main() {
  const context = checker.loadContext(root, parse);
  const binaries = checker
    .checkInstalled(context)
    .filter(({ resolution }) =>
      /^esbuild@npm:|^@sentry\/cli@npm:/.test(resolution),
    );
  assert.ok(binaries.length, 'No installed build-tool binaries found');
  for (const { directory, resolution, version } of binaries) {
    assert.equal(
      context.approvals.get(resolution).allow,
      false,
      `${resolution} must not enable its fallback installer`,
    );
    if (resolution.startsWith('esbuild@')) {
      checkEsbuild(directory, version);
    } else {
      run([
        '-e',
        `const assert = require('node:assert/strict');
       const fs = require('node:fs');
       const { createRequire } = require('node:module');
       const localRequire = createRequire(process.argv[1] + '/package.json');
       const helper = localRequire('./js/helper.js');
       const { packageName, subpath } = helper.getDistributionForThisPlatform();
       const expected = localRequire.resolve(packageName + '/' + subpath);
       assert.equal(fs.realpathSync(helper.getPath()), fs.realpathSync(expected));`,
        directory,
      ]);
      assert.equal(
        run([path.join(directory, 'bin/sentry-cli'), '--version']),
        `sentry-cli ${version}`,
      );
    }
    console.log(
      `Verified locked binary and API: ${resolution} (${path.relative(root, directory)})`,
    );
  }
}

if (require.main === module) main();

module.exports = { checkEsbuild };
