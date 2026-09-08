// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');

const LavaMoatPlugin = require('@lavamoat/webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { chromium } = require('playwright-core');
const webpack = require('webpack');

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '../..');

function write(directory, file, source) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

test('Web smoke catches native promise rejections before deferred SES reporting even when protected UI is ready', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-smoke-rejection-')),
  );
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'smoke-root',
        private: true,
        dependencies: { 'smoke-dependency': '1.0.0' },
      }),
    );
    const dependency = 'node_modules/smoke-dependency';
    write(
      directory,
      `${dependency}/package.json`,
      JSON.stringify({ name: 'smoke-dependency', version: '1.0.0' }),
    );
    write(
      directory,
      `${dependency}/index.js`,
      'module.exports = Object.isFrozen(Object.prototype);',
    );
    // Reach the same real package through the CLI's normal Node resolution.
    for (const name of ['@lavamoat', 'playwright-core']) {
      fs.symlinkSync(
        path.join(repoRoot, 'node_modules', name),
        path.join(directory, 'node_modules', name),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    }
    write(
      directory,
      'policy.json',
      JSON.stringify({ resources: { 'smoke-dependency': {} } }),
    );
    write(
      directory,
      'index.js',
      `
      if (!require('smoke-dependency')) throw new Error('Unprotected fixture');
      if (typeof globalThis.__onekeyLavaMoatSmokeRejection__ !== 'undefined') {
        throw new Error('Smoke telemetry binding leaked into application globals');
      }
      document.title = location.pathname === '/' ? 'OneKey - Market' : 'OneKey';
      document.body.innerHTML = location.pathname === '/'
        ? '<main data-testid="market-page"><nav data-testid="market-tabs">Favorites</nav><div data-testid="market-trending-desktop-toolbar"><button>Filter</button></div></main>'
        : '<main data-testid="onboarding-get-started-page"><button data-testid="onboarding-create-wallet-button">Create new wallet</button><button data-testid="onboarding-import-wallet-button">Add existing wallet</button></main>';
      if (document.documentElement.dataset.reject === 'yes') {
        // Retaining this promise prevents SES's GC-driven diagnostic from being
        // the only observable signal. UI remains fully rendered throughout.
        setTimeout(() => {
          globalThis.fixtureRetainedRejection = Promise.reject(new Error('fixture retained rejection'));
        }, 50);
      }
    `,
    );
    const artifact = path.join(directory, 'apps/web/web-build');
    const compiler = webpack({
      mode: 'production',
      context: directory,
      entry: './index.js',
      output: {
        path: artifact,
        filename: '[name].[contenthash:10].bundle.js',
        publicPath: '/',
      },
      optimization: {
        minimize: false,
        concatenateModules: false,
        runtimeChunk: { name: 'lavamoat-runtime' },
      },
      plugins: [
        new HtmlWebpackPlugin({
          templateContent: `<!doctype html><html><head><meta charset="utf-8"><title>OneKey</title><link rel="icon" href="data:,"><script>
            addEventListener('unhandledrejection', (event) => {
              if (event.defaultPrevented) console.error('Smoke suppressed the application rejection handler');
            });
          </script></head><body></body></html>`,
        }),
        new LavaMoatPlugin({
          rootDir: directory,
          policyLocation: directory,
          inlineLockdown: /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/,
          lockdown: {
            errorTrapping: 'none',
            errorTaming: 'unsafe',
            reporting: 'none',
          },
        }),
      ],
    });
    try {
      const stats = await new Promise((resolve, reject) => {
        compiler.run((error, result) =>
          error ? reject(error) : resolve(result),
        );
      });
      assert.equal(
        stats.hasErrors(),
        false,
        stats.toString({ all: false, errors: true }),
      );
    } finally {
      await new Promise((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      );
    }
    for (const file of ['smoke-web.cjs', 'error.cjs']) {
      write(
        directory,
        `development/lavamoat/${file}`,
        fs.readFileSync(path.join(__dirname, file), 'utf8'),
      );
    }
    const executablePath =
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME ||
      [
        chromium.executablePath(),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ].find((candidate) => fs.existsSync(candidate));
    assert.ok(
      executablePath && fs.existsSync(executablePath),
      'Install Chromium with yarn exec playwright-core install chromium or set ONEKEY_LAVAMOAT_TEST_CHROME',
    );
    const runSmoke = (output) =>
      execFileAsync(
        process.execPath,
        [
          path.join(directory, 'development/lavamoat/smoke-web.cjs'),
          '--chrome',
          executablePath,
          '--output',
          output,
        ],
        { cwd: directory, timeout: 20_000 },
      );
    const healthyOutput = path.join(directory, 'healthy');
    await runSmoke(healthyOutput);
    const healthy = JSON.parse(
      fs.readFileSync(path.join(healthyOutput, 'report.json'), 'utf8'),
    );
    assert.deepEqual(
      healthy.routes.map((route) => route.route),
      ['/', '/wallet/'],
    );
    assert.deepEqual(
      healthy.routes.map((route) => route.readyScreen),
      ['market', 'onboarding'],
    );
    assert.ok(
      healthy.routes.every((route) => route.unhandledRejections.length === 0),
    );

    const html = path.join(artifact, 'index.html');
    fs.writeFileSync(
      html,
      fs
        .readFileSync(html, 'utf8')
        .replace('<html>', '<html data-reject="yes">'),
    );
    const rejectedOutput = path.join(directory, 'rejected');
    const started = Date.now();
    await assert.rejects(runSmoke(rejectedOutput), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /fixture retained rejection/);
      return true;
    });
    assert.ok(
      Date.now() - started < 10_000,
      'Native rejection must fail before the readiness timeout or GC',
    );
    const rejected = JSON.parse(
      fs.readFileSync(path.join(rejectedOutput, 'report.json'), 'utf8'),
    );
    assert.equal(rejected.routes.length, 1);
    const [route] = rejected.routes;
    assert.equal(route.unhandledRejections.length, 1);
    assert.match(
      route.unhandledRejections[0].message,
      /fixture retained rejection/,
    );
    assert.match(
      route.unhandledRejections[0].stack,
      /main\.[a-f0-9]+\.bundle\.js/,
    );
    assert.deepEqual(
      route.exceptions,
      [],
      'The CDP exception channel alone missed this rejection',
    );
    assert.deepEqual(
      route.consoleErrors,
      [],
      'SES has not yet emitted its deferred rejection error',
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
