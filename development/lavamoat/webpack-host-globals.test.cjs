// cspell:ignore LavaMoat lavamoat sonner DOMPurify jsdom

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const { JSDOM } = require('jsdom');
const { chromium } = require('playwright-core');
const webpack = require('webpack');

const repoRoot = path.resolve(__dirname, '../..');
const resource = 'external:../../node_modules/sonner/dist/index.mjs';

function write(directory, file, content) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

async function compile(
  directory,
  generatePolicyOnly,
  extra = {},
  pluginOptions = {},
) {
  const compiler = webpack({
    mode: 'production',
    context: directory,
    entry: './index.js',
    output: { path: path.join(directory, 'dist'), filename: 'main.js' },
    optimization: { minimize: false },
    ...extra,
    plugins: [
      new LavaMoatPlugin({
        rootDir: directory,
        policyLocation: directory,
        generatePolicyOnly,
        readableResourceIds: true,
        inlineLockdown: /^main\.js$/,
        // Match production diagnostics so browser failures stay observable.
        lockdown: { errorTrapping: 'none', errorTaming: 'unsafe' },
        ...pluginOptions,
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
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('reviewed Sonner DOM permissions initialize its shipped purifier and preserve sanitization without direct network grants', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-sonner-')),
  );
  try {
    const sonnerDirectory = path.dirname(require.resolve('sonner'));
    const source = fs.readFileSync(
      path.join(sonnerDirectory, 'index.mjs'),
      'utf8',
    );
    assert.ok(source.includes('DOMPurify 3.0.10'));
    assert.ok(source.includes('var ze=Fe();'));
    // Keep the shipped implementation intact. Only expose its otherwise private
    // sanitizer and same-compartment capability probes to the test entry.
    write(
      directory,
      'node_modules/sonner/index.mjs',
      `${source}\nexport const fixturePurifier = ze;
       export const fixtureCapabilities = () => ({ fetch: typeof fetch,
         XMLHttpRequest: typeof XMLHttpRequest, WebSocket: typeof WebSocket,
         sendBeacon: typeof navigator?.sendBeacon, nodeFilterAll: typeof NodeFilter.SHOW_ALL,
         trustedTypesGetPropertyType: typeof trustedTypes?.getPropertyType });`,
    );
    const dependencies = {};
    for (const name of ['react', 'react-dom']) {
      const manifestPath = require.resolve(`${name}/package.json`);
      dependencies[name] = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8'),
      ).version;
      fs.symlinkSync(
        path.dirname(manifestPath),
        path.join(directory, 'node_modules', name),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    }
    write(
      directory,
      'node_modules/sonner/package.json',
      JSON.stringify({
        name: 'sonner',
        version: '1.4.41',
        main: 'index.mjs',
        dependencies,
      }),
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'sonner-policy-fixture',
        private: true,
        dependencies: { sonner: '1.4.41', ...dependencies },
      }),
    );
    write(
      directory,
      'index.js',
      `import { toast, Toaster, fixturePurifier, fixtureCapabilities } from 'sonner';
       Object.assign(fixtureResult, { toastType: typeof toast, toasterType: typeof Toaster,
         purifier: fixturePurifier, capabilities: fixtureCapabilities });`,
    );
    await compile(directory, true);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    assert.ok(
      generated.resources.sonner,
      'the copied original source remains a dependency compartment',
    );
    const webPolicy = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'lavamoat/webpack/web/policy.json'),
        'utf8',
      ),
    );
    const webOverride = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'lavamoat/webpack/web/policy-override.json'),
        'utf8',
      ),
    );
    const desktopOverride = JSON.parse(
      fs.readFileSync(
        path.join(
          repoRoot,
          'lavamoat/webpack/desktop-renderer/policy-override.json',
        ),
        'utf8',
      ),
    );
    assert.deepEqual(
      webOverride.resources[resource],
      desktopOverride.resources[resource],
    );
    assert.deepEqual(
      Object.keys(webOverride.resources[resource].globals).toSorted(),
      [
        'DOMParser',
        'DocumentFragment',
        'Element',
        'HTMLFormElement',
        'HTMLTemplateElement',
        'NamedNodeMap',
        'Node',
        'NodeFilter.SHOW_COMMENT',
        'NodeFilter.SHOW_ELEMENT',
        'NodeFilter.SHOW_PROCESSING_INSTRUCTION',
        'NodeFilter.SHOW_TEXT',
        'trustedTypes.createPolicy',
        'trustedTypes.getAttributeType',
      ].toSorted(),
    );
    const desktopPolicy = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'lavamoat/webpack/desktop-renderer/policy.json'),
        'utf8',
      ),
    );
    assert.deepEqual(
      webPolicy.resources[resource].globals,
      desktopPolicy.resources[resource].globals,
    );
    // Fixture-only probes must never generate grants. Use the actual reviewed
    // production globals and retain only the fixture's React dependency edges.
    generated.resources.sonner.globals = webPolicy.resources[resource].globals;
    write(directory, 'policy.json', JSON.stringify(generated));
    await compile(directory, false);
    const withoutOverride = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    const broken = new JSDOM(
      '<!doctype html><html><head></head><body></body></html>',
      { runScripts: 'outside-only' },
    );
    try {
      broken.window.fixtureResult = {};
      assert.throws(
        () => vm.runInContext(withoutOverride, broken.getInternalVMContext()),
        /prototype/,
      );
    } finally {
      broken.window.close();
    }
    write(
      directory,
      'policy-override.json',
      JSON.stringify({
        resources: { sonner: webOverride.resources[resource] },
      }),
    );
    await compile(directory, false);
    const protectedSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body></body></html>',
      { runScripts: 'outside-only', url: 'https://sonner-fixture.invalid/' },
    );
    try {
      dom.window.fixtureResult = {};
      dom.window.fetch = () => assert.fail('Sonner must not receive fetch');
      dom.window.navigator.sendBeacon = () =>
        assert.fail('Sonner must not receive sendBeacon');
      assert.equal(typeof dom.window.XMLHttpRequest, 'function');
      assert.equal(typeof dom.window.WebSocket, 'function');
      const trustedTypeCalls = [];
      // jsdom has no native Trusted Types API. This receiver-sensitive facade
      // exercises the shipped purifier's two reviewed method endowments.
      const trustedTypes = {
        createPolicy(name, rules) {
          assert.equal(this, trustedTypes);
          trustedTypeCalls.push(name);
          return rules;
        },
        getAttributeType() {
          assert.equal(this, trustedTypes);
          trustedTypeCalls.push('getAttributeType');
          return null;
        },
        getPropertyType() {
          assert.fail('unreviewed Trusted Types methods must be inaccessible');
        },
      };
      dom.window.trustedTypes = trustedTypes;
      vm.runInContext(protectedSource, dom.getInternalVMContext());
      const result = dom.window.fixtureResult;
      assert.equal(result.toastType, 'function');
      assert.equal(result.toasterType, 'function');
      assert.equal(
        result.purifier.isSupported,
        true,
        'sanitization must not silently disable itself',
      );
      assert.equal(result.purifier.version, '3.0.10');
      assert.deepEqual(JSON.parse(JSON.stringify(result.capabilities())), {
        fetch: 'undefined',
        XMLHttpRequest: 'undefined',
        WebSocket: 'undefined',
        sendBeacon: 'undefined',
        nodeFilterAll: 'undefined',
        trustedTypesGetPropertyType: 'undefined',
      });
      const dirty =
        '<b>Safe title</b><script>globalThis.__sonnerXss = true</script><img src="x" onerror="globalThis.__sonnerXss = true"><a href="javascript:alert(1)">link</a><svg><g onload="alert(1)"></g></svg><iframe srcdoc="<script>alert(1)</script>"></iframe><form><input name="attributes"></form>';
      const clean = result.purifier.sanitize(dirty);
      assert.ok(clean.includes('<b>Safe title</b>'));
      assert.doesNotMatch(
        clean,
        /<script|onerror|onload|javascript:|<iframe|srcdoc|name="attributes"/i,
      );
      assert.ok(result.purifier.removed.length >= 6);
      assert.ok(trustedTypeCalls.includes('dompurify'));
      assert.ok(trustedTypeCalls.includes('getAttributeType'));
      assert.equal(dom.window.__sonnerXss, undefined);
      const template = result.purifier.sanitize(
        '<template><img src="x" onerror="alert(1)"></template>',
        { RETURN_DOM_FRAGMENT: true },
      );
      assert.ok(template instanceof dom.window.DocumentFragment);
      assert.equal(template.querySelector('[onerror]'), null);
      assert.equal(
        vm.runInContext(
          'Object.isFrozen(Object.prototype)',
          dom.getInternalVMContext(),
        ),
        true,
      );
    } finally {
      dom.window.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function exposeWindowEvents(hostWindow) {
  // jsdom exposes these through virtual proxy lookup without real descriptors.
  // Browsers expose descriptor-backed EventTarget methods that LavaMoat can copy.
  for (const name of ['addEventListener', 'removeEventListener']) {
    Object.defineProperty(hostWindow, name, {
      configurable: true,
      value: hostWindow[name].bind(hostWindow),
    });
  }
}

test('Dimensions reads reviewed scalar getters on initialization and every viewport resize', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-dimensions-')),
  );
  const resourceName = '@onekeyhq/kit>expo-camera>react-native-web';
  try {
    const reactNativeWebManifest =
      require.resolve('react-native-web/package.json');
    const reactNativeWeb = path.dirname(reactNativeWebManifest);
    const reactNativeWebVersion = JSON.parse(
      fs.readFileSync(reactNativeWebManifest, 'utf8'),
    ).version;
    for (const file of [
      'dist/exports/Dimensions/index.js',
      'dist/modules/canUseDom/index.js',
    ]) {
      write(
        directory,
        `node_modules/react-native-web/${file}`,
        fs.readFileSync(path.join(reactNativeWeb, file)),
      );
    }
    fs.appendFileSync(
      path.join(
        directory,
        'node_modules/react-native-web/dist/exports/Dimensions/index.js',
      ),
      `
      export function fixtureScalarPermissions() {
        return { availableWidth: typeof screen.availWidth,
          screenHeightWrite: Reflect.set(screen, 'height', 1),
          pixelRatioWrite: Reflect.set(window, 'devicePixelRatio', 1) };
      }
    `,
    );
    const fbjsManifest = require.resolve('fbjs/package.json');
    fs.symlinkSync(
      path.dirname(fbjsManifest),
      path.join(directory, 'node_modules/fbjs'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    write(
      directory,
      'node_modules/react-native-web/package.json',
      JSON.stringify({
        name: 'react-native-web',
        version: reactNativeWebVersion,
        main: 'dist/exports/Dimensions/index.js',
        dependencies: {
          fbjs: JSON.parse(fs.readFileSync(fbjsManifest, 'utf8')).version,
        },
      }),
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'dimensions-policy-fixture',
        private: true,
        dependencies: { 'react-native-web': reactNativeWebVersion },
      }),
    );
    write(
      directory,
      'index.js',
      `
      import Dimensions, { fixtureScalarPermissions } from 'react-native-web';
      Object.assign(fixtureResult, { Dimensions, fixtureScalarPermissions,
        initialWindow: Dimensions.get('window'), initialScreen: Dimensions.get('screen') });
    `,
    );
    await compile(directory, true);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    const web = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'lavamoat/webpack/web/policy.json'),
        'utf8',
      ),
    );
    const desktop = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'lavamoat/webpack/desktop-renderer/policy.json'),
        'utf8',
      ),
    );
    const webOverride = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'lavamoat/webpack/web/policy-override.json'),
        'utf8',
      ),
    );
    const desktopOverride = JSON.parse(
      fs.readFileSync(
        path.join(
          repoRoot,
          'lavamoat/webpack/desktop-renderer/policy-override.json',
        ),
        'utf8',
      ),
    );
    assert.deepEqual(
      web.resources[resourceName].globals,
      desktop.resources[resourceName].globals,
    );
    assert.deepEqual(
      webOverride.resources[resourceName],
      desktopOverride.resources[resourceName],
    );
    assert.deepEqual(webOverride.resources[resourceName], {
      globals: {
        devicePixelRatio: true,
        'screen.height': true,
        'screen.width': true,
      },
    });
    generated.resources['react-native-web'].globals =
      web.resources[resourceName].globals;
    write(directory, 'policy.json', JSON.stringify(generated));
    await compile(directory, false);
    const withoutOverride = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    const broken = new JSDOM(
      '<!doctype html><html><head></head><body></body></html>',
      { runScripts: 'outside-only' },
    );
    try {
      exposeWindowEvents(broken.window);
      broken.window.fixtureResult = {};
      assert.throws(
        () => vm.runInContext(withoutOverride, broken.getInternalVMContext()),
        /height/,
      );
    } finally {
      broken.window.close();
    }
    write(
      directory,
      'policy-override.json',
      JSON.stringify({
        resources: { 'react-native-web': webOverride.resources[resourceName] },
      }),
    );
    await compile(directory, false);
    const protectedSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    for (const useVisualViewport of [false, true]) {
      const dom = new JSDOM(
        '<!doctype html><html><head></head><body></body></html>',
        { runScripts: 'outside-only' },
      );
      try {
        exposeWindowEvents(dom.window);
        const host = {
          screenHeight: 1080,
          screenWidth: 1920,
          pixelRatio: 2,
          height: 800,
          width: 1200,
          scale: 1,
        };
        Object.defineProperty(dom.window, 'devicePixelRatio', {
          configurable: true,
          get() {
            assert.equal(this, dom.window);
            return host.pixelRatio;
          },
        });
        for (const [key, stateKey] of [
          ['height', 'screenHeight'],
          ['width', 'screenWidth'],
        ]) {
          Object.defineProperty(dom.window.screen, key, {
            configurable: true,
            get() {
              assert.equal(this, dom.window.screen);
              return host[stateKey];
            },
          });
        }
        Object.defineProperty(
          dom.window.document.documentElement,
          'clientHeight',
          { get: () => host.height },
        );
        Object.defineProperty(
          dom.window.document.documentElement,
          'clientWidth',
          { get: () => host.width },
        );
        const viewport = new dom.window.EventTarget();
        if (useVisualViewport) {
          for (const key of ['height', 'width', 'scale'])
            Object.defineProperty(viewport, key, { get: () => host[key] });
          dom.window.visualViewport = viewport;
        }
        dom.window.fixtureResult = {};
        vm.runInContext(protectedSource, dom.getInternalVMContext());
        const result = dom.window.fixtureResult;
        const plain = (value) => JSON.parse(JSON.stringify(value));
        assert.deepEqual(plain(result.initialWindow), {
          fontScale: 1,
          height: 800,
          width: 1200,
          scale: 2,
        });
        assert.deepEqual(plain(result.initialScreen), {
          fontScale: 1,
          height: 1080,
          width: 1920,
          scale: 2,
        });
        assert.deepEqual(plain(result.fixtureScalarPermissions()), {
          availableWidth: 'undefined',
          screenHeightWrite: false,
          pixelRatioWrite: false,
        });
        assert.equal(host.pixelRatio, 2);
        assert.equal(host.screenHeight, 1080);
        const changes = [];
        const subscription = result.Dimensions.addEventListener(
          'change',
          (event) => changes.push(plain(event)),
        );
        Object.assign(host, {
          screenHeight: 1440,
          screenWidth: 2560,
          pixelRatio: 3,
          height: 600,
          width: 900,
          scale: 1.5,
        });
        const resizeTarget = useVisualViewport ? viewport : dom.window;
        resizeTarget.dispatchEvent(new dom.window.Event('resize'));
        assert.equal(changes.length, 1);
        assert.deepEqual(changes[0], {
          window: {
            fontScale: 1,
            height: useVisualViewport ? 900 : 600,
            width: useVisualViewport ? 1350 : 900,
            scale: 3,
          },
          screen: { fontScale: 1, height: 1440, width: 2560, scale: 3 },
        });
        assert.deepEqual(
          plain(result.Dimensions.get('screen')),
          changes[0].screen,
        );
        subscription.remove();
        resizeTarget.dispatchEvent(new dom.window.Event('resize'));
        assert.equal(
          changes.length,
          1,
          'listener removal must still work after hardening',
        );
      } finally {
        dom.window.close();
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('worker-loader uses reviewed capabilities to exchange a real worker message across the documented unprotected realm', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-worker-')),
  );
  const workerResource =
    'external:../../node_modules/worker-loader/dist/runtime/inline.js';
  let browser;
  let server;
  try {
    const expected = {
      globals: {
        Blob: true,
        'URL.createObjectURL': true,
        'URL.revokeObjectURL': true,
        Worker: true,
      },
    };
    for (const target of ['web', 'desktop-renderer']) {
      const overrides = JSON.parse(
        fs.readFileSync(
          path.join(
            repoRoot,
            'lavamoat/webpack',
            target,
            'policy-override.json',
          ),
          'utf8',
        ),
      );
      assert.deepEqual(overrides.resources[workerResource], expected);
      const policy = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'lavamoat/webpack', target, 'policy.json'),
          'utf8',
        ),
      );
      const callers = Object.entries(policy.resources)
        .filter(([, entry]) => entry.packages?.[workerResource])
        .map(([name]) => name);
      assert.deepEqual(
        callers,
        ['@onekeyhq/kit'],
        'new callers of this code-execution helper require review',
      );
    }
    const inline = require.resolve('worker-loader/dist/runtime/inline.js');
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'worker-policy-fixture',
        private: true,
        dependencies: { 'worker-owner': '1.0.0' },
      }),
    );
    write(
      directory,
      'node_modules/worker-owner/package.json',
      JSON.stringify({ name: 'worker-owner', version: '1.0.0' }),
    );
    write(
      directory,
      'node_modules/worker-owner/echo.worker.js',
      `
      onmessage = ({ data }) => postMessage({ echo: data, harden: typeof harden,
        compartment: typeof Compartment, fetch: typeof fetch,
        objectFrozen: Object.isFrozen(Object.prototype) });
    `,
    );
    write(
      directory,
      'node_modules/worker-owner/index.js',
      `
      import EchoWorker from './echo.worker.js';
      import inline from ${JSON.stringify(inline)};
      export const start = () => new EchoWorker();
      export const unsupported = () => inline('postMessage("unexpected")', 'SharedWorker');
    `,
    );
    write(
      directory,
      'index.js',
      `
      import { start, unsupported } from 'worker-owner';
      Object.assign(fixtureResult, { start, unsupported });
    `,
    );
    const extra = {
      output: {
        path: path.join(directory, 'dist'),
        filename: 'main.js',
        publicPath: '/',
      },
      module: {
        rules: [
          {
            test: /\.worker\.js$/,
            use: [
              {
                loader: require.resolve('worker-loader'),
                options: {
                  inline: 'fallback',
                  filename: 'echo.[contenthash:10].worker.js',
                },
              },
            ],
          },
        ],
      },
    };
    await compile(directory, true, extra);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    const runtimeName = Object.keys(
      generated.resources['worker-owner'].packages,
    ).find((name) => name.endsWith('/worker-loader/dist/runtime/inline.js'));
    assert.ok(
      runtimeName,
      'the real worker-loader runtime remains its own dependency resource',
    );
    assert.equal(
      generated.resources[runtimeName],
      undefined,
      'untracked global aliases explain the original missing resource',
    );
    write(
      directory,
      'policy-override.json',
      JSON.stringify({ resources: { [runtimeName]: expected } }),
    );
    await compile(directory, false, extra);
    const main = fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8');
    const workerFile = fs
      .readdirSync(path.join(directory, 'dist'))
      .find((file) => file.endsWith('.worker.js'));
    assert.ok(
      workerFile,
      'the actual worker-loader fallback asset must be emitted',
    );
    const workerSource = fs.readFileSync(
      path.join(directory, 'dist', workerFile),
      'utf8',
    );
    assert.doesNotMatch(
      workerSource,
      /\._LM_|SES sources included by LavaMoat|repairIntrinsics/,
    );
    const failures = [];
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(
          '<!doctype html><html><head><meta charset="utf-8"><title>Worker fixture</title></head><body><script>globalThis.fixtureResult = {};</script><script src="/main.js"></script></body></html>',
        );
      } else if (pathname === '/main.js' || pathname === `/${workerFile}`) {
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
        });
        response.end(pathname === '/main.js' ? main : workerSource);
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const candidates = [
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
      chromium.executablePath(),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean);
    const executablePath =
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME ||
      candidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(
      executablePath && fs.existsSync(executablePath),
      'Install Chromium with yarn exec playwright-core install chromium or set ONEKEY_LAVAMOAT_TEST_CHROME',
    );
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    await page.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      globalThis.fixtureURLs = { created: [], revoked: [] };
      URL.createObjectURL = (value) => {
        const url = create(value);
        globalThis.fixtureURLs.created.push(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        globalThis.fixtureURLs.revoked.push(url);
        return revoke(url);
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {
      waitUntil: 'load',
    });
    assert.deepEqual(
      failures,
      [],
      'the protected worker fixture must initialize',
    );
    const result = await page.evaluate(async () => {
      const worker = globalThis.fixtureResult.start();
      let timeout;
      try {
        const message = await new Promise((resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Worker did not respond')),
            5000,
          );
          worker.onmessage = ({ data }) => resolve(data);
          worker.onerror = (event) => reject(new Error(event.message));
          worker.postMessage('reviewed-worker-message');
        });
        let unsupportedRejected = false;
        try {
          globalThis.fixtureResult.unsupported();
        } catch {
          unsupportedRejected = true;
        }
        return {
          message,
          unsupportedRejected,
          parentFrozen: Object.isFrozen(Object.prototype),
          urls: globalThis.fixtureURLs,
        };
      } finally {
        clearTimeout(timeout);
        worker.terminate();
      }
    });
    assert.deepEqual(result.message, {
      echo: 'reviewed-worker-message',
      harden: 'undefined',
      compartment: 'undefined',
      fetch: 'function',
      objectFrozen: false,
    });
    assert.equal(result.parentFrozen, true);
    assert.equal(
      result.unsupportedRejected,
      true,
      'SharedWorker and legacy constructors are not granted',
    );
    assert.ok(result.urls.created[0].startsWith('blob:'));
    assert.equal(
      result.urls.revoked[0],
      result.urls.created[0],
      'successful workers must revoke their object URL',
    );
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reviewed resize detector aliases initialize and resize with real DOM calls while exposing the documented DOM authority', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-resize-')),
  );
  const resizeResource =
    'external:../../node_modules/react-virtualized/dist/es/vendor/detectElementResize.js';
  const expected = {
    globals: {
      cancelAnimationFrame: true,
      'document.createElement': true,
      getComputedStyle: true,
      requestAnimationFrame: true,
    },
  };
  let browser;
  let server;
  try {
    for (const target of ['web', 'desktop-renderer']) {
      const overrides = JSON.parse(
        fs.readFileSync(
          path.join(
            repoRoot,
            'lavamoat/webpack',
            target,
            'policy-override.json',
          ),
          'utf8',
        ),
      );
      assert.deepEqual(overrides.resources[resizeResource], expected);
    }
    const source = fs.readFileSync(
      require.resolve('react-virtualized/dist/es/vendor/detectElementResize.js'),
      'utf8',
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'resize-policy-fixture',
        private: true,
        dependencies: { 'resize-owner': '1.0.0' },
      }),
    );
    write(
      directory,
      'node_modules/resize-owner/package.json',
      JSON.stringify({
        name: 'resize-owner',
        version: '1.0.0',
        main: 'index.js',
      }),
    );
    // Preserve the shipped function and expose same-compartment probes only.
    write(
      directory,
      'node_modules/resize-owner/index.js',
      `${source}
      export const fixtureCapabilities = () => {
        const scope = window;
        let fetchRejected = false;
        try { scope.fetch('/blocked'); } catch { fetchRejected = true; }
        return { fetchRejected, fetch: typeof scope.fetch, XMLHttpRequest: typeof scope.XMLHttpRequest,
          WebSocket: typeof scope.WebSocket, localStorage: typeof scope.localStorage,
          cookie: typeof scope.document?.cookie, defaultView: typeof scope.document?.defaultView,
          attachEvent: typeof scope.document?.attachEvent, prefixedRaf: typeof scope.webkitRequestAnimationFrame,
          setTimeout: typeof scope.setTimeout };
      };
      export const fixtureDomAuthority = () => {
        const scope = window;
        const node = scope.document.createElement('div');
        return { ownerFetch: typeof node.ownerDocument.defaultView.fetch,
          ownerCookie: typeof node.ownerDocument.cookie,
          ownerIsCompartmentWindow: node.ownerDocument.defaultView === scope };
      };`,
    );
    write(
      directory,
      'index.js',
      `
      import create, { fixtureCapabilities, fixtureDomAuthority } from 'resize-owner';
      Object.assign(fixtureResult, { create, fixtureCapabilities, fixtureDomAuthority });
    `,
    );
    await compile(directory, true);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    // The production source has no generated global grants: its window alias is
    // not followed by static analysis. Capability probes must not change that baseline.
    generated.resources['resize-owner'] = {};
    write(directory, 'policy.json', JSON.stringify(generated));
    await compile(directory, false);
    let main = fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8');
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(
          '<!doctype html><html><head><meta charset="utf-8"><title>Resize fixture</title></head><body><script>globalThis.fixtureResult = {};</script><script src="/main.js"></script></body></html>',
        );
      } else if (pathname === '/main.js') {
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
        });
        response.end(main);
      } else response.writeHead(404).end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
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
    browser = await chromium.launch({ executablePath, headless: true });
    const url = `http://127.0.0.1:${server.address().port}/`;
    const broken = await browser.newContext();
    try {
      const page = await broken.newPage();
      await page.goto(url);
      const failure = await page.evaluate(() => {
        try {
          fixtureResult.create();
          return null;
        } catch (error) {
          return error.message;
        }
      });
      assert.match(failure, /createElement/);
      assert.equal(
        await page.evaluate(
          () =>
            typeof fixtureResult.create(undefined, globalThis)
              .addResizeListener,
        ),
        'function',
        'an explicitly passed raw hostWindow already conveys DOM authority',
      );
    } finally {
      await broken.close();
    }
    write(
      directory,
      'policy-override.json',
      JSON.stringify({ resources: { 'resize-owner': expected } }),
    );
    await compile(directory, false);
    main = fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8');
    const context = await browser.newContext();
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.addInitScript(() => {
      const createElement = document.createElement.bind(document);
      const computed = getComputedStyle.bind(globalThis);
      const request = requestAnimationFrame.bind(globalThis);
      const cancel = cancelAnimationFrame.bind(globalThis);
      globalThis.fixtureHostCalls = {
        fake: 0,
        computed: 0,
        request: 0,
        cancel: 0,
      };
      document.createElement = (...args) => {
        if (args[0] === 'fakeelement') fixtureHostCalls.fake += 1;
        return createElement(...args);
      };
      globalThis.getComputedStyle = (...args) => {
        fixtureHostCalls.computed += 1;
        return computed(...args);
      };
      globalThis.requestAnimationFrame = (...args) => {
        fixtureHostCalls.request += 1;
        return request(...args);
      };
      globalThis.cancelAnimationFrame = (...args) => {
        fixtureHostCalls.cancel += 1;
        return cancel(...args);
      };
    });
    await page.goto(url);
    const result = await page.evaluate(async () => {
      const detector = fixtureResult.create('fixture-nonce');
      const element = document.createElement('div');
      element.style.cssText = 'width:100px;height:60px;';
      document.body.appendChild(element);
      const sizes = [];
      const listener = function () {
        sizes.push([this.offsetWidth, this.offsetHeight]);
      };
      detector.addResizeListener(element, listener);
      const initialTriggers =
        element.querySelectorAll('.resize-triggers').length;
      const nonce = document
        .getElementById('detectElementResize')
        .getAttribute('nonce');
      await new Promise((resolve) => setTimeout(resolve, 50));
      sizes.length = 0;
      element.style.width = '180px';
      element.style.height = '95px';
      const trigger = element.querySelector('.expand-trigger');
      trigger.dispatchEvent(new Event('scroll', { bubbles: true }));
      trigger.dispatchEvent(new Event('scroll', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const measured = sizes.slice();
      detector.removeResizeListener(element, listener);
      const remainingTriggers =
        element.querySelectorAll('.resize-triggers').length;
      element.style.width = '240px';
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const snapshot = {
        initialTriggers,
        remainingTriggers,
        nonce,
        measured,
        callbacksAfterRemoval: sizes.length - measured.length,
        frozen: Object.isFrozen(Object.prototype),
        capabilities: fixtureResult.fixtureCapabilities(),
        authority: fixtureResult.fixtureDomAuthority(),
        calls: fixtureHostCalls,
      };
      element.remove();
      return snapshot;
    });
    assert.equal(result.initialTriggers, 1);
    assert.equal(result.remainingTriggers, 0);
    assert.equal(result.nonce, 'fixture-nonce');
    assert.deepEqual(result.measured, [[180, 95]]);
    assert.equal(result.callbacksAfterRemoval, 0);
    assert.equal(result.frozen, true);
    assert.deepEqual(result.capabilities, {
      fetchRejected: true,
      fetch: 'undefined',
      XMLHttpRequest: 'undefined',
      WebSocket: 'undefined',
      localStorage: 'undefined',
      cookie: 'undefined',
      defaultView: 'undefined',
      attachEvent: 'undefined',
      prefixedRaf: 'undefined',
      setTimeout: 'undefined',
    });
    assert.deepEqual(result.authority, {
      ownerFetch: 'function',
      ownerCookie: 'string',
      ownerIsCompartmentWindow: false,
    });
    for (const key of ['fake', 'computed', 'request', 'cancel'])
      assert.ok(
        result.calls[key] > 0,
        `the real host ${key} operation must be called`,
      );
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('node-fetch browser adapter preserves reviewed Fetch APIs and bound receiver with a real local HTTP request', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-node-fetch-')),
  );
  const resourceName = '@onekeyhq/core>near-api-js>node-fetch';
  let server;
  let browser;
  try {
    const expected = {
      globals: { fetch: true, Headers: true, Request: true, Response: true },
    };
    for (const target of ['web', 'desktop-renderer']) {
      const policy = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'lavamoat/webpack', target, 'policy.json'),
          'utf8',
        ),
      );
      const overrides = JSON.parse(
        fs.readFileSync(
          path.join(
            repoRoot,
            'lavamoat/webpack',
            target,
            'policy-override.json',
          ),
          'utf8',
        ),
      );
      assert.deepEqual(overrides.resources[resourceName], expected);
      const browserAdapters = new Set();
      for (const entry of Object.values(policy.resources)) {
        for (const name of Object.keys(entry.packages || {})) {
          if (name.endsWith('>node-fetch')) browserAdapters.add(name);
        }
      }
      assert.deepEqual(
        [...browserAdapters],
        [resourceName],
        'new resolved browser adapter instances require explicit review',
      );
    }
    const manifest = require.resolve('node-fetch/package.json');
    const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
    const source = fs.readFileSync(
      path.join(path.dirname(manifest), 'browser.js'),
      'utf8',
    );
    assert.ok(
      source.includes('module.exports = exports = globalObject.fetch;'),
    );
    write(
      directory,
      'node_modules/node-fetch/browser.js',
      `${source}
      module.exports.fixtureIdentity = function () {
        return { fetch: module.exports === globalObject.fetch,
          Headers: module.exports.Headers === globalObject.Headers,
          Request: module.exports.Request === globalObject.Request,
          Response: module.exports.Response === globalObject.Response,
          document: typeof globalObject.document, WebSocket: typeof globalObject.WebSocket };
      };
    `,
    );
    write(
      directory,
      'node_modules/node-fetch/package.json',
      JSON.stringify({ name: 'node-fetch', version, main: 'browser.js' }),
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'node-fetch-policy-fixture',
        private: true,
        dependencies: { 'node-fetch': version },
      }),
    );
    write(
      directory,
      'index.js',
      `const adapter = require('node-fetch'); Object.assign(fixtureResult, { adapter });`,
    );
    await compile(directory, true);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    assert.equal(
      generated.resources['node-fetch'],
      undefined,
      'the shipped global alias is absent from inferred policy',
    );
    await compile(directory, false);
    const missingSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    write(
      directory,
      'policy-override.json',
      JSON.stringify({ resources: { 'node-fetch': expected } }),
    );
    await compile(directory, false);
    const protectedSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    const requests = [];
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/' || pathname === '/missing') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(
          `<!doctype html><html><head><meta charset="utf-8"></head><body><script>globalThis.fixtureResult = {};</script><script src="${pathname === '/missing' ? '/missing.js' : '/main.js'}"></script></body></html>`,
        );
      } else if (pathname === '/main.js' || pathname === '/missing.js') {
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
        });
        response.end(pathname === '/main.js' ? protectedSource : missingSource);
      } else if (pathname === '/echo') {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', () => {
          requests.push({
            method: request.method,
            body,
            header: request.headers['x-fixture'],
          });
          response.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'x-fixture-response': 'response-value',
          });
          response.end(JSON.stringify({ method: request.method, body }));
        });
      } else response.writeHead(204).end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const candidates = [
      chromium.executablePath(),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    const executablePath =
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME ||
      candidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(
      executablePath && fs.existsSync(executablePath),
      'Install Playwright Chromium or set ONEKEY_LAVAMOAT_TEST_CHROME',
    );
    browser = await chromium.launch({ executablePath, headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const broken = await browser.newPage();
    const brokenErrors = [];
    broken.on('pageerror', (error) => brokenErrors.push(error.message));
    await broken.goto(`${origin}/missing`, { waitUntil: 'load' });
    assert.equal(brokenErrors.length, 1);
    assert.match(brokenErrors[0], /Headers|undefined/);
    await broken.close();
    const page = await browser.newPage();
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.addInitScript(() => {
      const nativeFetch = globalThis.fetch;
      globalThis.fixtureReceivers = [];
      globalThis.fetch = function (input, init) {
        'use strict';
        let receiver = 'unexpected';
        if (this === globalThis) receiver = 'window';
        else if (this === undefined) receiver = 'undefined';
        globalThis.fixtureReceivers.push(receiver);
        return nativeFetch.call(this, input, init);
      };
    });
    await page.goto(origin, { waitUntil: 'load' });
    assert.deepEqual(failures, []);
    const result = await page.evaluate(async () => {
      const adapter = globalThis.fixtureResult.adapter;
      const headers = new adapter.Headers({ 'x-fixture': 'request-value' });
      const request = new adapter.Request(`${location.origin}/echo`, {
        method: 'POST',
        headers,
        body: 'reviewed-fetch-body',
      });
      // The adapter explicitly binds default to its compartment global. It must
      // still reach the host receiver after being called with an unrelated this.
      const response = await adapter.default.call({ unrelated: true }, request);
      const body = await response.json();
      const direct = adapter;
      const directResponse = await direct(`${location.origin}/echo`);
      await directResponse.text();
      const constructed = new adapter.Response('constructed', { status: 201 });
      return {
        identity: adapter.fixtureIdentity(),
        body,
        requestInstance:
          request instanceof Request && request instanceof adapter.Request,
        headersInstance:
          headers instanceof Headers && headers instanceof adapter.Headers,
        responseInstance:
          response instanceof Response && response instanceof adapter.Response,
        responsePrototype:
          Object.getPrototypeOf(response) === adapter.Response.prototype,
        responseHeader: response.headers.get('x-fixture-response'),
        constructedBody: await constructed.text(),
        constructedStatus: constructed.status,
        receivers: globalThis.fixtureReceivers,
        originalFetchUntouched:
          !Object.hasOwn(globalThis.fetch, 'Headers') &&
          !Object.hasOwn(globalThis.fetch, 'default'),
        parentFrozen: Object.isFrozen(Object.prototype),
      };
    });
    assert.deepEqual(result.identity, {
      fetch: true,
      Headers: true,
      Request: true,
      Response: true,
      document: 'undefined',
      WebSocket: 'undefined',
    });
    assert.deepEqual(result.body, {
      method: 'POST',
      body: 'reviewed-fetch-body',
    });
    for (const key of [
      'requestInstance',
      'headersInstance',
      'responseInstance',
      'responsePrototype',
      'originalFetchUntouched',
      'parentFrozen',
    ])
      assert.equal(result[key], true, key);
    assert.equal(result.responseHeader, 'response-value');
    assert.equal(result.constructedBody, 'constructed');
    assert.equal(result.constructedStatus, 201);
    assert.deepEqual(result.receivers, ['window', 'undefined']);
    assert.deepEqual(requests, [
      { method: 'POST', body: 'reviewed-fetch-body', header: 'request-value' },
      { method: 'GET', body: '', header: undefined },
    ]);
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('engine.io browser global provider initializes shipped timers and a real WebSocket with only reviewed capabilities', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-engine-io-')),
  );
  const prefix = 'external:../../node_modules/engine.io-client/build/esm/';
  const providerResource = `${prefix}globalThis.browser.js`;
  const expected = {
    globals: {
      clearTimeout: true,
      onpagehide: true,
      setTimeout: true,
      WebSocket: true,
    },
  };
  let browser;
  let server;
  let sockets;
  try {
    for (const target of ['web', 'desktop-renderer']) {
      const policyDirectory = path.join(repoRoot, 'lavamoat/webpack', target);
      const override = JSON.parse(
        fs.readFileSync(
          path.join(policyDirectory, 'policy-override.json'),
          'utf8',
        ),
      );
      assert.deepEqual(override.resources[providerResource], expected);
      const policy = JSON.parse(
        fs.readFileSync(path.join(policyDirectory, 'policy.json'), 'utf8'),
      );
      assert.deepEqual(
        Object.entries(policy.resources)
          .filter(([, entry]) => entry.packages?.[providerResource])
          .map(([name]) => name)
          .toSorted(),
        [
          'transports/polling.js',
          'transports/websocket-constructor.browser.js',
          'transports/xmlhttprequest.browser.js',
          'util.js',
        ].map((file) => `${prefix}${file}`),
        'new consumers of the shared timer/network provider require review',
      );
    }
    const engineDirectory = path.join(
      path.dirname(require.resolve('engine.io-client/package.json')),
      'build/esm',
    );
    const sourcePath = (file) =>
      JSON.stringify(path.join(engineDirectory, file));
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'engine-io-policy-fixture',
        private: true,
      }),
    );
    // Import the shipped ESM files without copying or rewriting their aliases.
    write(
      directory,
      'index.js',
      `
      import { installTimerFunctions } from ${sourcePath('util.js')};
      import { globalThisShim } from ${sourcePath('globalThis.browser.js')};
      import { WebSocket, defaultBinaryType } from ${sourcePath('transports/websocket-constructor.browser.js')};
      const timers = [false, true].map((useNativeTimers) => {
        const target = {};
        installTimerFunctions(target, { useNativeTimers });
        return { target, useNativeTimers };
      });
      fixtureResult.capabilities = {
        pagehide: 'onpagehide' in globalThisShim,
        fetch: typeof globalThisShim.fetch,
        xhr: typeof globalThisShim.XMLHttpRequest,
        storage: typeof globalThisShim.localStorage,
        document: typeof globalThisShim.document,
        legacySocket: typeof globalThisShim.MozWebSocket,
        legacyXHR: typeof globalThisShim.ActiveXObject,
      };
      fixtureResult.run = async (url) => {
        const observations = [];
        for (const { target, useNativeTimers } of timers) {
          let cancelledFired = false;
          const cancelled = target.setTimeoutFn(() => { cancelledFired = true; }, 0);
          target.clearTimeoutFn(cancelled);
          await new Promise((resolve) => target.setTimeoutFn(resolve, 20));
          observations.push({ useNativeTimers, cancelledFired });
        }
        const socket = new WebSocket(url);
        socket.binaryType = defaultBinaryType;
        let timeout;
        try {
          const message = await new Promise((resolve, reject) => {
            let received;
            timeout = timers[0].target.setTimeoutFn(() => reject(new Error('WebSocket timed out')), 5000);
            socket.onerror = () => reject(new Error('WebSocket failed'));
            socket.onopen = () => socket.send('reviewed-engine-io-message');
            socket.onmessage = ({ data }) => { received = data; socket.close(); };
            socket.onclose = () => resolve(received);
          });
          return { observations, message, closed: socket.readyState === WebSocket.CLOSED };
        } finally {
          timers[0].target.clearTimeoutFn(timeout);
          socket.close();
        }
      };
    `,
    );
    await compile(directory, true);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    const utilResource = Object.keys(generated.resources).find((name) =>
      name.endsWith('/engine.io-client/build/esm/util.js'),
    );
    assert.ok(utilResource);
    const fixtureProvider = Object.keys(
      generated.resources[utilResource].packages,
    ).find((name) =>
      name.endsWith('/engine.io-client/build/esm/globalThis.browser.js'),
    );
    assert.ok(fixtureProvider);
    assert.equal(
      generated.resources[fixtureProvider],
      undefined,
      'static analysis does not follow imported compartment-global aliases',
    );
    await compile(directory, false);
    const broken = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
    });
    try {
      broken.window.fixtureResult = {};
      assert.throws(
        () =>
          vm.runInContext(
            fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8'),
            broken.getInternalVMContext(),
          ),
        /bind/,
      );
    } finally {
      broken.window.close();
    }
    write(
      directory,
      'policy-override.json',
      JSON.stringify({
        resources: { [fixtureProvider]: expected },
      }),
    );
    await compile(directory, false);
    const main = fs.readFileSync(path.join(directory, 'dist/main.js'), 'utf8');
    server = http.createServer((request, response) => {
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(
          '<!doctype html><html><head><meta charset="utf-8"></head><body><script>globalThis.fixtureResult = {};</script><script src="/main.js"></script></body></html>',
        );
      } else if (request.url === '/main.js') {
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
        });
        response.end(main);
      } else {
        response.writeHead(404).end();
      }
    });
    const { WebSocketServer } = createRequire(
      require.resolve('jsdom/package.json'),
    )('ws');
    sockets = new WebSocketServer({ server, path: '/echo' });
    let handshakes = 0;
    sockets.on('connection', (socket) => {
      handshakes += 1;
      socket.on('message', (message) => socket.send(message.toString()));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
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
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {
      waitUntil: 'load',
    });
    assert.deepEqual(failures, []);
    assert.deepEqual(
      await page.evaluate(() => globalThis.fixtureResult.capabilities),
      {
        pagehide: true,
        fetch: 'undefined',
        xhr: 'undefined',
        storage: 'undefined',
        document: 'undefined',
        legacySocket: 'undefined',
        legacyXHR: 'undefined',
      },
    );
    const result = await page.evaluate(
      (url) => globalThis.fixtureResult.run(url),
      `ws://127.0.0.1:${server.address().port}/echo`,
    );
    assert.deepEqual(result, {
      observations: [
        { useNativeTimers: false, cancelledFired: false },
        { useNativeTimers: true, cancelledFired: false },
      ],
      message: 'reviewed-engine-io-message',
      closed: true,
    });
    assert.equal(handshakes, 1);
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    if (sockets) {
      for (const socket of sockets.clients) socket.terminate();
      await new Promise((resolve) => sockets.close(resolve));
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Web PostHog initializes its shipped SDK with existing privacy configuration and real native history, persistence, and local delivery', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-posthog-')),
  );
  const resourceName = '@onekeyhq/shared>posthog-js';
  const expected = {
    globals: Object.fromEntries(
      [
        'AbortController',
        'addEventListener',
        'devicePixelRatio',
        'fetch',
        'getComputedStyle',
        'history',
        'innerHeight',
        'innerWidth',
        'location.host',
        'location.hostname',
        'location.href',
        'location.pathname',
        'location.protocol',
        'location.search',
        'onpagehide',
        'removeEventListener',
        'screen.height',
        'screen.width',
        'scrollX',
        'scrollY',
        'sessionStorage.getItem',
        'sessionStorage.removeItem',
        'sessionStorage.setItem',
      ].map((name) => [name, true]),
    ),
  };
  let browser;
  let server;
  try {
    const readPolicy = (target, name) =>
      JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'lavamoat/webpack', target, `${name}.json`),
          'utf8',
        ),
      );
    const production = readPolicy('web', 'policy').resources[resourceName];
    assert.ok(production);
    assert.deepEqual(
      readPolicy('web', 'policy-override').resources[resourceName],
      expected,
    );
    for (const name of ['policy', 'policy-override']) {
      assert.equal(
        readPolicy('desktop-renderer', name).resources[resourceName],
        undefined,
        'Desktop resolves the app no-op adapter and must not gain unused analytics authority',
      );
    }
    const appSource = fs.readFileSync(
      path.join(
        repoRoot,
        'packages/shared/src/modules3rdParty/posthog/index.ts',
      ),
      'utf8',
    );
    const parsed = require('@babel/parser').parse(appSource, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    let configNode;
    require('@babel/traverse').default(parsed, {
      CallExpression(nodePath) {
        const { callee } = nodePath.node;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'posthog' &&
          callee.property.name === 'init'
        ) {
          assert.equal(configNode, undefined);
          [, configNode] = nodePath.node.arguments;
        }
      },
    });
    assert.equal(configNode.type, 'ObjectExpression');
    // Read the actual app options, never its production API key. Only the endpoint
    // is replaced; masking, capture selection, persistence, and feature flags stay identical.
    const config = vm.runInNewContext(
      `(${appSource.slice(configNode.start, configNode.end)})`,
    );
    assert.deepEqual(JSON.parse(JSON.stringify(config)), {
      api_host: 'https://onekey.so/ph',
      capture_pageview: 'history_change',
      autocapture: {
        css_selector_allowlist: ['a', 'button', '[role="button"]'],
        capture_copied_text: false,
      },
      cross_subdomain_cookie: true,
      persistence: 'localStorage+cookie',
      mask_all_text: true,
      mask_all_element_attributes: true,
      disable_session_recording: true,
      advanced_disable_flags: true,
      disable_surveys: true,
    });
    const packageDirectory = path.dirname(
      require.resolve('posthog-js/package.json'),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
    );
    assert.equal(manifest.version, '1.379.1');
    const source = fs.readFileSync(
      path.join(packageDirectory, manifest.module),
      'utf8',
    );
    write(
      directory,
      'node_modules/posthog-js/index.mjs',
      `${source}\nexport const fixtureCapabilities = () => ({
      xhr: typeof XMLHttpRequest, socket: typeof WebSocket, worker: typeof Worker,
      recorder: typeof MutationObserver, locationAssign: typeof location.assign,
      screenAvailWidth: typeof screen.availWidth, storageClear: typeof sessionStorage.clear,
      nativeHistory: history, pagehide: 'onpagehide' in globalThis });
      export const fixtureSetHash = () => { location.href = location.href.split('#')[0] + '#reviewed-location-setter'; };`,
    );
    write(
      directory,
      'node_modules/posthog-js/package.json',
      JSON.stringify({
        name: 'posthog-js',
        version: manifest.version,
        module: 'index.mjs',
      }),
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'posthog-policy-fixture',
        private: true,
        dependencies: { 'posthog-js': manifest.version },
      }),
    );
    write(
      directory,
      'index.js',
      `import posthog, { fixtureCapabilities, fixtureSetHash } from 'posthog-js';
      fixtureResult.setHash = fixtureSetHash;
      fixtureResult.initialize = (endpoint) => {
        const config = ${JSON.stringify(config)};
        config.api_host = endpoint;
        posthog.init('phc_local_lavamoat_fixture', config);
        fixtureResult.sdk = posthog;
        fixtureResult.capabilities = fixtureCapabilities();
      };`,
    );
    await compile(directory, true);
    const generated = JSON.parse(
      fs.readFileSync(path.join(directory, 'policy.json'), 'utf8'),
    );
    // Test-only probes must not expand the production dependency's authority.
    generated.resources['posthog-js'] = production;
    write(directory, 'policy.json', JSON.stringify(generated));
    await compile(directory, false);
    const missingSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    write(
      directory,
      'policy-override.json',
      JSON.stringify({ resources: { 'posthog-js': expected } }),
    );
    await compile(directory, false);
    const protectedSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    const requests = [];
    const events = [];
    server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/main.js' || url.pathname === '/missing.js') {
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
        });
        response.end(
          url.pathname === '/main.js' ? protectedSource : missingSource,
        );
      } else if (url.pathname.startsWith('/telemetry/')) {
        const parts = [];
        request.on('data', (chunk) => parts.push(chunk));
        request.on('end', () => {
          const body = Buffer.concat(parts);
          requests.push({
            path: url.pathname,
            method: request.method,
            bytes: body.length,
          });
          if (body.length) {
            let decoded = body;
            if (body[0] === 0x1f && body[1] === 0x8b)
              decoded = require('node:zlib').gunzipSync(body);
            else if (body.toString().startsWith('data='))
              decoded = Buffer.from(
                new URLSearchParams(body.toString()).get('data'),
                'base64',
              );
            const payload = JSON.parse(decoded.toString());
            events.push(...(Array.isArray(payload) ? payload : [payload]));
          }
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{"status":1}');
        });
      } else {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html><html><head><meta charset="utf-8"><title>Local analytics fixture</title></head><body>
          <button id="reviewed-button" data-private="synthetic-private-attribute">synthetic-private-text</button>
          <div id="ignored">synthetic-ignored-text</div><script>globalThis.fixtureResult = {};</script>
          <script src="${url.pathname === '/missing' ? '/missing.js' : '/main.js'}"></script></body></html>`);
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
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
      'Install Playwright Chromium or set ONEKEY_LAVAMOAT_TEST_CHROME',
    );
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    const errors = [];
    const unexpected = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('**/*', (route) => {
      if (route.request().url().startsWith(`${origin}/`))
        return route.continue();
      unexpected.push(route.request().url());
      return route.abort();
    });
    await page.addInitScript(() => {
      globalThis.fixtureHost = {
        push: history.pushState,
        replace: history.replaceState,
        added: [],
        removed: [],
        fetches: [],
      };
      const add = globalThis.addEventListener;
      const remove = globalThis.removeEventListener;
      const originalFetch = globalThis.fetch;
      globalThis.addEventListener = function (type, listener, options) {
        fixtureHost.added.push(type);
        return Reflect.apply(add, this, [type, listener, options]);
      };
      globalThis.removeEventListener = function (type, listener, options) {
        fixtureHost.removed.push(type);
        return Reflect.apply(remove, this, [type, listener, options]);
      };
      globalThis.fetch = function (input, options) {
        fixtureHost.fetches.push(String(input));
        return Reflect.apply(originalFetch, this, [input, options]);
      };
      // This is a synthetic browser test of capture, not a bot-detection test.
      Object.defineProperty(navigator, 'webdriver', {
        configurable: true,
        get: () => false,
      });
      const userAgent = navigator.userAgent.replace('HeadlessChrome', 'Chrome');
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () => userAgent,
      });
      if (navigator.userAgentData) {
        const brands = navigator.userAgentData.brands.map(
          ({ brand, version }) => ({
            brand: brand.replace('HeadlessChrome', 'Chrome'),
            version,
          }),
        );
        Object.defineProperty(navigator.userAgentData, 'brands', {
          configurable: true,
          get: () => brands,
        });
      }
    });
    await page.goto(`${origin}/missing`);
    await assert.rejects(
      page.evaluate(
        (endpoint) => fixtureResult.initialize(endpoint),
        `${origin}/telemetry`,
      ),
      /addEventListener/,
    );
    errors.length = 0;
    await page.goto(origin);
    await page.evaluate(
      (endpoint) => fixtureResult.initialize(endpoint),
      `${origin}/telemetry`,
    );
    const initial = await page.evaluate(() => ({
      loaded: fixtureResult.sdk.__loaded,
      config: fixtureResult.sdk.config,
      capabilities: {
        ...fixtureResult.capabilities,
        nativeHistory: fixtureResult.capabilities.nativeHistory === history,
      },
      pushPatched: history.pushState !== fixtureHost.push,
      replacePatched: history.replaceState !== fixtureHost.replace,
      listeners: fixtureHost.added,
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      cookie: document.cookie,
      recording: fixtureResult.sdk.sessionRecordingStarted(),
    }));
    assert.equal(initial.loaded, true);
    assert.equal(initial.pushPatched, true);
    assert.equal(initial.replacePatched, true);
    assert.equal(initial.recording, false);
    assert.deepEqual(initial.capabilities, {
      xhr: 'undefined',
      socket: 'undefined',
      worker: 'undefined',
      recorder: 'undefined',
      locationAssign: 'undefined',
      screenAvailWidth: 'undefined',
      storageClear: 'undefined',
      nativeHistory: true,
      pagehide: true,
    });
    for (const [key, value] of Object.entries(config))
      if (key !== 'api_host')
        assert.deepEqual(
          JSON.parse(JSON.stringify(initial.config[key])),
          JSON.parse(JSON.stringify(value)),
        );
    for (const type of [
      'pagehide',
      'beforeunload',
      'popstate',
      'online',
      'offline',
    ])
      assert.ok(initial.listeners.includes(type), type);
    assert.ok(
      initial.local.some((key) => key.includes('phc_local_lavamoat_fixture')),
    );
    assert.ok(
      initial.session.some((key) => key.includes('phc_local_lavamoat_fixture')),
    );
    assert.ok(
      initial.cookie.includes('ph_phc_local_lavamoat_fixture_posthog='),
    );
    const navigation = await page.evaluate(async () => {
      const pushReturn = history.pushState(
        { fixture: 'push' },
        '',
        '/first?fixture=1',
      );
      const pushed = {
        pathname: location.pathname,
        state: history.state.fixture,
        pushReturn: typeof pushReturn,
      };
      const replaceReturn = history.replaceState(
        { fixture: 'replace' },
        '',
        '/second?fixture=2',
      );
      const replaced = {
        pathname: location.pathname,
        state: history.state.fixture,
        replaceReturn: typeof replaceReturn,
      };
      history.pushState({ fixture: 'third' }, '', '/third');
      const popstate = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);
        addEventListener(
          'popstate',
          (event) => {
            clearTimeout(timeout);
            resolve({
              trusted: event.isTrusted,
              state: event.state.fixture,
              pathname: location.pathname,
            });
          },
          { once: true },
        );
      });
      history.back();
      return { pushed, replaced, back: await popstate };
    });
    assert.deepEqual(navigation, {
      pushed: { pathname: '/first', state: 'push', pushReturn: 'undefined' },
      replaced: {
        pathname: '/second',
        state: 'replace',
        replaceReturn: 'undefined',
      },
      back: { trusted: true, state: 'replace', pathname: '/second' },
    });
    await page.locator('#reviewed-button').click();
    await page.locator('#ignored').click();
    await page.evaluate(() =>
      fixtureResult.sdk.capture(
        'local-fixture-marker',
        { synthetic: true },
        { send_instantly: true },
      ),
    );
    // Keep the SDK's real batching interval and payload encoding unchanged.
    const deadline = Date.now() + 12_000;
    while (
      Date.now() < deadline &&
      (!events.some((event) => event.event === '$autocapture') ||
        !events.some(
          (event) => event.properties?.navigation_type === 'popstate',
        ))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(events.some((event) => event.event === 'local-fixture-marker'));
    for (const type of ['pushState', 'replaceState', 'popstate'])
      assert.ok(
        events.some(
          (event) =>
            event.event === '$pageview' &&
            event.properties.navigation_type === type,
        ),
        type,
      );
    const clicks = events.filter((event) => event.event === '$autocapture');
    assert.equal(
      clicks.length,
      1,
      'only selector-allowed button clicks are captured',
    );
    const captured = JSON.stringify(events);
    assert.equal(captured.includes('synthetic-private-text'), false);
    assert.equal(captured.includes('synthetic-private-attribute'), false);
    assert.equal(captured.includes('synthetic-ignored-text'), false);
    assert.equal(
      events.some((event) => event.event === '$snapshot'),
      false,
    );
    const cleanup = await page.evaluate(() => {
      fixtureResult.sdk.historyAutocapture.stop();
      // Upstream stop removes popstate but intentionally retains history wrappers.
      // Restore the original host methods in this isolated fixture, and prove the
      // raw-object grant can mutate the real host rather than a detached copy.
      const retained = history.pushState !== fixtureHost.push;
      const host = fixtureResult.capabilities.nativeHistory;
      host.pushState = fixtureHost.push;
      host.replaceState = fixtureHost.replace;
      history.pushState({ restored: true }, '', '/restored');
      return {
        removed: fixtureHost.removed.includes('popstate'),
        retained,
        restored:
          history.pushState === fixtureHost.push &&
          history.replaceState === fixtureHost.replace,
        state: history.state.restored,
        pathname: location.pathname,
        fetches: fixtureHost.fetches,
      };
    });
    assert.equal(cleanup.removed, true);
    assert.equal(cleanup.retained, true);
    assert.equal(cleanup.restored, true);
    assert.equal(cleanup.state, true);
    assert.equal(cleanup.pathname, '/restored');
    assert.ok(
      cleanup.fetches.some((url) => url.startsWith(`${origin}/telemetry/e/`)),
    );
    assert.equal(
      await page.evaluate(() => {
        fixtureResult.setHash();
        return location.hash;
      }),
      '#reviewed-location-setter',
      'deep Location grants preserve native setters and navigation authority',
    );
    const firstPageview = events.find((event) => event.event === '$pageview');
    assert.equal(firstPageview.properties.title, 'Local analytics fixture');
    assert.equal(firstPageview.properties.$referrer, '$direct');
    assert.equal(firstPageview.properties.$current_url, `${origin}/`);
    assert.ok(firstPageview.properties.$screen_width > 0);
    assert.ok(firstPageview.properties.$viewport_height > 0);
    assert.ok(requests.length > 0);
    assert.equal(
      requests.some((request) =>
        /flags|survey|record|replay/.test(request.path),
      ),
      false,
    );
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the protected static shim preserves native fetch and animation frames across writable and read-only policy owners', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-writable-host-')),
  );
  let server;
  let browser;
  try {
    const dependencies = Object.fromEntries(
      ['host-writer', 'host-reader', 'host-denied'].map((name) => [
        name,
        '1.0.0',
      ]),
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'writable-browser-host-fixture',
        private: true,
        dependencies,
      }),
    );
    for (const name of Object.keys(dependencies)) {
      write(
        directory,
        `node_modules/${name}/package.json`,
        JSON.stringify({
          name,
          version: '1.0.0',
          main: 'index.js',
        }),
      );
    }
    write(
      directory,
      'node_modules/host-writer/index.js',
      `
      const initialFetch = fetch;
      const initialFrame = requestAnimationFrame;
      let generation = 0;
      let fetchReceiver;
      let frameReceiver;
      const calls = [];
      module.exports = {
        replace() {
          generation += 1;
          const current = generation;
          globalThis.fetch = function (...args) {
            fetchReceiver = this;
            calls.push('fetch-' + current);
            return Reflect.apply(initialFetch, this, args);
          };
          globalThis.requestAnimationFrame = function (...args) {
            frameReceiver = this;
            calls.push('frame-' + current);
            return Reflect.apply(initialFrame, this, args);
          };
        },
        request(url, receiver = globalThis) {
          return Reflect.apply(globalThis.fetch, receiver, [url]);
        },
        frame(receiver = globalThis) {
          return new Promise(resolve => Reflect.apply(globalThis.requestAnimationFrame, receiver, [resolve]));
        },
        matches(receiver) {
          return { fetch: fetchReceiver === receiver, frame: frameReceiver === receiver };
        },
        receiverAuthority() {
          return { directSecret: typeof fixtureSecret,
            receiverHasSecret: fetchReceiver?.fixtureSecret === 'host-only-marker',
            receiverDocument: typeof fetchReceiver?.document,
            receiverNetwork: typeof fetchReceiver?.XMLHttpRequest };
        },
        calls() { return calls.slice(); },
      };
    `,
    );
    write(
      directory,
      'node_modules/host-reader/index.js',
      `
      module.exports = {
        request(url, receiver = globalThis) {
          return Reflect.apply(fetch, receiver, [url]);
        },
        frame(receiver = globalThis) {
          return new Promise(resolve => Reflect.apply(requestAnimationFrame, receiver, [resolve]));
        },
        cannotReplace() {
          return [Reflect.set(globalThis, 'fetch', () => 'forbidden'),
            Reflect.set(globalThis, 'requestAnimationFrame', () => 'forbidden')];
        },
      };
    `,
    );
    write(
      directory,
      'node_modules/host-denied/index.js',
      `
      module.exports = () => {
        const result = { fetch: typeof fetch, frame: typeof requestAnimationFrame,
          secret: typeof fixtureHost };
        try { fetch('/forbidden-network'); } catch { result.fetchDenied = true; }
        try { requestAnimationFrame(() => {}); } catch { result.frameDenied = true; }
        // A local shadow in an otherwise empty compartment must not modify the
        // shared writable value or grant access to the native implementation.
        globalThis.fetch = () => 'local-only';
        globalThis.requestAnimationFrame = () => 'local-only';
        result.localFetch = globalThis.fetch();
        result.localFrame = globalThis.requestAnimationFrame();
        return result;
      };
    `,
    );
    write(
      directory,
      'index.js',
      `
      const writer = require('host-writer');
      const reader = require('host-reader');
      Object.assign(fixtureResult, {
        writer, reader, denied: require('host-denied'),
        readerReceiverIsRoot: () => writer.matches(globalThis),
      });
      writer.replace();
    `,
    );
    const policy = {
      resources: {
        'host-writer': {
          globals: { fetch: 'write', requestAnimationFrame: 'write' },
        },
        'host-reader': {
          globals: { fetch: true, requestAnimationFrame: true },
        },
        'host-denied': {},
      },
    };
    write(directory, 'policy.json', JSON.stringify(policy));
    await compile(directory, false);
    const missingSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    const {
      getLavaMoatStaticShimPath,
    } = require('../webpack/build-lavamoat-shims');
    await compile(
      directory,
      false,
      {},
      {
        staticShims_experimental: [getLavaMoatStaticShimPath()],
      },
    );
    const protectedSource = fs.readFileSync(
      path.join(directory, 'dist/main.js'),
      'utf8',
    );
    for (const owner of Object.keys(dependencies)) {
      assert.ok(protectedSource.includes(`._LM_(${JSON.stringify(owner)}`));
    }
    const requests = [];
    server = http.createServer((request, response) => {
      if (request.url === '/main.js' || request.url === '/missing.js') {
        response.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
        });
        response.end(
          request.url === '/main.js' ? protectedSource : missingSource,
        );
      } else if (request.url.startsWith('/health/')) {
        requests.push(request.url);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, path: request.url }));
      } else {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html><html><head><meta charset="utf-8"><title>Writable host fixture</title></head><body>
          <script>globalThis.fixtureResult = {};</script>
          <script src="${request.url === '/missing' ? '/missing.js' : '/main.js'}"></script></body></html>`);
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const executablePath = [
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
      chromium.executablePath(),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
      .filter(Boolean)
      .find((candidate) => fs.existsSync(candidate));
    assert.ok(
      executablePath,
      'Install Chromium or set ONEKEY_LAVAMOAT_TEST_CHROME',
    );
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('**/*', (route) => {
      assert.ok(route.request().url().startsWith(`${origin}/`));
      return route.continue();
    });
    await page.addInitScript(() => {
      globalThis.fixtureSecret = 'host-only-marker';
      globalThis.fixtureHost = Object.fromEntries(
        ['fetch', 'requestAnimationFrame'].map((name) => [
          name,
          Object.getOwnPropertyDescriptor(globalThis, name),
        ]),
      );
    });
    await page.goto(`${origin}/missing`);
    assert.deepEqual(errors, []);
    await assert.rejects(
      page.evaluate(() => fixtureResult.writer.request('/health/missing')),
      /Illegal invocation/,
    );
    await assert.rejects(
      page.evaluate(() => fixtureResult.writer.frame()),
      /Illegal invocation/,
    );
    assert.deepEqual(
      requests,
      [],
      'the original writer failure occurs before network delivery',
    );
    await page.goto(origin);
    const result = await page.evaluate(async () => {
      const { writer, reader } = fixtureResult;
      const descriptorPreserved = ['fetch', 'requestAnimationFrame'].map(
        (name) => {
          const before = fixtureHost[name];
          const after = Object.getOwnPropertyDescriptor(globalThis, name);
          return (
            before.value !== after.value &&
            before.writable === after.writable &&
            before.enumerable === after.enumerable &&
            before.configurable === after.configurable
          );
        },
      );
      const first = await writer.request('/health/writer');
      const firstFrame = await writer.frame();
      const explicitReceiver = { marker: 'explicit-caller' };
      const explicit = await writer.request(
        '/health/writer-explicit',
        explicitReceiver,
      );
      const explicitFrame = await writer.frame(explicitReceiver);
      const writerReceiver = writer.matches(explicitReceiver);
      const read = await reader.request('/health/reader', explicitReceiver);
      const readFrame = await reader.frame(explicitReceiver);
      const readReceiver = fixtureResult.readerReceiverIsRoot();
      const readerCallbackAuthority = writer.receiverAuthority();
      const readerExplicitReceiver = writer.matches(explicitReceiver);
      const cannotReplace = reader.cannotReplace();
      const denied = fixtureResult.denied();
      writer.replace();
      const replaced = await reader.request('/health/replacement');
      const replacedFrame = await reader.frame();
      const defaultReaderCallbackAuthority = writer.receiverAuthority();
      const defaultReaderReceiverIsRoot = fixtureResult.readerReceiverIsRoot();
      // Initial native functions are intentionally fixed to the real host,
      // including calls that supply an explicit non-Window receiver.
      const native = await globalThis.fetch.call(
        explicitReceiver,
        '/health/native-explicit',
      );
      const nativeFrame = await new Promise((resolve) =>
        globalThis.requestAnimationFrame.call(explicitReceiver, resolve),
      );
      return {
        descriptorPreserved,
        statuses: [
          first.status,
          explicit.status,
          read.status,
          replaced.status,
          native.status,
        ],
        frames: [
          firstFrame,
          explicitFrame,
          readFrame,
          replacedFrame,
          nativeFrame,
        ].map(Number.isFinite),
        body: await replaced.json(),
        writerReceiver,
        readReceiver,
        readerCallbackAuthority,
        defaultReaderCallbackAuthority,
        defaultReaderReceiverIsRoot,
        readerExplicitReceiver,
        cannotReplace,
        denied,
        calls: writer.calls(),
        frozen: [Object.prototype, Array.prototype, Function.prototype].map(
          Object.isFrozen,
        ),
      };
    });
    assert.deepEqual(result, {
      descriptorPreserved: [true, true],
      statuses: [200, 200, 200, 200, 200],
      frames: [true, true, true, true, true],
      body: { ok: true, path: '/health/replacement' },
      writerReceiver: { fetch: true, frame: true },
      readReceiver: { fetch: false, frame: false },
      readerCallbackAuthority: {
        directSecret: 'undefined',
        receiverHasSecret: false,
        receiverDocument: 'undefined',
        receiverNetwork: 'undefined',
      },
      defaultReaderCallbackAuthority: {
        directSecret: 'undefined',
        receiverHasSecret: false,
        receiverDocument: 'undefined',
        receiverNetwork: 'undefined',
      },
      defaultReaderReceiverIsRoot: { fetch: false, frame: false },
      // The core patch must not give an attacker-controlled replacement the
      // root compartment through a read-only caller's implicit receiver.
      readerExplicitReceiver: { fetch: true, frame: true },
      cannotReplace: [false, false],
      denied: {
        fetch: 'undefined',
        frame: 'undefined',
        secret: 'undefined',
        fetchDenied: true,
        frameDenied: true,
        localFetch: 'local-only',
        localFrame: 'local-only',
      },
      calls: [
        'fetch-1',
        'frame-1',
        'fetch-1',
        'frame-1',
        'fetch-1',
        'frame-1',
        'fetch-2',
        'frame-2',
      ],
      frozen: [true, true, true],
    });
    assert.deepEqual(requests, [
      '/health/writer',
      '/health/writer-explicit',
      '/health/reader',
      '/health/replacement',
      '/health/native-explicit',
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
