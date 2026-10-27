#!/usr/bin/env node

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { unzipSync } = require('fflate');
const { chromium } = require('playwright-core');

const url = process.env.WEB_E2E_RENDERER_URL || 'http://127.0.0.1:3217';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-web-logs-'));
const marker = `web-log-${Date.now()}`;
const artifacts = path.resolve(__dirname, '../../../.tmp/web-log-e2e');
fs.mkdirSync(artifacts, { recursive: true });

async function launch(fallback = false) {
  const context = await chromium.launchPersistentContext(
    path.join(profile, fallback ? 'fallback' : 'buckets'),
    {
      executablePath: process.env.WEB_E2E_BROWSER_EXECUTABLE,
      headless: true,
      viewport: { width: 1280, height: 900 },
    },
  );
  context.setDefaultTimeout(45_000);
  await context.route('**/wallet/v1/client/log**', (route) => route.abort());
  if (fallback) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'storageBuckets', { value: undefined });
    });
  }
  return context;
}

async function openPage(context) {
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`[web-log] ${error.message}`));
  await page.goto(url);
  await page.waitForFunction(() =>
    Boolean(globalThis.$$appGlobals?.$backgroundApiProxy),
  );
  return page;
}

async function append(page, prefix, count, bytes = 64) {
  await page.evaluate(
    async ({ prefix: value, count: total, bytes: length }) => {
      const logger = globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger;
      for (let start = 0; start < total; start += 64) {
        await Promise.all(
          Array.from({ length: Math.min(64, total - start) }, (_, i) =>
            logger.addMsg(
              `${`${value}-${start + i}`.padEnd(length - 2, 'x')}\r\n`,
            ),
          ),
        );
      }
    },
    { prefix, count, bytes },
  );
}

function unzip(bytes) {
  const files = unzipSync(bytes);
  assert.deepEqual(Object.keys(files), ['OneKeyLogs.txt']);
  return Buffer.from(files['OneKeyLogs.txt']);
}

async function read(page, scope = 'recent') {
  const parts = await page.evaluate(async (value) => {
    const logger = globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger;
    const snapshot = await logger.beginLogExport({ scope: value });
    const chunks = [];
    let offset = 0;
    try {
      while (offset < snapshot.sizeBytes) {
        const chunk = await logger.readLogExportPage({
          id: snapshot.id,
          offset,
        });
        chunks.push(chunk.data);
        offset = chunk.nextOffset;
      }
    } finally {
      await logger.closeLogExport({ id: snapshot.id });
    }
    return chunks;
  }, scope);
  return unzip(Buffer.concat(parts.map((part) => Buffer.from(part, 'base64'))));
}

async function download(page, scope) {
  await page.getByTestId('setting-export-diagnostic-logs').click();
  const radio = page.getByTestId('log-export-scope-recent').getByRole('radio');
  assert.equal(await radio.getAttribute('aria-checked'), 'true');
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
  await page.screenshot({ path: path.join(artifacts, `${scope}.png`) });
  await page.evaluate(() => {
    const state = { frames: 0, timer: 0 };
    const tick = () => {
      state.frames += 1;
      state.timer = requestAnimationFrame(tick);
    };
    globalThis.$$logFrames = state;
    tick();
  });
  const ready = page.waitForEvent('download');
  await page.getByText(/manually export|manual export/i).click();
  const result = await ready;
  assert.ok(result.suggestedFilename().endsWith('.zip'));
  const raw = unzip(fs.readFileSync(await result.path()));
  const frames = await page.evaluate(() => {
    const state = globalThis.$$logFrames;
    cancelAnimationFrame(state.timer);
    delete globalThis.$$logFrames;
    return state.frames;
  });
  assert.ok(frames > 2, 'Web UI must continue rendering during export');
  await page.getByTestId('log-export-scope').waitFor({ state: 'detached' });
  return raw;
}

async function verifyFallback(page) {
  await page.evaluate(() => {
    const logger = globalThis.$$appGlobals.$$backgroundApi.serviceLogger;
    const begin = logger.beginLogExport;
    const token = logger.requestUploadToken;
    const state = { requests: [], collections: 0 };
    globalThis.$$logUploadTest = state;
    logger.beginLogExport = function (...args) {
      state.collections += 1;
      return begin.apply(this, args);
    };
    logger.requestUploadToken = async (payload) => {
      state.requests.push(payload);
      throw new Error('Simulated upload unavailable');
    };
    state.restore = () => {
      logger.beginLogExport = begin;
      logger.requestUploadToken = token;
    };
  });
  try {
    await page.getByTestId('setting-export-diagnostic-logs').click();
    const ready = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const zip = fs.readFileSync(await (await ready).path());
    const state = await page.evaluate(() => {
      const { requests, collections } = globalThis.$$logUploadTest;
      return { requests, collections };
    });
    assert.equal(state.collections, 1);
    assert.equal(state.requests.length, 4);
    for (const request of state.requests) {
      assert.equal(request.sizeBytes, zip.length);
      assert.equal(
        request.sha256,
        createHash('sha256').update(zip).digest('hex'),
      );
    }
    assert.ok(unzip(zip).length <= 10 * 1024 * 1024);
  } finally {
    await page.evaluate(() => {
      globalThis.$$logUploadTest.restore();
      delete globalThis.$$logUploadTest;
    });
  }
}

async function run() {
  let context;
  try {
    context = await launch();
    let first = await openPage(context);
    const second = await openPage(context);
    await Promise.all([
      append(first, `${marker}-a`, 1500),
      append(second, `${marker}-b`, 1500),
    ]);
    const expected = (await read(first))
      .toString()
      .split('\r\n')
      .filter((line) => line.startsWith(marker));
    assert.equal(expected.length, 3000);
    assert.equal(new Set(expected).size, 3000);
    await first.reload();
    await first.waitForFunction(() =>
      Boolean(globalThis.$$appGlobals?.$backgroundApiProxy),
    );
    assert.deepEqual(
      (await read(first))
        .toString()
        .split('\r\n')
        .filter((line) => line.startsWith(marker)),
      expected,
    );
    await context.close();
    context = await launch();
    first = await openPage(context);
    assert.deepEqual(
      (await read(first))
        .toString()
        .split('\r\n')
        .filter((line) => line.startsWith(marker)),
      expected,
    );
    console.log(
      '[web-log] >1000 records, concurrent tabs, reload and browser restart: PASS',
    );

    await append(first, `${marker}-large`, 7000, 1800);
    await first.waitForFunction(() =>
      Boolean(globalThis.$$appGlobals.$rootAppNavigation),
    );
    await first.evaluate(() =>
      globalThis.$$appGlobals.$rootAppNavigation.pushModal('SettingModal', {
        screen: 'SettingListModal',
        params: { screen: 'About' },
      }),
    );
    const recent = await download(first, 'recent');
    assert.ok(recent.length <= 10 * 1024 * 1024);
    assert.ok(!recent.includes(Buffer.from(expected[0])));
    assert.ok(recent.includes(Buffer.from(`${marker}-large-6999`)));
    const full = await download(first, 'full');
    assert.ok(
      full.length > 10 * 1024 * 1024 && full.length <= 40 * 1024 * 1024,
    );
    assert.ok(full.includes(Buffer.from(expected[0])));
    await verifyFallback(first);
    console.log(
      '[web-log] recent/full ZIP downloads and upload retry/fallback hash: PASS',
    );

    const sibling = await openPage(context);
    const session = await sibling.evaluate(() =>
      globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger.beginLogExport(),
    );
    const delayed = await context.newPage();
    await delayed.addInitScript(() => {
      // Hold the real Web idle gate while a pre-reset log waits for the background.
      globalThis.requestIdleCallback = () => 1;
      globalThis.cancelIdleCallback = () => {};
      const channel = new BroadcastChannel('onekey-diagnostic-logs-reset');
      channel.onmessage = () => {
        globalThis.$$observedLogReset = true;
        channel.close();
      };
    });
    await delayed.goto(`${url}/log-reset-e2e`);
    await delayed.waitForFunction(() =>
      Boolean(globalThis.$$appGlobals?.$backgroundApiProxy),
    );
    await delayed.evaluate((value) => {
      if (globalThis.$$appGlobals.$$backgroundApi)
        throw new Error('Background must still be deferred');
      globalThis.$$delayedLogWrite =
        globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger.addMsg(
          `${value}-delayed-stale\r\n`,
        );
    }, marker);
    await first.evaluate(() =>
      globalThis.$$appGlobals.$$backgroundApi.serviceLogger.stopPersistenceForReset(),
    );
    await delayed.waitForFunction(() => globalThis.$$observedLogReset);
    await delayed.evaluate(async () => {
      globalThis.dispatchEvent(new Event('pointerdown'));
      await globalThis.$$delayedLogWrite;
      if (!globalThis.$$appGlobals.$$backgroundApi.serviceLogger.resettingLogs)
        throw new Error('Deferred background missed the reset');
    });
    await sibling.waitForFunction(
      () => globalThis.$$appGlobals.$$backgroundApi.serviceLogger.resettingLogs,
    );
    await assert.rejects(
      sibling.evaluate(
        (id) =>
          globalThis.$$appGlobals.$backgroundApiProxy.serviceLogger.readLogExportPage(
            { id, offset: 0 },
          ),
        session.id,
      ),
    );
    await append(sibling, `${marker}-stale`, 1);
    const databases = await first.evaluate(async () => {
      const bucket = await navigator.storageBuckets.open(
        'diagnostic-logs_onekey-bucket',
      );
      return bucket.indexedDB.databases();
    });
    assert.ok(
      !databases.some((database) => database.name === 'OneKeyDiagnosticLogs'),
    );
    await first.reload();
    await first.waitForFunction(() =>
      Boolean(globalThis.$$appGlobals?.$backgroundApiProxy),
    );
    await append(first, 'fresh-after-reset', 1);
    const afterReset = await read(first);
    assert.ok(!afterReset.includes(Buffer.from(marker)));
    assert.ok(afterReset.includes(Buffer.from('fresh-after-reset')));
    console.log(
      '[web-log] reset cancels sibling export and stale writes, including deferred background: PASS',
    );
    await context.close();

    context = await launch(true);
    first = await openPage(context);
    await append(first, marker, 1500);
    await first.reload();
    await first.waitForFunction(() =>
      Boolean(globalThis.$$appGlobals?.$backgroundApiProxy),
    );
    assert.equal(
      (await read(first))
        .toString()
        .split('\r\n')
        .filter((line) => line.startsWith(marker)).length,
      1500,
    );
    assert.ok(
      (await first.evaluate(() => indexedDB.databases())).some(
        (database) => database.name === 'OneKeyDiagnosticLogs',
      ),
    );
    console.log('[web-log] IndexedDB fallback without Storage Buckets: PASS');
  } finally {
    await context?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
