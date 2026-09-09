// cspell:ignore LavaMoat lavamoat
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { JSDOM } = require('jsdom');

const {
  checkerEnvironment,
  startBrowser,
  interceptTargets,
  installRejectionObserver,
  fileHashes,
  pageReadiness,
  validateProtection,
} = require('./smoke-lavamoat.cjs');

function fixture() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-ext-preflight-'),
  );
  const ses = fs.readFileSync(
    createRequire(require.resolve('@lavamoat/webpack')).resolve('ses'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(directory, 'manifest.json'),
    JSON.stringify({
      name: 'OneKey: Secure Crypto Wallet',
      version: '1.0.0',
      key: 'AA==',
      manifest_version: 3,
      background: { service_worker: 'background.bundle.js' },
      content_security_policy: {
        extension_pages:
          "script-src 'self' 'wasm-unsafe-eval' ; object-src 'self';",
      },
    }),
  );
  const runtime = 'lavamoat-runtime.abcdef.bundle.js';
  for (const file of [
    runtime,
    'background.bundle.js',
    'content-script.bundle.js',
  ])
    fs.writeFileSync(
      path.join(directory, file),
      `${ses};fixture._LM_=()=>{};fixture._LM_();`,
    );
  fs.writeFileSync(path.join(directory, 'entry.js'), 'fixture._LM_();');
  for (const [file, source] of [
    ['injected.js', 'src/entry/injected.js'],
    ['preload-html-head.js', 'src/assets/preload-html-head.js'],
    ['ui-popup-boot.js', 'src/assets/ui-popup-boot.js'],
  ])
    fs.copyFileSync(
      path.join(__dirname, '..', source),
      path.join(directory, file),
    );
  const scripts = [runtime, 'entry.js']
    .map(
      (file) =>
        `<script src="/${file}" crossorigin="anonymous" integrity="sha384-${createHash(
          'sha384',
        )
          .update(fs.readFileSync(path.join(directory, file)))
          .digest('base64')}"></script>`,
    )
    .join('');
  for (const file of [
    'ui-popup.html',
    'ui-expand-tab.html',
    'ui-passkey.html',
    'offscreen.html',
  ])
    fs.writeFileSync(
      path.join(directory, file),
      `<!doctype html><html><head><script src="/preload-html-head.js"></script>${scripts}</head><body></body></html>`,
    );
  return directory;
}

test('formal smoke rejects relaxed, invalid and nonfinite budget overrides', () => {
  assert.equal(
    checkerEnvironment({ EXT_BUILD_MAX_JS_FILES: '900' })
      .EXT_BUILD_MAX_JS_FILES,
    '900',
  );
  for (const value of ['1001', 'NaN', 'Infinity', '-1', '0'])
    assert.throws(
      () => checkerEnvironment({ EXT_BUILD_MAX_JS_FILES: value }),
      /must not relax/,
    );
});

test('artifact preflight verifies final bytes, all compiler runtimes, real script elements and trusted copies', () => {
  const directory = fixture();
  try {
    assert.equal(validateProtection(directory).manifestVersion, '1.0.0');
    const htmlPath = path.join(directory, 'ui-popup.html');
    const original = fs.readFileSync(htmlPath, 'utf8');
    fs.writeFileSync(
      htmlPath,
      original.replace(
        '<script src="/preload-html-head.js"',
        '<script src="https://example.invalid/preload-html-head.js"',
      ),
    );
    assert.throws(
      () => validateProtection(directory),
      /Every executable HTML script must be local/,
    );
    fs.writeFileSync(
      htmlPath,
      original.replace(
        /(<script src="\/lavamoat-runtime[\s\S]+<\/script>)/,
        '<template>$1</template>',
      ),
    );
    assert.throws(
      () => validateProtection(directory),
      /Missing protected entry/,
    );
    fs.writeFileSync(htmlPath, original);
    fs.appendFileSync(path.join(directory, 'entry.js'), 'void 0;');
    assert.throws(
      () => validateProtection(directory),
      /Expected values to be strictly equal/,
    );
    fs.writeFileSync(path.join(directory, 'entry.js'), 'fixture._LM_();');
    const contentFile = path.join(directory, 'content-script.bundle.js');
    fs.writeFileSync(
      contentFile,
      fs.readFileSync(contentFile, 'utf8').replace('fixture._LM_();', ''),
    );
    assert.throws(
      () => validateProtection(directory),
      /Missing protected entry modules/,
    );
    fs.rmSync(contentFile);
    assert.throws(
      () => validateProtection(directory),
      /Missing finalized compiler runtime/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('artifact hashing rejects symlinks instead of accepting an external payload', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-links-'));
  try {
    fs.symlinkSync(__filename, path.join(directory, 'linked.js'));
    assert.throws(() => fileHashes(directory), /only regular files/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('readiness rejects empty, loading and error UI; passkey requires its committed idle component', () => {
  const dom = new JSDOM('<div id="root"></div>', {
    runScripts: 'outside-only',
  });
  try {
    const read = dom.window.eval(`(${pageReadiness.toString()})`);
    assert.equal(read(false), null);
    assert.equal(read(true), null);
    const root = dom.window.document.getElementById('root');
    root.innerHTML =
      '<div data-testid="GlobalJotaiReady-not-ready-placeholder"></div>';
    root.__reactContainer$fixture = {
      stateNode: { current: { type: { name: 'PassKeyContainer' } } },
    };
    assert.equal(read(true), null);
    root.innerHTML = '<div>Something went wrong</div>';
    root.__reactContainer$fixture.stateNode.current.type.name = 'ErrorBoundary';
    assert.equal(read(false), null);
    assert.equal(read(true), null);
    root.__reactContainer$fixture.stateNode.current.type.name =
      'PassKeyContainer';
    root.innerHTML = '';
    assert.equal(read(true), 'passkey-idle-bootstrap');
  } finally {
    dom.window.close();
  }
});

test(
  'own CDP pipe intercepts real MV3 worker, offscreen and page rejections before SES can defer reporting',
  { timeout: 30_000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-ext-early-errors-'),
    );
    let browser;
    try {
      const extension = path.join(directory, 'extension');
      fs.mkdirSync(extension);
      const { key } = require('../src/manifest/shared');
      const id = createHash('sha256')
        .update(Buffer.from(key, 'base64'))
        .digest('hex')
        .slice(0, 32)
        .split('')
        .map((value) => String.fromCharCode(97 + Number.parseInt(value, 16)))
        .join('');
      const origin = `chrome-extension://${id}`;
      fs.writeFileSync(
        path.join(extension, 'manifest.json'),
        JSON.stringify({
          manifest_version: 3,
          key,
          name: 'Native rejection observation fixture',
          version: '1.0.0',
          permissions: ['offscreen'],
          background: { service_worker: 'background.js' },
          content_security_policy: {
            extension_pages:
              "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
          },
        }),
      );
      const ses = fs.readFileSync(
        createRequire(require.resolve('@lavamoat/webpack')).resolve('ses'),
        'utf8',
      );
      for (const label of ['background', 'offscreen', 'popup']) {
        // Keep rejected promises alive: SES's finalization-based reporter cannot
        // be relied upon to emit console errors during a short startup smoke.
        fs.writeFileSync(
          path.join(extension, `${label}.js`),
          `${ses}
lockdown({evalTaming:'no-eval',errorTaming:'unsafe',errorTrapping:'none',reporting:'none'});globalThis.fixtureExecuted=true;globalThis.fixtureRetainedRejection=Promise.reject(new Error('${label} immediate rejection'));${label === 'background' ? "chrome.offscreen.createDocument({url:'offscreen.html',reasons:['BLOBS'],justification:'Native observer lifecycle regression'});" : ''}`,
        );
        if (label !== 'background')
          fs.writeFileSync(
            path.join(extension, `${label}.html`),
            `<meta charset="utf-8"><script src="${label}.js"></script>`,
          );
      }
      browser = await startBrowser(
        path.join(directory, 'profile'),
        process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
      );
      const errors = [];
      const observations = [];
      const rejections = [];
      const targets = await interceptTargets(
        browser,
        origin,
        async (session, label, page) => {
          session.on('Runtime.bindingCalled', ({ payload }) => {
            const detail = JSON.parse(payload);
            if (detail.type === 'observer')
              observations.push({ label, ...detail });
            else rejections.push(detail);
          });
          await session.send('Runtime.enable');
          await session.send('Network.enable');
          await session.send('Log.enable');
          if (!page) {
            const { result } = await session.send('Runtime.evaluate', {
              expression:
                '({executed:typeof fixtureExecuted,frozen:Object.isFrozen(Object.prototype)})',
              returnByValue: true,
            });
            assert.deepEqual(result.value, {
              executed: 'undefined',
              frozen: false,
            });
          }
          await installRejectionObserver(session, !page);
        },
        (label, detail) => errors.push({ label, detail }),
      );
      assert.equal(
        (await browser.cdp.send('Extensions.loadUnpacked', { path: extension }))
          .id,
        id,
      );
      // Match the formal harness: prepare the blank page before navigating.
      // Creating a target with its final URL can run page scripts before CDP
      // applies the document observer, even with worker auto-attachment paused.
      const { targetId: popupId } = await browser.cdp.send(
        'Target.createTarget',
        { url: 'about:blank' },
      );
      for (
        let attempt = 0;
        attempt < 100 && !targets.has(popupId);
        attempt += 1
      )
        await new Promise((resolve) => setTimeout(resolve, 25));
      assert.ok(targets.has(popupId));
      const popup = await targets.get(popupId);
      await popup.send('Page.navigate', { url: `${origin}/popup.html` });
      for (
        let attempt = 0;
        attempt < 200 && rejections.length < 3 && errors.length === 0;
        attempt += 1
      )
        await new Promise((resolve) => setTimeout(resolve, 25));
      assert.deepEqual(errors, []);
      assert.deepEqual(rejections.map(({ message }) => message).toSorted(), [
        'Error: background immediate rejection',
        'Error: offscreen immediate rejection',
        'Error: popup immediate rejection',
      ]);
      assert.ok(observations.length >= 3);
      assert.ok(
        observations.every(
          ({ installedBeforeLockdown }) => installedBeforeLockdown,
        ),
      );
      const { targetInfos } = await browser.cdp.send('Target.getTargets');
      const bg = await targets.get(
        targetInfos.find(({ url }) => url === `${origin}/background.js`)
          .targetId,
      );
      const state = await bg.send('Runtime.evaluate', {
        expression:
          "({frozen:Object.isFrozen(Object.prototype),noEval:(()=>{try{Function('return 1')();return false}catch{return true}})()})",
        returnByValue: true,
      });
      assert.deepEqual(state.result.value, { frozen: true, noEval: true });
      const contexts = await bg.send('Runtime.evaluate', {
        expression: 'chrome.runtime.getContexts({})',
        returnByValue: true,
        awaitPromise: true,
      });
      assert.equal(
        contexts.result.value.filter(
          ({ contextType, documentUrl }) =>
            contextType === 'OFFSCREEN_DOCUMENT' &&
            documentUrl === `${origin}/offscreen.html`,
        ).length,
        1,
      );
      // A late observer fails atomically instead of trusting a stale prior read.
      await assert.rejects(
        installRejectionObserver(bg, true),
        /Worker initialized before/,
      );
      assert.equal(observations.at(-1).installedBeforeLockdown, false);
    } finally {
      await browser?.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
