// cspell:ignore LavaMoat lavamoat webcontents SRI

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { parseArgs } = require('node:util');

const { values } = parseArgs({
  options: {
    output: { type: 'string' },
    'production-output': { type: 'boolean' },
    'mock-health': { type: 'boolean' },
    'no-navigation-gate': { type: 'boolean' },
  },
  strict: true,
});
const repoRoot = path.resolve(__dirname, '../../..');
const repoRequire = createRequire(path.join(repoRoot, 'package.json'));
const { _electron: electron } = repoRequire('playwright-core');
const { parse } = createRequire(repoRequire.resolve('jsdom'))('parse5');
const { LavaMoatError } = repoRequire('./development/lavamoat/error.cjs');
const desktopRoot = path.join(repoRoot, 'apps/desktop');
const mainPath = path.join(
  desktopRoot,
  values['production-output'] ? 'app/dist/app.js' : 'app/dist-lavamoat/app.js',
);
const rendererRoot = path.join(desktopRoot, 'app/build');
const indexPath = path.join(rendererRoot, 'index.html');
const output = values.output
  ? path.resolve(values.output)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-desktop-smoke-'));
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'profile-'));
const events = [];
let app;
let page;
const exceptions = [];
const unhandledRejections = [];
const consoleErrors = [];
const failedAssets = [];
const externalFailures = new Set();
const pendingAssets = new Set();
const observedPages = new WeakSet();
const consoleDiagnostics = new Set();
let lastAssetActivity = Date.now();
const runtimeContexts = new Map();
const parsedScripts = new Map();

async function withTimeout(operation, duration, label) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new LavaMoatError(`Timed out: ${label}`)),
          duration,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function getReadyScreen(route) {
  const visible = (element) =>
    element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const byId = (id, parent = document) =>
    parent.querySelector(`[data-testid="${id}"]`);
  const hasText = (element, text) =>
    visible(element) && element.innerText.includes(text);
  const onboarding = byId('onboarding-get-started-page');
  if (
    visible(onboarding) &&
    // Desktop's wide card layout has labels but only narrow buttons have test IDs.
    hasText(onboarding, 'Create new wallet') &&
    hasText(onboarding, 'Add existing wallet') &&
    hasText(onboarding, 'Connect hardware wallet')
  )
    return 'onboarding';
  const home = byId('home-page');
  if (
    visible(home) &&
    visible(byId('web-dapp-btn', home)) &&
    hasText(home, 'Connect wallet') &&
    hasText(home, 'Track any address')
  )
    return 'wallet-connect';
  const emptyWallet = byId('Wallet-No-Wallet-Empty', home || document);
  if (
    visible(home) &&
    hasText(emptyWallet, 'No wallet') &&
    hasText(emptyWallet, 'Create wallet')
  ) {
    return 'wallet-empty';
  }
  const market = byId('market-page');
  const marketContent = [
    'market-trending-desktop-toolbar',
    'market-top-coins-list',
    'market-stock-list',
    'market-perps-list',
    'market-watch-list',
    'market-sort-change',
  ];
  if (
    route === '/' &&
    visible(market) &&
    hasText(byId('market-tabs', market), 'Favorites') &&
    marketContent.some((id) => visible(byId(id, market)))
  )
    return 'market';
  return null;
}

function observeUnhandledRejections(bindingName) {
  const report = globalThis[bindingName];
  delete globalThis[bindingName];
  const stringify = JSON.stringify;
  const toString = String;
  globalThis.addEventListener('unhandledrejection', (event) => {
    const diagnostic = { message: 'Unhandled promise rejection' };
    try {
      diagnostic.message = toString(event.reason);
    } catch {
      diagnostic.message = 'Unhandled promise rejection (unreadable reason)';
    }
    try {
      if (typeof event.reason?.stack === 'string') {
        diagnostic.stack = event.reason.stack;
      }
    } catch {
      diagnostic.stackCaptureError = 'Rejection stack is unavailable';
    }
    // Do not preventDefault or interfere with application/SES error handlers.
    report(stringify(diagnostic));
  });
}

function isExternalNetworkConsoleError(error, failures) {
  const resourceFailure =
    /^Failed to load resource: (?:net::ERR_[A-Z_]+|the server responded with a status of [45]\d\d\b)/.test(
      error.text,
    );
  const corsFailure =
    /^Access to (?:fetch|XMLHttpRequest|font|image|script) at '([^']+)' from origin '[^']+' has been blocked by CORS policy:/.exec(
      error.text,
    );
  return Boolean(
    (resourceFailure && failures.has(error.url)) ||
    (corsFailure && failures.has(corsFailure[1])),
  );
}

async function captureConsoleErrorStack(cdp, objectId, diagnostic) {
  let timeout;
  try {
    const response = await Promise.race([
      cdp.send('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: 'function () { return this.stack; }',
        returnByValue: true,
        silent: true,
      }),
      new Promise((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new LavaMoatError('Console stack capture timed out')),
          2000,
        );
      }),
    ]);
    if (response.exceptionDetails) {
      diagnostic.stackCaptureError = response.exceptionDetails.text;
    } else if (typeof response.result.value === 'string') {
      diagnostic.stack = response.result.value;
    }
  } catch (error) {
    diagnostic.stackCaptureError = String(error);
  } finally {
    clearTimeout(timeout);
  }
}

function observePage(candidate) {
  if (observedPages.has(candidate)) return;
  observedPages.add(candidate);
  candidate.on('pageerror', (error) => {
    const detail = {
      message: error.message,
      stack: error.stack,
      url: candidate.url(),
    };
    exceptions.push(detail);
    record('pageerror', detail);
  });
  candidate.on('console', (message) => {
    if (message.type() === 'error') {
      const detail = { text: message.text(), url: message.location().url };
      consoleErrors.push(detail);
      record('console-error', detail);
    }
  });
  candidate.on('request', (request) => {
    if (request.url().startsWith('file:')) {
      pendingAssets.add(request);
      lastAssetActivity = Date.now();
    }
  });
  candidate.on('requestfinished', (request) => {
    if (pendingAssets.delete(request)) lastAssetActivity = Date.now();
  });
  candidate.on('requestfailed', (request) => {
    if (pendingAssets.delete(request)) lastAssetActivity = Date.now();
    if (request.url().startsWith('file:'))
      failedAssets.push({ url: request.url(), failure: request.failure() });
    else if (/^https?:/.test(request.url()))
      externalFailures.add(request.url());
    record('requestfailed', { url: request.url(), failure: request.failure() });
  });
  candidate.on('response', (response) => {
    if (
      /^https?:/.test(response.url()) &&
      new URL(response.url()).pathname === '/wallet/v1/health'
    ) {
      record('application-health-response', {
        url: response.url(),
        status: response.status(),
      });
    }
    if (/\.(?:bundle|chunk)\.js(?:[?#]|$)/.test(response.url()))
      record('script-response', {
        url: response.url(),
        status: response.status(),
      });
    if (response.status() >= 400) {
      if (response.url().startsWith('file:'))
        failedAssets.push({ url: response.url(), status: response.status() });
      else if (/^https?:/.test(response.url()))
        externalFailures.add(response.url());
    }
  });
}

async function settleAssets() {
  const deadline = Date.now() + 10_000;
  while (pendingAssets.size || Date.now() - lastAssetActivity < 500) {
    assert.ok(Date.now() < deadline, 'Local production assets must settle');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function checkErrors() {
  const mainLog = path.join(output, 'main-events.jsonl');
  const native = fs.existsSync(mainLog)
    ? fs
        .readFileSync(mainLog, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  for (const event of native) {
    if (event.kind === 'request-error' || event.kind === 'http-error') {
      if (event.url.startsWith('file:')) failedAssets.push(event);
      else if (/^https?:/.test(event.url)) externalFailures.add(event.url);
    }
  }
  const nativeErrors = native.filter((event) =>
    ['main-error', 'renderer-gone', 'load-error'].includes(event.kind),
  );
  const nativeConsoleErrors = native
    .filter(
      (event) =>
        event.kind === 'console' &&
        (event.level === 'error' || event.level === 3),
    )
    .map((event) => ({ text: event.message, url: event.sourceId }));
  const errors = [...consoleErrors, ...nativeConsoleErrors];
  const ignoredExternalNetworkErrors = errors.filter((error) =>
    isExternalNetworkConsoleError(error, externalFailures),
  );
  const unexpectedConsoleErrors = errors.filter(
    (error) => !isExternalNetworkConsoleError(error, externalFailures),
  );
  const evidence = {
    exceptions,
    unhandledRejections,
    failedAssets,
    nativeErrors,
    unexpectedConsoleErrors,
    ignoredExternalNetworkErrors,
  };
  fs.writeFileSync(
    path.join(output, 'error-review.json'),
    JSON.stringify(evidence, null, 2),
  );
  assert.deepEqual(exceptions, [], 'Uncaught renderer exception');
  assert.deepEqual(
    unhandledRejections,
    [],
    'Unhandled renderer promise rejection',
  );
  assert.deepEqual(failedAssets, [], 'Production asset failed to load');
  assert.deepEqual(nativeErrors, [], 'Electron main/renderer failure');
  assert.deepEqual(
    unexpectedConsoleErrors,
    [],
    'Application console error, including caught render errors',
  );
}

function record(kind, details) {
  const event = { at: new Date().toISOString(), kind, ...details };
  events.push(event);
  fs.appendFileSync(
    path.join(output, 'renderer-events.jsonl'),
    `${JSON.stringify(event)}\n`,
  );
}

async function run() {
  assert.ok(fs.existsSync(mainPath), `Missing desktop main: ${mainPath}`);
  assert.ok(
    fs.existsSync(indexPath),
    `Missing protected renderer: ${indexPath}`,
  );
  const names = fs.readdirSync(rendererRoot);
  const entries = names.filter((name) =>
    /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/.test(name),
  );
  assert.equal(
    entries.length,
    1,
    'expected exactly one protected runtime entry',
  );
  const html = fs.readFileSync(indexPath, 'utf8');
  const sources = [];
  const visit = (node) => {
    if (
      node.tagName === 'script' &&
      node.namespaceURI === 'http://www.w3.org/1999/xhtml'
    ) {
      const attributes = Object.fromEntries(
        node.attrs.map(({ name, value }) => [name, value]),
      );
      if (attributes.src) sources.push(attributes);
    }
    // Parse actual elements; comments, script text and template content are inert.
    node.childNodes?.forEach(visit);
  };
  visit(parse(html, { scriptingEnabled: true }));
  const scripts = sources.map(({ src, integrity, crossorigin }) => {
    const url = new URL(src, pathToFileURL(indexPath));
    assert.equal(url.protocol, 'file:', 'HTML scripts must resolve locally');
    let resolved = fileURLToPath(url);
    if (!fs.existsSync(resolved))
      resolved = path.join(rendererRoot, resolved.replace(/^\/+/, ''));
    resolved = fs.realpathSync(resolved);
    assert.ok(
      resolved.startsWith(`${fs.realpathSync(rendererRoot)}${path.sep}`),
      'HTML script must stay in the renderer artifact',
    );
    const contents = fs.readFileSync(resolved);
    const sri = crypto.createHash('sha384').update(contents).digest('base64');
    assert.equal(
      integrity,
      `sha384-${sri}`,
      'HTML SRI must match final script bytes',
    );
    assert.equal(crossorigin, 'anonymous');
    return path.relative(rendererRoot, resolved);
  });
  assert.equal(
    scripts[0],
    entries[0],
    'HTML must load the protected runtime first',
  );
  assert.equal(scripts.filter((file) => file === entries[0]).length, 1);
  const entry = path.join(rendererRoot, entries[0]);
  const source = fs.readFileSync(entry, 'utf8');
  const pluginRequire = createRequire(repoRequire.resolve('@lavamoat/webpack'));
  const ses = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
  assert.equal(
    source.split(ses).length,
    2,
    'SES must appear exactly once and remain untouched',
  );
  for (const name of [
    'app.js',
    'preload.js',
    'service/enum.js',
    'service/index.js',
    'service/windowsHello.js',
    'service/checkBiometricAuthChanged.js',
  ]) {
    const nativeEntry = path.join(path.dirname(mainPath), name);
    assert.equal(
      fs.readFileSync(nativeEntry, 'utf8').split(ses).length,
      2,
      `${name}: untouched SES once`,
    );
    record('node-artifact', {
      path: nativeEntry,
      sha256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(nativeEntry))
        .digest('hex'),
    });
  }
  let wrappedAssets = 0;
  for (const file of fs
    .readdirSync(rendererRoot, { recursive: true })
    .filter((candidateFile) => /\.(?:bundle|chunk)\.js$/.test(candidateFile))) {
    const content = fs.readFileSync(path.join(rendererRoot, file), 'utf8');
    assert.equal(
      content.split(ses).length - 1,
      file === entries[0] ? 1 : 0,
      `Unexpected SES count in ${file}`,
    );
    if (file !== entries[0] && /\._LM_\(/.test(content)) wrappedAssets += 1;
  }
  assert.match(source, /\._LM_\s*=/, 'Runtime must install LavaMoat');
  assert.ok(wrappedAssets > 0, 'Application modules must be wrapped');

  assert.equal(
    names.includes('lockdown'),
    false,
    'a separate relative lockdown script must not be required',
  );
  record('artifacts', {
    navigationGate: !values['no-navigation-gate'],
    diagnosticMode: values['no-navigation-gate']
      ? 'Normal startup timing; native main and console diagnostics begin before import, CDP rejection capture attaches after launch'
      : 'Initial renderer navigation waits until CDP diagnostics are attached',
    indexPath,
    scripts,
    wrappedAssets,
    indexSha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(indexPath))
      .digest('hex'),
    entry,
    entryBytes: Buffer.byteLength(source),
    entrySha256: crypto.createHash('sha256').update(source).digest('hex'),
    mainSha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(mainPath))
      .digest('hex'),
    profile,
  });
  for (const directory of [
    profile,
    path.join(output, 'session'),
    path.join(output, 'logs'),
    path.join(output, 'crashes'),
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const bootstrap = path.join(output, 'bootstrap.cjs');
  fs.writeFileSync(
    path.join(output, 'package.json'),
    JSON.stringify({
      name: 'onekey-lavamoat-desktop-smoke',
      version: '1.0.0',
      main: 'bootstrap.cjs',
    }),
  );
  fs.writeFileSync(
    bootstrap,
    `
    const fs = require('node:fs');
    const { app, session } = require('electron');
    app.commandLine.appendSwitch('lang', 'en-US');
    app.setPath('userData', ${JSON.stringify(profile)});
    app.setPath('sessionData', ${JSON.stringify(path.join(output, 'session'))});
    app.setPath('crashDumps', ${JSON.stringify(path.join(output, 'crashes'))});
    app.setAppLogsPath(${JSON.stringify(path.join(output, 'logs'))});
    const log = (event) => fs.appendFileSync(${JSON.stringify(path.join(output, 'main-events.jsonl'))}, JSON.stringify({at: new Date().toISOString(), ...event}) + '\\n');
    let releaseInitialNavigation;
    const navigationReady = new Promise(resolve => { releaseInitialNavigation = resolve; });
    app.__onekeyLavaMoatSmokeRelease = () => {
      releaseInitialNavigation();
      delete app.__onekeyLavaMoatSmokeRelease;
    };
    log({kind:'pre-import-profile', userData:app.getPath('userData'), sessionData:app.getPath('sessionData')});
    process.on('uncaughtExceptionMonitor', (error) => log({kind:'main-error', message:error.message, stack:error.stack}));
    process.on('unhandledRejection', (error) => log({kind:'main-error', message:String(error), stack:error?.stack}));
    app.on('web-contents-created', (_event, contents) => {
      const originalLoadURL = contents.loadURL;
      if (${JSON.stringify(!values['no-navigation-gate'])}) contents.loadURL = async function (...args) {
        await Reflect.apply(originalLoadURL, this, ['about:blank']);
        await navigationReady;
        contents.loadURL = originalLoadURL;
        return Reflect.apply(originalLoadURL, this, args);
      };
      contents.on('console-message', (details, level, message, line, sourceId) => log({kind:'console', id:contents.id, level:details.level ?? level, message:details.message ?? message, sourceId:details.sourceId ?? sourceId, lineNumber:details.lineNumber ?? line}));
      contents.on('render-process-gone', (_event, details) => log({kind:'renderer-gone', id:contents.id, ...details}));
      contents.on('did-start-navigation', (_event, url) => log({kind:'navigation-start', id:contents.id, url}));
      contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => log({kind:'load-error', id:contents.id, code, description, url, isMainFrame}));
    });
    app.whenReady().then(() => {
      session.defaultSession.webRequest.onErrorOccurred(details => log({kind:'request-error',url:details.url,error:details.error}));
      session.defaultSession.webRequest.onCompleted(details => {
        if (details.statusCode >= 400) log({kind:'http-error',url:details.url,status:details.statusCode});
        if (/^https?:/.test(details.url) && new URL(details.url).pathname === '/wallet/v1/health') log({kind:'application-health-response',url:details.url,status:details.statusCode});
      });
    });
    require(${JSON.stringify(mainPath)});
  `,
  );
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    ELECTRON_IS_DEV: '0',
    PERF_CI_MODE: '1',
    PERF_DESKTOP_USER_DATA_DIR: profile,
    PERF_DESKTOP_INDEX_HTML: indexPath,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  delete env.DESKTOP_E2E_RENDERER_URL;
  app = await electron.launch({
    executablePath: repoRequire('electron'),
    args: [bootstrap],
    cwd: desktopRoot,
    env,
    timeout: 45_000,
  });
  app
    .process()
    .stdout?.on('data', (data) =>
      fs.appendFileSync(path.join(output, 'electron-stdout.log'), data),
    );
  app
    .process()
    .stderr?.on('data', (data) =>
      fs.appendFileSync(path.join(output, 'electron-stderr.log'), data),
    );
  app.context().on('page', observePage);
  page = await app.firstWindow({ timeout: 45_000 });
  observePage(page);
  if (values['mock-health']) {
    await page.route(
      (url) => url.pathname === '/wallet/v1/health',
      (requestRoute) =>
        requestRoute.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"code":0,"data":"ok"}',
        }),
    );
    record('health-fixture', { mode: 'explicit-mocked-response', status: 200 });
  }
  record('process', { pid: app.process().pid });
  const mainSecurity = await app.evaluate(() => ({
    harden: typeof harden,
    object: Object.isFrozen(Object.prototype),
    array: Object.isFrozen(Array.prototype),
    fn: Object.isFrozen(Function.prototype),
    tamper: Reflect.set(Object.prototype, '__mainSmokeMutation', true),
  }));
  assert.deepEqual(mainSecurity, {
    harden: 'function',
    object: true,
    array: true,
    fn: true,
    tamper: false,
  });
  record('main-security', mainSecurity);
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Runtime.executionContextCreated', ({ context }) =>
    runtimeContexts.set(context.id, context),
  );
  cdp.on('Runtime.executionContextDestroyed', ({ executionContextId }) =>
    runtimeContexts.delete(executionContextId),
  );
  cdp.on('Runtime.executionContextsCleared', () => runtimeContexts.clear());
  cdp.on('Debugger.scriptParsed', (script) =>
    parsedScripts.set(script.scriptId, script),
  );
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    exceptions.push(exceptionDetails);
    record('runtime-exception', exceptionDetails);
    const scriptId = exceptionDetails.stackTrace?.callFrames?.[0]?.scriptId;
    if (scriptId) {
      const pending = cdp
        .send('Debugger.getScriptSource', { scriptId })
        .then(({ scriptSource }) =>
          fs.writeFileSync(
            path.join(output, `exception-source-${scriptId}.js`),
            scriptSource,
          ),
        )
        .catch(() => {})
        .finally(() => consoleDiagnostics.delete(pending));
      consoleDiagnostics.add(pending);
    }
  });
  cdp.on('Runtime.consoleAPICalled', ({ type, args, stackTrace }) => {
    if (type !== 'error') return;
    const diagnostic = {
      text: args
        .map((arg) => arg.value ?? arg.description ?? arg.type)
        .join(' '),
      url: stackTrace?.callFrames?.[0]?.url,
      stackTrace,
    };
    for (const arg of args) {
      if (arg.subtype === 'error' && arg.objectId) {
        const pending = captureConsoleErrorStack(
          cdp,
          arg.objectId,
          diagnostic,
        ).finally(() => {
          record('console-error-stack', diagnostic);
          consoleDiagnostics.delete(pending);
        });
        consoleDiagnostics.add(pending);
      }
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Debugger.enable');
  const rejectionBinding = '__onekeyLavaMoatSmokeRejection__';
  cdp.on('Runtime.bindingCalled', ({ name, payload }) => {
    if (name !== rejectionBinding) return;
    const diagnostic = JSON.parse(payload);
    unhandledRejections.push(diagnostic);
    record('unhandled-rejection', diagnostic);
  });
  await cdp.send('Runtime.addBinding', { name: rejectionBinding });
  await page.addInitScript(observeUnhandledRejections, rejectionBinding);
  if (!values['no-navigation-gate'])
    assert.equal(
      page.url(),
      'about:blank',
      'First navigation must wait until native diagnostics are registered',
    );
  const preNavigationIsolation = await app.evaluate(({ app: electronApp }) => {
    const result = {
      userData: electronApp.getPath('userData'),
      sessionData: electronApp.getPath('sessionData'),
      gate: typeof electronApp.__onekeyLavaMoatSmokeRelease,
    };
    electronApp.__onekeyLavaMoatSmokeRelease();
    return result;
  });
  assert.equal(preNavigationIsolation.userData, profile);
  assert.equal(
    preNavigationIsolation.sessionData,
    path.join(output, 'session'),
  );
  assert.equal(preNavigationIsolation.gate, 'function');
  record('diagnostics-ready', preNavigationIsolation);
  const mainWindow = await app.browserWindow(page);
  const webPreferences = await mainWindow.evaluate((window) => {
    const preferences = window.webContents.getLastWebPreferences();
    return {
      webSecurity: preferences.webSecurity,
      sandbox: preferences.sandbox,
      contextIsolation: preferences.contextIsolation,
      nodeIntegration: preferences.nodeIntegration,
      allowRunningInsecureContent: preferences.allowRunningInsecureContent,
    };
  });
  // Match apps/desktop/app/app.ts in PERF_CI_MODE; do not alter production settings.
  assert.deepEqual(webPreferences, {
    webSecurity: true,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    allowRunningInsecureContent: false,
  });
  record('web-preferences', webPreferences);
  await page.waitForURL(
    (url) =>
      values['no-navigation-gate']
        ? url.protocol === 'file:'
        : url.pathname.endsWith('/index.html'),
    {
      timeout: 45_000,
    },
  );
  await page.waitForFunction(getReadyScreen, '/', { timeout: 45_000 });
  // The empty home renders before the first-launch modal finishes mounting.
  // A fresh isolated profile must complete that real onboarding transition.
  await page
    .getByTestId('onboarding-get-started-page')
    .waitFor({ state: 'visible', timeout: 45_000 });
  await settleAssets();
  await Promise.allSettled(consoleDiagnostics);
  const readyScreen = await page.evaluate(getReadyScreen, '/');
  assert.equal(
    readyScreen,
    'onboarding',
    'Fresh-profile onboarding must be fully ready',
  );
  record('ready-screen', { readyScreen });
  const isolatedContext = [...runtimeContexts.values()].find(
    (context) => context.name === 'Electron Isolated Context',
  );
  assert.ok(
    isolatedContext,
    'The actual preload must have a distinct isolated world',
  );
  const preloadPath = path.join(path.dirname(mainPath), 'preload.js');
  const preloadScript = [...parsedScripts.values()].find(
    (script) =>
      script.executionContextId === isolatedContext.id &&
      [preloadPath, pathToFileURL(preloadPath).href].includes(script.url),
  );
  assert.ok(
    preloadScript,
    'The current isolated world must execute the exact preload file',
  );
  const preloadScriptSource = await cdp.send('Debugger.getScriptSource', {
    scriptId: preloadScript.scriptId,
  });
  const preloadBytes = fs.readFileSync(preloadPath, 'utf8');
  const preloadOffset = preloadScriptSource.scriptSource.indexOf(preloadBytes);
  assert.ok(
    preloadOffset >= 0,
    'Electron must execute the complete protected preload artifact',
  );
  record('preload-source', {
    url: preloadScript.url,
    contextId: isolatedContext.id,
    sha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(preloadPath))
      .digest('hex'),
    compiledScriptSha256: crypto
      .createHash('sha256')
      .update(preloadScriptSource.scriptSource)
      .digest('hex'),
    wrapperPrefix: preloadScriptSource.scriptSource.slice(0, preloadOffset),
    wrapperSuffix: preloadScriptSource.scriptSource.slice(
      preloadOffset + preloadBytes.length,
    ),
  });
  const preloadState = await cdp.send('Runtime.evaluate', {
    contextId: isolatedContext.id,
    returnByValue: true,
    expression:
      "JSON.stringify({ harden: typeof harden, object: Object.isFrozen(Object.prototype), array: Object.isFrozen(Array.prototype), fn: Object.isFrozen(Function.prototype), tamper: Reflect.set(Object.prototype, '__preloadSmokeMutation', true) })",
  });
  assert.equal(preloadState.exceptionDetails, undefined);
  const preloadSecurity = JSON.parse(preloadState.result.value);
  assert.deepEqual(preloadSecurity, {
    harden: 'function',
    object: true,
    array: true,
    fn: true,
    tamper: false,
  });
  record('preload-security', {
    contextId: isolatedContext.id,
    ...preloadSecurity,
  });
  checkErrors();
  const isolation = await app.evaluate(({ app: electronApp }) => ({
    userData: electronApp.getPath('userData'),
    sessionData: electronApp.getPath('sessionData'),
  }));
  assert.equal(isolation.userData, profile);
  assert.equal(isolation.sessionData, path.join(output, 'session'));
  record('isolation', isolation);
  const security = await page.evaluate(async () => ({
    lockdownType: typeof globalThis.lockdown,
    hardenType: typeof globalThis.harden,
    compartmentType: typeof globalThis.Compartment,
    objectFrozen: Object.isFrozen(Object.prototype),
    arrayFrozen: Object.isFrozen(Array.prototype),
    functionFrozen: Object.isFrozen(Function.prototype),
    prototypeMutable: Reflect.set(
      Object.prototype,
      '__desktopSmokePolluted',
      true,
    ),
    promiseResult: await Promise.resolve(7).then((value) => value + 1),
    timerResult: await new Promise((resolve) =>
      setTimeout(() => resolve('ready'), 1),
    ),
    settled: await Promise.allSettled([
      Promise.resolve('fulfilled'),
      // oxlint-disable-next-line prefer-promise-reject-errors -- Exercise a handled non-Error rejection value.
      Promise.reject('rejected'),
    ]),
    reversed: [1, 2, 3].toReversed(),
    symbolMetadata: typeof Symbol.metadata,
  }));
  record('security', security);
  // Electron's public preferences omit nodeIntegrationInWorker. Observe a real
  // child worker instead; it is a separate, unprotected browser realm.
  const workerState = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const url = URL.createObjectURL(
          new Blob(
            [
              'postMessage({ process: typeof process, require: typeof require })',
            ],
            { type: 'text/javascript' },
          ),
        );
        const worker = new Worker(url);
        URL.revokeObjectURL(url);
        const timer = setTimeout(() => {
          worker.terminate();
          resolve({ timeout: true });
        }, 5000);
        worker.onmessage = (event) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(event.data);
        };
        worker.onerror = (event) => {
          clearTimeout(timer);
          worker.terminate();
          resolve({ error: event.message });
        };
      }),
  );
  assert.deepEqual(workerState, { process: 'undefined', require: 'undefined' });
  record('worker-node-isolation', workerState);
  assert.equal(security.lockdownType, 'function');
  assert.equal(security.hardenType, 'function');
  assert.equal(security.compartmentType, 'function');
  assert.equal(
    security.objectFrozen && security.arrayFrozen && security.functionFrozen,
    true,
  );
  assert.equal(security.prototypeMutable, false);
  assert.equal(security.promiseResult, 8);
  assert.equal(security.timerResult, 'ready');
  assert.deepEqual(security.settled, [
    { status: 'fulfilled', value: 'fulfilled' },
    { status: 'rejected', reason: 'rejected' },
  ]);
  assert.deepEqual(security.reversed, [3, 2, 1]);
  assert.equal(security.symbolMetadata, 'symbol');
  const body = await page.locator('body').innerText();
  const testIds = await page
    .locator('[data-testid]')
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute('data-testid'))),
    ]);
  fs.writeFileSync(
    path.join(output, 'startup-ui.json'),
    JSON.stringify({ url: page.url(), body, testIds }, null, 2),
  );
  await page.screenshot({ path: path.join(output, 'startup.png') });
  const closeOnboarding = page.getByTestId('onboarding-layout-header-back-btn');
  await closeOnboarding.waitFor({ state: 'visible', timeout: 15_000 });
  await closeOnboarding.click();
  await page
    .getByTestId('onboarding-get-started-page')
    .waitFor({ state: 'hidden', timeout: 15_000 });
  await page.getByTestId('more-action-desktop').click();
  const preferences = page.getByText('Preferences', { exact: true });
  await preferences.waitFor({ state: 'visible', timeout: 15_000 });
  await page.screenshot({ path: path.join(output, 'more-menu.png') });
  const settingsId = 'more-action-desktop / Preferences';
  await preferences.click();
  // More opens SettingListSubModal, whose real category content has no setting-page container.
  await page
    .getByText('Preferences', { exact: true })
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .getByTestId('setting-language')
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .getByTestId('setting-currency')
    .waitFor({ state: 'visible', timeout: 30_000 });
  assert.match(
    await page.getByTestId('setting-language').innerText(),
    /Language/,
  );
  assert.match(
    await page.getByTestId('setting-currency').innerText(),
    /Default currency[\s\S]*USD/,
  );
  await settleAssets();
  await Promise.allSettled(consoleDiagnostics);
  checkErrors();
  record('lazy-route', {
    testId: settingsId,
    url: page.url(),
    body: (await page.locator('body').innerText()).slice(0, 12_000),
  });
  // Navigator.tsx renders the Online footer only in Web DApp mode. Desktop
  // must instead demonstrate its real application health request and no alert.
  const healthDeadline = Date.now() + 30_000;
  let healthResponses = [];
  while (!healthResponses.length) {
    const nativeEvents = fs
      .readFileSync(path.join(output, 'main-events.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    healthResponses = [...events, ...nativeEvents].filter(
      (event) =>
        event.kind === 'application-health-response' && event.status === 200,
    );
    assert.ok(
      Date.now() < healthDeadline,
      'The application must complete a real health request with status 200',
    );
    if (!healthResponses.length)
      await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const networkBody = await page.locator('body').innerText();
  assert.doesNotMatch(networkBody, /(?:^|\n)Offline(?:\n|$)|You are offline/);
  record('application-network-state', {
    healthResponses,
    offlineAlert: false,
    onlineFooterExpected: false,
    source: 'Navigator.tsx:226 restricts Footer to isWebDappMode',
    evidence: values['mock-health']
      ? 'Real application request reaches Chromium with an explicit synthetic health response'
      : 'Real application health request; no synthetic fetch or network interception',
    body: networkBody.slice(0, 12_000),
  });
  await page.screenshot({ path: path.join(output, 'settings.png') });
  checkErrors();
  record('result', { status: 'passed' });
}

async function main() {
  let failure;
  try {
    await withTimeout(run(), 120_000, 'Desktop application smoke');
  } catch (error) {
    failure = error;
    record('result', {
      status: 'failed',
      message: error.message,
      stack: error.stack,
    });
    if (page) {
      try {
        checkErrors();
      } catch {
        /* The full diagnostics remain in error-review.json. */
      }
      try {
        const ui = await withTimeout(
          page.evaluate(() =>
            [...document.querySelectorAll('[data-testid^="onboarding-"]')].map(
              (element) => ({
                id: element.getAttribute('data-testid'),
                text: element.textContent?.slice(0, 200),
                visible: element.checkVisibility({
                  checkOpacity: true,
                  checkVisibilityCSS: true,
                }),
                display: getComputedStyle(element).display,
                parent: element.parentElement?.getAttribute('data-testid'),
              }),
            ),
          ),
          2000,
          'failure UI diagnostics',
        );
        fs.writeFileSync(
          path.join(output, 'failure-ui.json'),
          JSON.stringify(ui, null, 2),
        );
        await withTimeout(
          page.screenshot({ path: path.join(output, 'failure.png') }),
          2000,
          'failure screenshot',
        );
      } catch (screenshotError) {
        record('screenshot-error', { message: String(screenshotError) });
      }
    }
  } finally {
    try {
      if (app) await withTimeout(app.close(), 10_000, 'own Electron cleanup');
    } catch (error) {
      failure ||= error;
      record('cleanup-error', { message: error.message, stack: error.stack });
      app?.process().kill('SIGKILL');
    }
    fs.writeFileSync(
      path.join(output, 'report.json'),
      JSON.stringify(
        {
          status: failure ? 'failed' : 'passed',
          output,
          node: process.version,
          events,
          exceptions,
          unhandledRejections,
          consoleErrors,
          failedAssets,
          externalFailures: [...externalFailures],
        },
        null,
        2,
      ),
    );
  }
  if (failure)
    throw new LavaMoatError('Protected Desktop smoke failed', {
      cause: failure,
    });
  process.stdout.write(`Protected Desktop smoke passed. Evidence: ${output}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
