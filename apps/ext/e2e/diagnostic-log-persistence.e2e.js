#!/usr/bin/env node

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { unzipSync } = require('fflate');
const { chromium } = require('playwright-core');

const extensionPath = path.resolve(
  process.env.EXT_E2E_EXTENSION_PATH ||
    path.join(__dirname, '../build/chrome_v3'),
);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-log-e2e-'));
const marker = `diagnostic-e2e-${Date.now()}`;
const timeout = 120_000;

async function step(name, action) {
  console.log(`[log-e2e] ${name}`);
  let timer;
  try {
    return await Promise.race([
      action(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out: ${name}`)),
          30_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function launch() {
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.EXT_E2E_BROWSER_EXECUTABLE,
    headless: true,
    // Same E2E_MODE/CSP setup as local-secret-envelope.e2e.js; production is unchanged.
    bypassCSP: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      `--load-extension=${extensionPath}`,
    ],
    ignoreDefaultArgs: [
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--no-service-autorun',
    ],
  });
  // Unpacked extensions need Developer mode to remain enabled after runtime.reload().
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions');
  await extensionsPage.evaluate(() =>
    chrome.developerPrivate.updateProfileConfiguration({
      inDeveloperMode: true,
    }),
  );
  await extensionsPage.close();
  return context;
}

async function getWorker(context) {
  return (
    context.serviceWorkers()[0] ||
    context.waitForEvent('serviceworker', { timeout })
  );
}

async function openPopup(context, extensionId) {
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  page.on('pageerror', (error) => console.error(`[popup] ${error.message}`));
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      await page.goto(`chrome-extension://${extensionId}/ui-popup.html`);
      break;
    } catch (error) {
      if (!String(error).includes('ERR_BLOCKED_BY_CLIENT')) throw error;
      if (Date.now() >= deadline) {
        throw error;
      }
      // runtime.reload briefly removes the extension before registering it again.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  await page.waitForFunction(() =>
    Boolean(globalThis.$$appGlobals?.$backgroundApiProxy),
  );
  return page;
}

async function append(page, message) {
  await page.evaluate(
    async (value) =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger.addMsg(
        `${value}\r\n`,
      ),
    message,
  );
}

function unzipLogs(bytes) {
  const files = unzipSync(bytes);
  assert.deepEqual(Object.keys(files), ['OneKeyLogs.txt']);
  return Buffer.from(files['OneKeyLogs.txt']);
}

async function readMarkers(page) {
  const parts = await page.evaluate(async () => {
    const service = globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger;
    const snapshot = await service.beginLogExport();
    const chunks = [];
    let offset = 0;
    try {
      while (offset < snapshot.sizeBytes) {
        const result = await service.readLogExportPage({
          id: snapshot.id,
          offset,
        });
        chunks.push(result.data);
        offset = result.nextOffset;
      }
    } finally {
      await service.closeLogExport({ id: snapshot.id });
    }
    return chunks;
  });
  return unzipLogs(
    Buffer.concat(parts.map((part) => Buffer.from(part, 'base64'))),
  )
    .toString('utf8')
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(marker));
}

async function downloadArchive(page, scope = 'recent') {
  console.log(`[log-e2e] download ${scope} ZIP`);
  await page.getByTestId('setting-export-diagnostic-logs').click();
  const recent = page.getByTestId('log-export-scope-recent').getByRole('radio');
  assert.equal(await recent.getAttribute('aria-checked'), 'true');
  if (scope === 'full') {
    const full = page.getByTestId('log-export-scope-full').getByRole('radio');
    await full.click();
    assert.equal(await full.getAttribute('aria-checked'), 'true');
  }
  await page.waitForFunction(() => {
    let element = document.querySelector('[data-testid="log-export-scope"]');
    if (!element) return false;
    while (element) {
      if (Number(getComputedStyle(element).opacity) < 0.99) return false;
      element = element.parentElement;
    }
    return true;
  });
  await page.screenshot({
    path: path.resolve(__dirname, `../../../.tmp/ext-log-export-${scope}.png`),
  });
  await page.evaluate(() => {
    const state = { frames: 0, maxGapMs: 0, last: performance.now(), timer: 0 };
    const tick = (now) => {
      state.frames += 1;
      state.maxGapMs = Math.max(state.maxGapMs, now - state.last);
      state.last = now;
      state.timer = requestAnimationFrame(tick);
    };
    state.timer = requestAnimationFrame(tick);
    globalThis.$$logExportFrames = state;
  });
  const start = Date.now();
  const ready = page.waitForEvent('download');
  await page.getByText(/manually export|manual export/i).click();
  const download = await ready;
  assert.ok(download.suggestedFilename().endsWith('.zip'));
  const zip = fs.readFileSync(await download.path());
  const responsiveness = await page.evaluate(() => {
    const state = globalThis.$$logExportFrames;
    cancelAnimationFrame(state.timer);
    delete globalThis.$$logExportFrames;
    return { frames: state.frames, maxGapMs: state.maxGapMs };
  });
  assert.ok(responsiveness.frames > 2, 'UI must keep rendering during export');
  await page.getByTestId('log-export-scope').waitFor({ state: 'detached' });
  console.log(`[log-e2e] downloaded ${scope}: ${zip.length} ZIP bytes`);
  return {
    zip,
    raw: unzipLogs(zip),
    durationMs: Date.now() - start,
    responsiveness,
  };
}

async function verifyUploadFallback(page) {
  const worker = await getWorker(page.context());
  await worker.evaluate(() => {
    const service = globalThis.$$appGlobals.$$backgroundApi.serviceLogger;
    const token = service.INTERNAL_requestUploadToken;
    const begin = service.INTERNAL_beginLogExport;
    const state = { requests: [], collections: 0 };
    globalThis.$$logExportTest = state;
    service.INTERNAL_requestUploadToken = async (payload) => {
      state.requests.push(payload);
      throw new Error('E2E simulated upload unavailable');
    };
    service.INTERNAL_beginLogExport = function (...args) {
      state.collections += 1;
      return begin.apply(this, args);
    };
    state.restore = () => {
      service.INTERNAL_requestUploadToken = token;
      service.INTERNAL_beginLogExport = begin;
    };
  });
  try {
    await page.getByTestId('setting-export-diagnostic-logs').click();
    const ready = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const download = await ready;
    const zip = fs.readFileSync(await download.path());
    assert.ok(unzipLogs(zip).byteLength <= 10 * 1024 * 1024);
    const result = await worker.evaluate(() => {
      const { requests, collections } = globalThis.$$logExportTest;
      return { requests, collections };
    });
    assert.equal(
      result.collections,
      1,
      'retry and fallback must reuse one snapshot',
    );
    assert.equal(result.requests.length, 4);
    for (const request of result.requests) {
      assert.equal(request.sizeBytes, zip.byteLength);
      assert.equal(
        request.sha256,
        createHash('sha256').update(zip).digest('hex'),
      );
    }
    console.log(
      '[log-e2e] upload retries and fallback share the same ZIP/hash: PASS',
    );
  } finally {
    await worker.evaluate(() => {
      globalThis.$$logExportTest.restore();
      delete globalThis.$$logExportTest;
    });
  }
}

async function benchmark(page) {
  const measureRead = () =>
    page.evaluate(async () => {
      const service = globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger;
      const start = performance.now();
      const snapshot = await service.beginLogExport();
      const prepareArchiveMs = performance.now() - start;
      const transferStart = performance.now();
      let offset = 0;
      let pages = 0;
      try {
        while (offset < snapshot.sizeBytes) {
          const result = await service.readLogExportPage({
            id: snapshot.id,
            offset,
          });
          const decoded = atob(result.data);
          if (result.nextOffset !== offset + decoded.length) {
            throw new Error('Unexpected export page length');
          }
          offset = result.nextOffset;
          pages += 1;
        }
      } finally {
        await service.closeLogExport({ id: snapshot.id });
      }
      return {
        prepareArchiveMs,
        transferMs: performance.now() - transferStart,
        sizeBytes: offset,
        pages,
      };
    });
  console.log('[log-perf] measure sequential durable UI RPC latency');
  const sequential = await page.evaluate(async () => {
    const service = globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger;
    const samples = [];
    for (let i = 0; i < 1000; i += 1) {
      const start = performance.now();
      await service.addMsg(`latency-${i}\r\n`);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return {
      samples: samples.length,
      p50Ms: samples[500],
      p95Ms: samples[950],
      totalMs: samples.reduce((sum, value) => sum + value, 0),
    };
  });
  console.log(`[log-perf] sequential ${JSON.stringify(sequential)}`);
  console.log(
    '[log-perf] write 120000 messages of 512 bytes through UI RPC, 128 concurrent',
  );
  const bulk = await page.evaluate(async () => {
    const service = globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger;
    const count = 120_000;
    const start = performance.now();
    for (let i = 0; i < count; i += 128) {
      await Promise.all(
        Array.from({ length: Math.min(128, count - i) }, (_, j) =>
          service.addMsg(
            `${`perf-${String(i + j).padStart(6, '0')}:`.padEnd(510, 'x')}\r\n`,
          ),
        ),
      );
    }
    const durationMs = performance.now() - start;
    return {
      count,
      bytesPerMessage: 512,
      concurrency: 128,
      durationMs,
      logsPerSecond: (count * 1000) / durationMs,
    };
  });
  console.log(`[log-perf] bulk ${JSON.stringify(bulk)}`);
  const state = await page.evaluate(async () => {
    const bucket = await navigator.storageBuckets.open(
      'diagnostic-logs_onekey-bucket',
    );
    const database = await new Promise((resolve, reject) => {
      const request = bucket.indexedDB.open('OneKeyDiagnosticLogs');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const meta = await new Promise((resolve) => {
      const request = database
        .transaction('meta')
        .objectStore('meta')
        .get('state');
      request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return meta;
  });
  assert.ok(state.bytes <= 40 * 1024 * 1024);
  assert.ok(
    state.count > 70_000,
    'capacity must retain substantially more than 1000 logs',
  );
  const read = await measureRead();
  const recentExport = await downloadArchive(page);
  assert.ok(recentExport.raw.length <= 10 * 1024 * 1024);
  assert.ok(recentExport.raw.includes(Buffer.from('perf-119999:')));
  assert.ok(!recentExport.raw.includes(Buffer.from('perf-050000:')));
  const recentLines = recentExport.raw
    .toString('utf8')
    .split('\r\n')
    .filter((line) => line.startsWith('perf-'));
  assert.ok(recentLines.length > 20_000);
  recentLines.forEach((line, index) => {
    assert.equal(line.length, 510);
    assert.ok(
      line.startsWith(
        `perf-${String(120_000 - recentLines.length + index).padStart(6, '0')}:`,
      ),
    );
  });
  const fullExport = await downloadArchive(page, 'full');
  assert.ok(fullExport.raw.length > 30 * 1024 * 1024);
  assert.ok(fullExport.raw.length <= 40 * 1024 * 1024);
  assert.ok(fullExport.raw.includes(Buffer.from('perf-050000:')));
  assert.ok(fullExport.raw.includes(Buffer.from('perf-119999:')));
  // Worst-case read fixture: many tiny committed chunks instead of merged batches.
  // Seeding is excluded from throughput results; reads use the production export path.
  const smallChunkFixture = await page.evaluate(async () => {
    const bucket = await navigator.storageBuckets.open(
      'diagnostic-logs_onekey-bucket',
    );
    const database = await new Promise((resolve, reject) => {
      const request = bucket.indexedDB.open('OneKeyDiagnosticLogs');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['chunks', 'meta'], 'readwrite');
    const chunks = transaction.objectStore('chunks');
    chunks.clear();
    const count = 160_000;
    for (let i = 0; i < count; i += 1) {
      const text = `${`small-${String(i).padStart(6, '0')}:`.padEnd(126, 'x')}\r\n`;
      chunks.put({ id: i + 1, text, bytes: 256, count: 1 });
    }
    transaction
      .objectStore('meta')
      .put({ nextId: count + 1, bytes: count * 256, count }, 'state');
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return {
      chunks: count,
      contentBytes: count * 128,
      accountedBytes: count * 256,
    };
  });
  const smallRead = await measureRead();
  const smallExport = await downloadArchive(page);
  assert.ok(smallExport.raw.length <= 10 * 1024 * 1024);
  assert.ok(!smallExport.raw.includes(Buffer.from('small-000000:')));
  assert.ok(smallExport.raw.includes(Buffer.from('small-159999:')));
  await verifyUploadFallback(page);
  const report = {
    browser: await page.context().browser().version(),
    platform: `${os.platform()} ${os.arch()}`,
    sequential,
    bulk,
    retained: state,
    read,
    recentExport: {
      rawBytes: recentExport.raw.length,
      zipBytes: recentExport.zip.length,
      durationMs: recentExport.durationMs,
      responsiveness: recentExport.responsiveness,
    },
    fullExport: {
      rawBytes: fullExport.raw.length,
      zipBytes: fullExport.zip.length,
      durationMs: fullExport.durationMs,
      responsiveness: fullExport.responsiveness,
    },
    smallChunks: {
      ...smallChunkFixture,
      read: smallRead,
      rawBytes: smallExport.raw.length,
      zipBytes: smallExport.zip.length,
      exportMs: smallExport.durationMs,
    },
  };
  const directory = path.resolve(
    __dirname,
    '../../../.tmp/ext-log-performance',
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'result.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(`[log-perf] result ${JSON.stringify(report)}`);
}

async function run() {
  let context;
  try {
    context = await launch();
    console.log('[log-e2e] browser started');
    const worker = await getWorker(context);
    console.log('[log-e2e] worker found');
    const extensionId = new URL(worker.url()).host;
    let page = await openPopup(context, extensionId);
    console.log('[log-e2e] popup ready');
    const expected = [`${marker}-ui-before`, `${marker}-bg-before`];
    await append(page, expected[0]);
    console.log('[log-e2e] UI write committed');
    await worker.evaluate(
      async (message) =>
        globalThis.$$appGlobals.$$backgroundApi.serviceLogger.addMsg(
          `${message}\r\n`,
        ),
      expected[1],
    );
    assert.deepEqual(await readMarkers(page), expected);
    console.log('[log-e2e] UI/background history verified');

    // Stop the actual MV3 worker and prove its JS heap is recreated.
    const observer = await context.newPage();
    const cdp = await context.newCDPSession(observer);
    const versions = new Map();
    cdp.on('ServiceWorker.workerVersionUpdated', ({ versions: updates }) => {
      updates.forEach((version) => versions.set(version.versionId, version));
    });
    await step('observe worker lifecycle', () =>
      cdp.send('ServiceWorker.enable'),
    );
    await step('close popup', () => page.close());
    const version = [...versions.values()].find(
      (value) =>
        value.scriptURL === worker.url() && value.runningStatus === 'running',
    );
    assert.ok(version, 'MV3 worker version must be observable');
    const stopped = new Promise((resolve) => {
      cdp.on('ServiceWorker.workerVersionUpdated', ({ versions: updates }) => {
        if (
          updates.some(
            (value) =>
              value.versionId === version.versionId &&
              value.runningStatus === 'stopped',
          )
        )
          resolve();
      });
    });
    await step('stop MV3 worker', () =>
      cdp.send('ServiceWorker.stopWorker', {
        versionId: version.versionId,
      }),
    );
    await step('observe stopped worker', () => stopped);
    await step('start MV3 worker', () =>
      cdp.send('ServiceWorker.startWorker', {
        scopeURL: `chrome-extension://${extensionId}/`,
      }),
    );
    page = await openPopup(context, extensionId);
    // Chromium can reuse the target ID after stopping its execution context.
    // Playwright then retains a stale Worker handle, so use the verified stopped
    // state plus a fresh UI RPC to test the newly initialized background.
    assert.deepEqual(await readMarkers(page), expected);
    expected.push(`${marker}-after-worker-restart`);
    await append(page, expected.at(-1));
    console.log('[log-e2e] MV3 worker restart: PASS');

    await context.close();
    context = await launch();
    await getWorker(context);
    page = await openPopup(context, extensionId);
    assert.deepEqual(await readMarkers(page), expected);
    console.log('[log-e2e] browser restart, order, and no duplicates: PASS');

    const reloaded = page.waitForEvent('close', { timeout });
    await page.evaluate(() => {
      setTimeout(() => chrome.runtime.reload(), 0);
    });
    await reloaded;
    await page.close().catch(() => {});
    page = await openPopup(context, extensionId);
    assert.deepEqual(await readMarkers(page), expected);
    expected.push(`${marker}-after-extension-reload`);
    await append(page, expected.at(-1));
    console.log('[log-e2e] extension reload: PASS');

    await page.waitForFunction(() =>
      Boolean(globalThis.$$appGlobals.$rootAppNavigation),
    );
    await page.evaluate(() =>
      globalThis.$$appGlobals.$rootAppNavigation.pushModal('SettingModal', {
        screen: 'SettingListModal',
        params: { screen: 'About' },
      }),
    );
    const exportedArchive = await downloadArchive(page);
    const exported = exportedArchive.raw.toString('utf8');
    const exportedMarkers = exported
      .split(/\r?\n/u)
      .filter((line) => line.startsWith(marker));
    assert.deepEqual(exportedMarkers, expected);
    console.log(
      '[log-e2e] actual diagnostic file export includes restored history once: PASS',
    );

    const storageInfo = await page.evaluate(async () => {
      const names = await navigator.storageBuckets.keys();
      const bucket = await navigator.storageBuckets.open(
        'diagnostic-logs_onekey-bucket',
      );
      return {
        names,
        databases: await bucket.indexedDB.databases(),
        defaultDatabases: await indexedDB.databases(),
      };
    });
    assert.ok(storageInfo.names.includes('diagnostic-logs_onekey-bucket'));
    assert.ok(
      storageInfo.databases.some((db) => db.name === 'OneKeyDiagnosticLogs'),
    );
    assert.ok(
      !storageInfo.defaultDatabases.some(
        (db) => db.name === 'OneKeyDiagnosticLogs',
      ),
    );
    console.log('[log-e2e] independent diagnostic bucket and database: PASS');

    if (process.env.EXT_LOG_PERF === '1') await benchmark(page);
  } finally {
    await context?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
