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
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, '../..');

function write(directory, file, source) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

test('Web smoke validates parsed HTML and catches native promise rejections even when protected UI is ready', async () => {
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
    for (const name of ['@lavamoat', 'jsdom', 'playwright-core']) {
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
      const health = document.createElement('div');
      health.textContent = 'You are offline. Please check your network.';
      document.body.appendChild(health);
      // Model a caught pre-network error: the production console may be
      // stripped, while the rest of the protected application stays visible.
      if (document.documentElement.dataset.health !== 'blocked') {
        fetch('/wallet/v1/health').then((response) => {
          if (response.status === 200 && document.documentElement.dataset.health !== 'stale') {
            health.textContent = 'Online';
          }
        }).catch(() => {});
      }
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
        crossOriginLoading: 'anonymous',
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
        new SubresourceIntegrityPlugin(),
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
    const runSmoke = (output, extraArgs = []) =>
      execFileAsync(
        process.execPath,
        [
          path.join(directory, 'development/lavamoat/smoke-web.cjs'),
          '--chrome',
          executablePath,
          '--output',
          output,
          ...extraArgs,
        ],
        { cwd: directory, timeout: 30_000 },
      );
    const html = path.join(artifact, 'index.html');
    const originalHtml = fs.readFileSync(html, 'utf8');
    const runtime = fs
      .readdirSync(artifact)
      .find((file) => file.startsWith('lavamoat-runtime.'));
    assert.ok(runtime);
    const runtimeSource = `src="/${runtime}"`;
    assert.ok(originalHtml.includes(runtimeSource));
    const application = fs
      .readdirSync(artifact)
      .find((file) => file.startsWith('main.'));
    assert.ok(application);
    const invalidHtml = [
      {
        name: 'runtime after application',
        source: originalHtml.replace(
          '<head>',
          `<head><script src="/${application}"></script>`,
        ),
        error: /HTML must load the protected runtime first/,
      },
      {
        name: 'runtime only in a data attribute',
        source: originalHtml.replace(runtimeSource, `data-${runtimeSource}`),
        error: /HTML must load the protected runtime first/,
      },
      {
        name: 'duplicate runtime',
        source: originalHtml.replace(
          '</head>',
          `<script src="/${runtime}"></script></head>`,
        ),
        error: /2 !== 1/,
      },
      {
        name: 'remote runtime',
        source: originalHtml.replace(
          runtimeSource,
          `src="https://example.com/${runtime}"`,
        ),
        error: /Scripts must be local/,
      },
      {
        name: 'missing integrity',
        source: originalHtml.replace(/ integrity="[^"]+"/, ''),
        error: /HTML integrity must match the final bytes/,
      },
      {
        name: 'altered integrity',
        source: originalHtml.replace(
          /integrity="[^"]+"/,
          'integrity="sha384-invalid"',
        ),
        error: /HTML integrity must match the final bytes/,
      },
      {
        name: 'missing cross-origin mode',
        source: originalHtml.replace(' crossorigin="anonymous"', ''),
        error: /HTML must retain anonymous cross-origin loading/,
      },
    ];
    for (const scenario of invalidHtml) {
      fs.writeFileSync(html, scenario.source);
      await assert.rejects(
        runSmoke(path.join(directory, scenario.name)),
        (error) => {
          assert.equal(error.code, 1);
          assert.match(error.stderr, scenario.error);
          return true;
        },
      );
    }

    // Script-looking strings in comments, raw text, and template fragments
    // must not become external script elements. HTML entities and unquoted
    // attributes must resolve just as they do in the browser.
    const healthyHtml = originalHtml
      .replace(
        '<head>',
        `<head><!-- <script src="missing-comment.js"></script> -->
        <template><script src="missing-template.js"></script></template>
        <script type="application/json">{"markup":"<script src='missing-data.js'>"}</script>
        <script>globalThis.fixtureMarkup = '<script src="missing-string.js">';</script>`,
      )
      .replace(runtimeSource, `src=/${runtime.replace('-', '&#45;')}`);
    fs.writeFileSync(html, healthyHtml);
    const extraRuntime = path.join(artifact, 'extra.js');
    fs.copyFileSync(path.join(artifact, runtime), extraRuntime);
    await assert.rejects(
      runSmoke(path.join(directory, 'duplicate-ses')),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(
          error.stderr,
          /extra\.js must contain untouched SES exactly when it owns the runtime/,
        );
        return true;
      },
    );
    fs.unlinkSync(extraRuntime);
    const applicationPath = path.join(artifact, application);
    const applicationSource = fs.readFileSync(applicationPath);
    fs.appendFileSync(
      applicationPath,
      '\n/* Simulate a post-build source mutation. */',
    );
    await assert.rejects(
      runSmoke(path.join(directory, 'mutated-source')),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /HTML integrity must match the final bytes/);
        return true;
      },
    );
    fs.writeFileSync(applicationPath, applicationSource);
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
    for (const route of healthy.routes) {
      assert.equal(route.healthCheck.responseSource, 'fixture');
      assert.equal(route.healthCheck.requests, 1);
      assert.deepEqual(
        route.healthCheck.responses.map(({ status }) => status),
        [200],
      );
      assert.equal(route.healthCheck.offlineIndicatorVisible, false);
    }
    await assert.rejects(
      runSmoke(path.join(directory, 'live-local-fallback'), [
        '--live-health-check',
      ]),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(
          error.stderr,
          /Live health check must reach an external HTTPS service/,
        );
        return true;
      },
    );

    for (const scenario of [
      {
        mode: 'blocked',
        error: /Application health request must reach the browser/,
      },
      { mode: 'stale', error: /page.waitForFunction: Timeout/ },
    ]) {
      fs.writeFileSync(
        html,
        healthyHtml.replace('<html>', `<html data-health="${scenario.mode}">`),
      );
      const failedOutput = path.join(directory, `health-${scenario.mode}`);
      await assert.rejects(runSmoke(failedOutput), (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, scenario.error);
        return true;
      });
      const failed = JSON.parse(
        fs.readFileSync(path.join(failedOutput, 'report.json'), 'utf8'),
      );
      assert.equal(
        failed.routes[0].healthCheck.requests,
        scenario.mode === 'blocked' ? 0 : 1,
      );
      assert.deepEqual(failed.routes[0].exceptions, []);
      assert.deepEqual(failed.routes[0].consoleErrors, []);
    }

    fs.writeFileSync(
      html,
      healthyHtml.replace('<html>', '<html data-reject="yes">'),
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

test('shared HTML preload preserves native capture, once, abort, and resize listener options', async () => {
  const candidates = [
    process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const executablePath = candidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  assert.ok(
    executablePath,
    'Install Chromium or set ONEKEY_LAVAMOAT_TEST_CHROME',
  );
  const source = fs.readFileSync(
    path.join(repoRoot, 'apps/ext/src/assets/preload-html-head.js'),
    'utf8',
  );
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('http://127.0.0.1/**', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html><head><meta charset="utf-8"><script>
        globalThis.fixture = { ready: 0 };
        // Electron registers this native capture listener before the HTML
        // preload executes. It must remove itself at the interactive transition.
        const listener = () => {
          if (document.readyState === 'loading') return;
          fixture.ready += 1;
          customElements.define('onekey-fixture-view', class extends HTMLElement {});
          removeEventListener('readystatechange', listener, true);
        };
        addEventListener('readystatechange', listener, true);
      </script><script>${source}</script></head><body><main id="root"></main></body></html>`,
      }),
    );
    await page.goto('http://127.0.0.1/preload');
    assert.equal(
      await page.evaluate(() => fixture.ready),
      1,
      'the capture listener must be removed before the complete transition',
    );
    const behavior = await page.evaluate(async () => {
      const target = document.createElement('div');
      document.body.appendChild(target);
      const fire = (name) => target.dispatchEvent(new Event(name));
      let captured = 0;
      const capture = () => {
        captured += 1;
      };
      addEventListener('fixture-capture', capture, { capture: true });
      fire('fixture-capture');
      removeEventListener('fixture-capture', capture, true);
      fire('fixture-capture');
      let once = 0;
      addEventListener(
        'fixture-once',
        () => {
          once += 1;
        },
        { capture: true, once: true },
      );
      fire('fixture-once');
      fire('fixture-once');
      let aborted = 0;
      const controller = new AbortController();
      addEventListener(
        'fixture-abort',
        () => {
          aborted += 1;
        },
        { capture: true, signal: controller.signal },
      );
      controller.abort();
      fire('fixture-abort');
      let resized = 0;
      const resize = () => {
        resized += 1;
      };
      addEventListener('resize', resize, { capture: true });
      fire('resize');
      await new Promise((resolve) => setTimeout(resolve, 350));
      const beforeRemove = resized;
      removeEventListener('resize', resize, true);
      fire('resize');
      await new Promise((resolve) => setTimeout(resolve, 350));
      target.remove();
      return { captured, once, aborted, beforeRemove, resized };
    });
    assert.deepEqual(behavior, {
      captured: 1,
      once: 1,
      aborted: 0,
      beforeRemove: 1,
      resized: 1,
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
