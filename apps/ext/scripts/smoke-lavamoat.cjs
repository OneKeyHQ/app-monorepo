// cspell:ignore LavaMoat lavamoat testid webauthn

const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');

const { LavaMoatError } = require('../../../development/lavamoat/error.cjs');
const { parse } = createRequire(require.resolve('jsdom'))('parse5');
const extRoot = path.resolve(__dirname, '..');
const budgets = {
  EXT_BUILD_MAX_TOTAL_BYTES: 166_000_000,
  EXT_BUILD_MAX_JS_FILES: 1000,
  EXT_BUILD_MAX_BACKGROUND_BYTES: 39 * 1024 * 1024,
};

function checkerEnvironment(environment = process.env) {
  const result = { ...environment, EXT_CHANNEL: 'chrome' };
  for (const [key, ceiling] of Object.entries(budgets)) {
    if (environment[key] !== undefined) {
      const value = Number(environment[key]);
      assert.ok(
        Number.isFinite(value) && value > 0 && value <= ceiling,
        `${key} must not relax the production budget`,
      );
    }
  }
  return result;
}

function fileHashes(root) {
  assert.ok(
    fs.lstatSync(root).isDirectory(),
    'Artifact root must be a real directory',
  );
  const hashes = {};
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .toSorted((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else {
        assert.ok(
          entry.isFile(),
          'Extension artifacts must contain only regular files',
        );
        hashes[path.relative(root, file).split(path.sep).join('/')] =
          createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      }
    }
  };
  visit(root);
  return hashes;
}

function validateProtection(root) {
  const hashes = fileHashes(root);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
  );
  assert.equal(
    manifest.name,
    'OneKey: Secure Crypto Wallet',
    'Smoke requires the official manifest before zip.js creates its development variant',
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(
    manifest.content_security_policy.extension_pages
      .replace(/\s+/g, ' ')
      .trim(),
    "script-src 'self' 'wasm-unsafe-eval' ; object-src 'self';",
  );
  assert.equal(manifest.background.service_worker, 'background.bundle.js');
  const runtimes = Object.keys(hashes).filter((file) =>
    /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/.test(file),
  );
  assert.equal(
    runtimes.length,
    1,
    'Finalized pages must contain one protected runtime',
  );
  const ses = fs.readFileSync(
    createRequire(require.resolve('@lavamoat/webpack')).resolve('ses'),
    'utf8',
  );
  const protectedRuntimes = new Set([
    ...runtimes,
    'background.bundle.js',
    'content-script.bundle.js',
  ]);
  for (const file of protectedRuntimes)
    assert.ok(
      Object.hasOwn(hashes, file),
      `Missing finalized compiler runtime: ${file}`,
    );
  let wrapped = 0;
  for (const file of Object.keys(hashes).filter((item) =>
    item.endsWith('.js'),
  )) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(
      source.split(ses).length - 1,
      protectedRuntimes.has(file) ? 1 : 0,
      `Unexpected SES placement in ${file}`,
    );
    if (protectedRuntimes.has(file))
      assert.match(source, /\._LM_\s*=/, `Missing policy runtime in ${file}`);
    if (file === 'background.bundle.js' || file === 'content-script.bundle.js')
      assert.match(
        source,
        /\._LM_\(/,
        `Missing protected entry modules in ${file}`,
      );
    if (/\._LM_\(/.test(source)) wrapped += 1;
  }
  assert.ok(
    wrapped >= 3,
    'All three compiler graphs must contain protected modules',
  );
  for (const file of [
    'ui-popup.html',
    'ui-expand-tab.html',
    'ui-passkey.html',
    'offscreen.html',
  ]) {
    const scripts = [];
    const visit = (node) => {
      if (
        node.tagName === 'script' &&
        node.namespaceURI === 'http://www.w3.org/1999/xhtml'
      ) {
        const attrs = Object.fromEntries(
          node.attrs.map(({ name, value }) => [name, value]),
        );
        if (attrs.src) scripts.push(attrs);
      }
      node.childNodes?.forEach(visit);
    };
    visit(parse(fs.readFileSync(path.join(root, file), 'utf8')));
    for (const script of scripts) {
      const url = new URL(script.src, 'https://extension.invalid/');
      assert.equal(
        url.origin,
        'https://extension.invalid',
        'Every executable HTML script must be local',
      );
      assert.ok(
        Object.hasOwn(hashes, decodeURIComponent(url.pathname).slice(1)),
      );
    }
    const protectedScripts = scripts.filter(
      (script) =>
        new URL(script.src, 'https://extension.invalid/').pathname !==
        '/preload-html-head.js',
    );
    assert.ok(
      protectedScripts.length >= 2,
      `Missing protected entry scripts in ${file}`,
    );
    assert.equal(protectedScripts[0].src.replace(/^\//, ''), runtimes[0]);
    assert.equal(
      scripts.filter((script) => script.src.replace(/^\//, '') === runtimes[0])
        .length,
      1,
    );
    for (const script of protectedScripts) {
      const url = new URL(script.src, 'https://extension.invalid/');
      assert.equal(url.origin, 'https://extension.invalid');
      const filename = decodeURIComponent(url.pathname).slice(1);
      assert.ok(Object.hasOwn(hashes, filename));
      assert.equal(
        script.integrity,
        `sha384-${createHash('sha384')
          .update(fs.readFileSync(path.join(root, filename)))
          .digest('base64')}`,
      );
      assert.equal(script.crossorigin, 'anonymous');
    }
  }
  for (const [file, source] of [
    ['injected.js', 'src/entry/injected.js'],
    ['preload-html-head.js', 'src/assets/preload-html-head.js'],
    ['ui-popup-boot.js', 'src/assets/ui-popup-boot.js'],
  ]) {
    assert.deepEqual(
      fs.readFileSync(path.join(root, file)),
      fs.readFileSync(path.join(extRoot, source)),
      `Trusted copy changed: ${file}`,
    );
  }
  assert.equal(typeof manifest.key, 'string');
  const id = createHash('sha256')
    .update(Buffer.from(manifest.key, 'base64'))
    .digest('hex')
    .slice(0, 32)
    .split('')
    .map((value) => String.fromCharCode(97 + Number.parseInt(value, 16)))
    .join('');
  return {
    hashes,
    id,
    manifestVersion: manifest.version,
    runtime: runtimes[0],
  };
}

// Passkey's production idle route intentionally renders no visible controls.
// Inspect only committed component names, never React props, state or hooks.
function pageReadiness(passkey) {
  const root = document.getElementById('root');
  if (
    !root ||
    document.querySelector(
      '[data-testid="GlobalJotaiReady-not-ready-placeholder"]',
    )
  )
    return null;
  if (passkey) {
    const key = Object.keys(root).find((name) =>
      name.startsWith('__reactContainer$'),
    );
    const fiber = key && root[key]?.stateNode?.current;
    const seen = new Set();
    const mounted = (node) => {
      if (!node || seen.has(node)) return false;
      seen.add(node);
      return (
        node.type?.name === 'PassKeyContainer' ||
        mounted(node.child) ||
        mounted(node.sibling)
      );
    };
    return mounted(fiber) ? 'passkey-idle-bootstrap' : null;
  }
  const visible = (element) =>
    element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const byId = (id) => document.querySelector(`[data-testid="${id}"]`);
  const has = (element, text) =>
    visible(element) && element.innerText.includes(text);
  if (
    visible(byId('onboarding-get-started-page')) &&
    has(byId('onboarding-create-wallet-button'), 'Create new wallet') &&
    has(byId('onboarding-import-wallet-button'), 'Add existing wallet')
  )
    return 'onboarding';
  const home = byId('home-page');
  if (
    visible(home) &&
    has(byId('Wallet-No-Wallet-Empty'), 'No wallet') &&
    has(byId('Wallet-No-Wallet-Empty'), 'Create wallet')
  )
    return 'wallet-empty';
  if (
    visible(byId('market-page')) &&
    has(byId('market-tabs'), 'Favorites') &&
    [
      'market-top-coins-list',
      'market-stock-list',
      'market-perps-list',
      'market-watch-list',
    ].some((id) => visible(byId(id)))
  )
    return 'market';
  return null;
}

function observeRejections(binding) {
  const send = globalThis[binding];
  delete globalThis[binding];
  const stringify = JSON.stringify;
  const frozen = Object.isFrozen(Object.prototype);
  if (frozen) {
    send(stringify({ type: 'observer', installedBeforeLockdown: false }));
    return false;
  }
  globalThis.addEventListener('unhandledrejection', (event) => {
    let message = 'Unhandled promise rejection';
    let stack;
    try {
      message = String(event.reason);
      stack = event.reason?.stack;
    } catch {
      /* Keep the failure even when its reason cannot be inspected. */
    }
    send(stringify({ type: 'rejection', message, stack }));
  });
  send(stringify({ type: 'observer', installedBeforeLockdown: true }));
  return true;
}

async function deadline(promise, label, ms = 30_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new LavaMoatError(`${label} timed out`)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function installRejectionObserver(session, worker) {
  await session.send('Runtime.addBinding', { name: '__onekeySmokeRejection' });
  const expression = `(${observeRejections.toString()})('__onekeySmokeRejection')`;
  if (worker) {
    const result = await session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    assert.equal(result.exceptionDetails, undefined);
    assert.equal(
      result.result.value,
      true,
      'Worker initialized before native rejection observation',
    );
  } else {
    await session.send('Page.enable');
    await session.send('Page.addScriptToEvaluateOnNewDocument', {
      source: expression,
      runImmediately: true,
    });
  }
}

async function interceptTargets(browser, origin, monitor, fail) {
  const targets = new Map();
  browser.cdp.on('Target.attachedToTarget', (event) => {
    const { targetInfo, waitingForDebugger } = event;
    const session = browser.session(event.sessionId);
    const ready = (async () => {
      if (
        targetInfo.type === 'service_worker' &&
        !targetInfo.url.startsWith(`${origin}/`)
      ) {
        await session.send('Runtime.runIfWaitingForDebugger');
        return session;
      }
      // Offscreen targets initially have an empty URL. Observe every new page
      // before navigation and validate the actual extension context later.
      if (targetInfo.url.startsWith(`${origin}/`))
        assert.equal(
          waitingForDebugger,
          true,
          'Extension started before CDP interception',
        );
      await monitor(
        session,
        `${targetInfo.type}:${targetInfo.targetId}`,
        targetInfo.type !== 'service_worker',
      );
      await session.send('Runtime.runIfWaitingForDebugger');
      return session;
    })();
    ready.catch((error) => fail('Target observation failed', error.message));
    targets.set(targetInfo.targetId, ready);
  });
  await browser.cdp.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true,
    filter: [
      { type: 'service_worker' },
      { type: 'page' },
      { type: 'other' },
      { type: 'background_page' },
      { exclude: true },
    ],
  });
  return targets;
}

// Own the CDP connection: another automation client may resume auto-attached
// workers before their native rejection observer is installed.
async function startBrowser(profile, executablePath) {
  const { chromium } = require('playwright-core');
  const child = spawn(
    executablePath || chromium.executablePath(),
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      '--enable-automation',
      '--disable-component-extensions-with-background-pages',
      '--lang=en-US',
      '--window-size=400,700',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] },
  );
  const exited = Promise.withResolvers();
  const stderrLimit = 16 * 1024;
  let stderr = Buffer.alloc(0);
  let stderrTruncated = false;
  /** @type {Error | undefined} */
  let transportError;
  child.stderr.on('data', (data) => {
    const combined = Buffer.concat([stderr, data]);
    stderrTruncated ||= combined.length > stderrLimit;
    stderr = Buffer.from(combined.subarray(-stderrLimit));
  });
  const pending = new Map();
  const sessions = new Map();
  let sequence = 0;
  const session = (sessionId = '') => {
    if (!sessions.has(sessionId)) {
      const events = new EventEmitter();
      events.send = async (method, params = {}) => {
        if (transportError) {
          const failure = new LavaMoatError(transportError.message);
          failure.cause = transportError;
          throw failure;
        }
        if (child.stdio[3].destroyed || !child.stdio[3].writable)
          throw new LavaMoatError('Chromium CDP input pipe is closed');
        sequence += 1;
        const id = sequence;
        const response = Promise.withResolvers();
        response.promise.catch(() => {});
        pending.set(id, response);
        try {
          child.stdio[3].write(
            `${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`,
            (error) => {
              if (error) response.reject(error);
            },
          );
          return await deadline(response.promise, method);
        } finally {
          pending.delete(id);
        }
      };
      sessions.set(sessionId, events);
    }
    return sessions.get(sessionId);
  };
  const rejectPending = (error) => {
    transportError ||= error;
    for (const request of pending.values()) request.reject(transportError);
    pending.clear();
  };
  // Wait for stdio to close as well, so a fatal launch message is not lost
  // when the process exit event arrives before its final stderr bytes.
  child.once('close', () => exited.resolve());
  child.once('exit', (code, signal) => {
    rejectPending(
      new LavaMoatError(`Chromium exited (code=${code}, signal=${signal})`),
    );
  });
  child.once('error', (error) => {
    rejectPending(error);
  });
  child.stderr.on('error', rejectPending);
  child.stdio[3].on('error', rejectPending);
  child.stdio[4].on('error', rejectPending);
  child.stdio[4].once('end', () =>
    rejectPending(new LavaMoatError('Chromium CDP output pipe closed')),
  );
  let buffer = '';
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', (data) => {
    buffer += data;
    let end = buffer.indexOf('\0');
    while (end !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id) {
        const request = pending.get(message.id);
        if (message.error)
          request?.reject(new LavaMoatError(`${message.error.message}`));
        else request?.resolve(message.result);
      } else session(message.sessionId).emit(message.method, message.params);
      end = buffer.indexOf('\0');
    }
  });
  const close = async () => {
    /** @type {Error | undefined} */
    let closeError;
    try {
      if (
        child.pid &&
        child.exitCode === null &&
        child.signalCode === null &&
        !transportError &&
        !child.stdio[3].destroyed &&
        child.stdio[3].writable
      )
        await deadline(
          session().send('Browser.close'),
          'Browser shutdown',
          5000,
        );
    } catch (error) {
      closeError = error;
    }
    child.kill('SIGTERM');
    try {
      await deadline(exited.promise, 'Browser exit', 5000);
    } catch (error) {
      child.kill('SIGKILL');
      closeError ||= error;
      await deadline(exited.promise, 'Forced browser exit', 5000);
    }
    if (closeError) {
      const failure = new LavaMoatError(closeError.message);
      failure.cause = closeError;
      throw failure;
    }
  };
  try {
    const version = await deadline(
      session().send('Browser.getVersion'),
      'Chromium initialization',
      10_000,
    );
    return { cdp: session(), session, close, version };
  } catch (error) {
    let cleanupError;
    try {
      await close();
    } catch (failure) {
      cleanupError = failure;
    }
    const failure = new LavaMoatError(
      `Chromium initialization failed: ${String(error)}\nProcess: code=${child.exitCode}, signal=${child.signalCode}\nStderr${stderrTruncated ? ' (last 16384 bytes)' : ''}:\n${stderr.toString('utf8')}${cleanupError ? `\nCleanup: ${String(cleanupError)}` : ''}`,
    );
    failure.cause = error;
    if (cleanupError) failure.cleanupError = cleanupError;
    throw failure;
  }
}

async function run(values) {
  const root = path.join(
    extRoot,
    'build',
    ...(values['production-output'] ? [] : ['lavamoat']),
    'chrome_v3',
  );
  const output = values.output
    ? path.resolve(values.output)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-smoke-report-'));
  fs.mkdirSync(output, { recursive: true });
  const relativeOutput = path.relative(
    path.resolve(root),
    fs.realpathSync(output),
  );
  assert.ok(
    relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput),
    'Reports must be outside the artifact',
  );
  const report = {
    status: 'failed',
    acceptance: 'finalized-production-artifact',
    limits: [
      'Passkey idle bootstrap does not test WebAuthn authentication.',
      'The copied DApp MAIN provider and child workers are outside package isolation.',
    ],
    errors: [],
    externalNetworkFailures: [],
    observers: {},
    contexts: [],
    pages: [],
  };
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-smoke-'));
  let browser;
  let server;
  let closing = false;
  const failure = Promise.withResolvers();
  failure.promise.catch(() => {});
  const fail = (label, detail) => {
    if (closing) return;
    report.errors.push({ label, detail });
    failure.reject(new LavaMoatError(label));
  };
  const guarded = (promise, label, ms) =>
    deadline(Promise.race([promise, failure.promise]), label, ms);
  const read = async (session, expression, extra = {}) => {
    const response = await guarded(
      session.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
        ...extra,
      }),
      'Runtime observation',
    );
    assert.equal(
      response.exceptionDetails,
      undefined,
      response.exceptionDetails?.exception?.description,
    );
    return response.result.value;
  };
  const monitor = async (session, label, beforeNavigation = false) => {
    session.on('Runtime.exceptionThrown', (event) =>
      fail(
        `${label}: uncaught exception`,
        event.exceptionDetails.exception?.description ||
          event.exceptionDetails.text,
      ),
    );
    session.on('Runtime.consoleAPICalled', (event) => {
      if (event.type === 'error')
        fail(
          `${label}: console error`,
          event.args.map((arg) => arg.description ?? arg.value).join(' '),
        );
    });
    session.on('Runtime.bindingCalled', (event) => {
      if (event.name === '__onekeySmokeRejection') {
        const detail = JSON.parse(event.payload);
        if (detail.type === 'observer') {
          report.observers[label] = detail;
          if (!detail.installedBeforeLockdown)
            fail(`${label}: late native rejection observer`, detail);
        } else fail(`${label}: unhandled rejection`, detail);
      }
    });
    const requests = new Map();
    session.on('Network.requestWillBeSent', (event) =>
      requests.set(event.requestId, event.request.url),
    );
    session.on('Network.loadingFailed', (event) => {
      const request = requests.get(event.requestId);
      if (!request || closing) return;
      const url = new URL(request);
      if (url.protocol === 'chrome-extension:' || event.blockedReason)
        fail(`${label}: resource blocked or missing`, {
          path: url.pathname,
          error: event.errorText,
          blockedReason: event.blockedReason,
        });
      else
        report.externalNetworkFailures.push({
          origin: url.origin,
          path: url.pathname,
          error: event.errorText,
        });
    });
    session.on('Network.responseReceived', (event) => {
      if (
        event.response.url.startsWith('chrome-extension:') &&
        event.response.status >= 400
      )
        fail(`${label}: packaged resource status`, event.response.status);
    });
    session.on('Log.entryAdded', ({ entry }) => {
      if (entry.source === 'security' && entry.level === 'error')
        fail(`${label}: browser security error`, entry.text);
    });
    await session.send('Runtime.enable');
    await session.send('Network.enable');
    await session.send('Log.enable');
    await installRejectionObserver(session, !beforeNavigation);
  };
  const hostState = (session) =>
    read(
      session,
      `({harden:typeof harden,frozen:[Object.prototype,Function.prototype,Array.prototype].map(Object.isFrozen),noEval:(()=>{try{Function('return globalThis')();return false}catch{return true}})()})`,
    );
  const assertHost = (state) => {
    assert.equal(state.harden, 'function');
    assert.deepEqual(state.frozen, [true, true, true]);
    assert.equal(state.noEval, true);
  };
  try {
    const checkerEnv = checkerEnvironment();
    const before = fileHashes(root);
    report.checker = JSON.parse(
      execFileSync(
        process.execPath,
        [
          path.join(__dirname, 'check-build-output.js'),
          '--lavamoat',
          ...(values['production-output'] ? ['--production-output'] : []),
        ],
        { env: checkerEnv, encoding: 'utf8', timeout: 60_000 },
      ),
    );
    report.artifact = validateProtection(root);
    const snapshot = path.join(temporary, 'extension');
    fs.cpSync(root, snapshot, { recursive: true });
    assert.deepEqual(
      fileHashes(root),
      before,
      'Artifact changed during verification',
    );
    assert.deepEqual(
      fileHashes(snapshot),
      before,
      'Snapshot must preserve the checked bytes',
    );
    browser = await startBrowser(
      path.join(temporary, 'profile'),
      values.chrome || process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
    );
    report.browser = browser.version.product;
    const origin = `chrome-extension://${report.artifact.id}`;
    const browserCdp = browser.cdp;
    const targets = await interceptTargets(browser, origin, monitor, fail);
    const loaded = await guarded(
      browserCdp.send('Extensions.loadUnpacked', { path: snapshot }),
      'Extension loading',
    );
    assert.equal(loaded.id, report.artifact.id);
    const findTarget = async (url) => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const { targetInfos } = await browserCdp.send('Target.getTargets');
        const target = targetInfos.find((item) => item.url === url);
        if (target && targets.has(target.targetId))
          return guarded(targets.get(target.targetId), 'Target observation');
        await guarded(
          new Promise((resolve) => setTimeout(resolve, 100)),
          'Target discovery',
        );
      }
      throw new LavaMoatError('Required extension target did not start');
    };
    const newPage = async () => {
      const { targetId } = await browserCdp.send('Target.createTarget', {
        url: 'about:blank',
      });
      for (
        let attempt = 0;
        attempt < 100 && !targets.has(targetId);
        attempt += 1
      )
        await guarded(
          new Promise((resolve) => setTimeout(resolve, 50)),
          'Page attachment',
        );
      assert.ok(
        targets.has(targetId),
        'The page must be intercepted before navigation',
      );
      const session = await guarded(targets.get(targetId), 'Page observation');
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 400,
        height: 700,
        deviceScaleFactor: 1,
        mobile: false,
      });
      return session;
    };
    const navigate = async (session, url) => {
      const loadedDocument = Promise.withResolvers();
      session.once('Page.domContentEventFired', loadedDocument.resolve);
      const response = await guarded(
        session.send('Page.navigate', { url }),
        'Page navigation',
      );
      assert.equal(response.errorText, undefined, response.errorText);
      await guarded(loadedDocument.promise, 'Page document load');
    };
    const bg = await findTarget(`${origin}/background.bundle.js`);
    const backgroundReady = async () => {
      for (let attempt = 0; attempt < 150; attempt += 1) {
        const state = await hostState(bg);
        if (state.harden === 'function' && state.frozen.every(Boolean))
          return state;
        await guarded(
          new Promise((resolve) => setTimeout(resolve, 100)),
          'Background initialization',
        );
      }
      throw new LavaMoatError('Background lockdown did not initialize');
    };
    report.background = await backgroundReady();
    assertHost(report.background);
    const pageSessions = [];
    for (const filename of [
      'ui-popup.html',
      'ui-expand-tab.html',
      'ui-passkey.html',
    ]) {
      const session = await newPage();
      pageSessions.push(session);
      await navigate(session, `${origin}/${filename}`);
      const item = { filename };
      report.pages.push(item);
      for (let attempt = 0; attempt < 150; attempt += 1) {
        item.ready = await read(
          session,
          `(${pageReadiness.toString()})(${filename === 'ui-passkey.html'})`,
        );
        if (item.ready) break;
        await guarded(
          new Promise((resolve) => setTimeout(resolve, 200)),
          `${filename} readiness`,
        );
      }
      assert.ok(
        item.ready,
        `${filename} never reached actual application readiness`,
      );
      item.host = await hostState(session);
      assertHost(item.host);
      const screenshot = await guarded(
        session.send('Page.captureScreenshot', { format: 'png' }),
        'Screenshot',
        5000,
      );
      fs.writeFileSync(
        path.join(output, `${filename}.png`),
        Buffer.from(screenshot.data, 'base64'),
      );
    }
    report.contexts = await read(bg, 'chrome.runtime.getContexts({})');
    const offscreenContext = report.contexts.filter(
      (item) =>
        item.contextType === 'OFFSCREEN_DOCUMENT' &&
        item.documentUrl === `${origin}/offscreen.html`,
    );
    assert.equal(
      offscreenContext.length,
      1,
      'The application must create its real offscreen document',
    );
    const offscreen = await findTarget(`${origin}/offscreen.html`);
    report.offscreen = await hostState(offscreen);
    assertHost(report.offscreen);
    assert.equal(
      await read(offscreen, 'typeof chrome.tabs'),
      'undefined',
      'A normal tab cannot substitute for the offscreen lifecycle',
    );
    report.runtimeChecks = {};
    for (const runtime of [
      'ext-background',
      'ext-ui',
      'ext-passkey',
      'ext-offscreen',
    ]) {
      const from = runtime === 'ext-background' ? pageSessions[0] : bg;
      const result = await read(
        from,
        `chrome.runtime.sendMessage({type:'ONEKEY_SES_HARDEN_RUNTIME_CHECK',targetRuntime:${JSON.stringify(runtime)}})`,
      );
      assert.equal(
        result?.ok,
        true,
        `${runtime} did not answer its real runtime check`,
      );
      assert.equal(
        result.report.summary.failed,
        0,
        `${runtime} runtime checks failed`,
      );
      report.runtimeChecks[runtime] = {
        level: result.report.level,
        summary: result.report.summary,
      };
    }
    server = http.createServer((request, response) =>
      response
        .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        .end(
          '<!doctype html><html><head><link rel="icon" href="data:,"></head><body>OneKey local bridge smoke</body></html>',
        ),
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const dappCdp = await newPage();
    const worlds = [];
    dappCdp.on('Runtime.executionContextCreated', ({ context }) =>
      worlds.push(context),
    );
    await navigate(dappCdp, `http://127.0.0.1:${server.address().port}`);
    for (
      let attempt = 0;
      attempt < 50 && (await read(dappCdp, 'typeof $onekey')) !== 'object';
      attempt += 1
    )
      await guarded(
        new Promise((resolve) => setTimeout(resolve, 100)),
        'Provider installation',
      );
    assert.equal(
      await read(dappCdp, 'Object.isFrozen(Object.prototype)'),
      false,
      'The extension must not freeze the DApp MAIN realm',
    );
    assert.deepEqual(
      await read(dappCdp, "$onekey.ethereum.request({method:'eth_accounts'})"),
      [],
      'Only an empty-wallet readonly RPC is allowed',
    );
    const pong = await read(
      dappCdp,
      "(async()=>{const started=Date.now();const result=await $onekey.$private.request({method:'wallet_getConnectWalletInfo',params:{time:started}});return {started,result};})()",
    );
    assert.equal(pong.result?.pong, true);
    assert.ok(
      pong.result.time >= pong.started &&
        pong.result.delay >= 0 &&
        pong.result.delay < 30_000,
    );
    const contentWorlds = worlds.filter(
      (world) => world.origin === origin && world.auxData?.isDefault === false,
    );
    assert.equal(
      contentWorlds.length,
      1,
      'The actual isolated content-script world must exist',
    );
    report.content = await read(
      dappCdp,
      '({harden:typeof harden,frozen:Object.isFrozen(Object.prototype)})',
      { contextId: contentWorlds[0].id },
    );
    assert.deepEqual(report.content, { harden: 'function', frozen: true });
    report.bridge = {
      accounts: 'empty',
      pong: true,
      delay: pong.result.delay,
      mainIntrinsicsMutable: true,
    };
    await guarded(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      'Stable startup',
    );
    assert.deepEqual(report.errors, []);
    report.status = 'passed';
  } catch (error) {
    report.failure = error.message;
    process.exitCode = 1;
  } finally {
    closing = true;
    try {
      await deadline(browser?.close(), 'Browser cleanup', 10_000);
    } catch (error) {
      report.cleanupError = error.message;
      report.status = 'failed';
      process.exitCode = 1;
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.writeFileSync(
      path.join(output, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
  console.log(
    `Extension LavaMoat smoke ${report.status}: ${path.join(output, 'report.json')}`,
  );
  return report;
}

if (require.main === module) {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      chrome: { type: 'string' },
      'production-output': { type: 'boolean', default: false },
    },
  });
  run(values).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  checkerEnvironment,
  startBrowser,
  interceptTargets,
  installRejectionObserver,
  observeRejections,
  fileHashes,
  pageReadiness,
  validateProtection,
};
