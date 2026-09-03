#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone Node CLI, no shared package import */
/**
 * Natural (non-mutating) Desktop e2e harness for OK-61648.
 *
 * Goal: reproduce
 *   UnknownError: Failed to read large IndexedDB value
 * on simple_db_v5:localTokens or simple_db_v5:localHistory by driving the real
 * OneKey Desktop IndexedDB write path — NEVER by editing indexeddb.blob files.
 *
 * Modes:
 *   probe-threshold  Grow forged payload until WebStorage .../indexeddb.blob appears
 *   grow-restart     Write large value, clean restart, read back
 *   kill-mid-write   SIGKILL Electron during a large setRawData, then restart+read
 *   low-disk         Same writes against a tiny sparseimage mount (host disk untouched)
 *   self-heal-verify Fault-inject the Chromium unreadable-blob error on real
 *                    SimpleDB entities and assert default self-heal + rebuild
 *
 * Usage examples:
 *   node scenarios/idb-external-blob-corruption-desktop.mjs probe-threshold
 *   node scenarios/idb-external-blob-corruption-desktop.mjs kill-mid-write --entity localTokens --rounds 30
 *   node scenarios/idb-external-blob-corruption-desktop.mjs low-disk --vol-mb 256 --entity localHistory
 *   node scenarios/idb-external-blob-corruption-desktop.mjs self-heal-verify
 *
 * Env:
 *   DESKTOP_E2E_SKIP_BUILD_MAIN=1 / DESKTOP_E2E_SKIP_COPY_INJECT=1  reuse existing dist
 *   DESKTOP_E2E_PORT=3101                                          renderer port preference
 *   KEEP_PROFILE=1                                                 do not delete userData after run
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron } from 'playwright-core';

// Playwright CDP can emit late ProtocolErrors after SIGKILL; do not abort the matrix.
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  console.warn(`[idb-blob] unhandledRejection (ignored): ${msg}`);
});
process.on('uncaughtException', (error) => {
  const msg = error?.message || String(error);
  if (
    msg.includes('Cannot find context with specified id') ||
    msg.includes('Target closed') ||
    msg.includes('Protocol error')
  ) {
    console.warn(`[idb-blob] uncaughtException (ignored): ${msg}`);
    return;
  }
  console.error(`[idb-blob] uncaughtException: ${msg}`);
  process.exitCode = 1;
});

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const desktopDir = path.join(repoRoot, 'apps', 'desktop');
const mainPath = path.join(desktopDir, 'app', 'dist', 'app.js');
const artifactRoot = path.join(repoRoot, '.tmp', 'idb-blob-repro');

const TARGET_ERROR_FRAGMENT = 'Failed to read large IndexedDB value';
const ENTITY_KEYS = {
  localTokens: 'simple_db_v5:localTokens',
  localHistory: 'simple_db_v5:localHistory',
};

const COPY_INJECT_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_COPY_INJECT_TIMEOUT_MS) || 60_000;
const BUILD_MAIN_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_BUILD_MAIN_TIMEOUT_MS) || 120_000;
const RENDERER_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_RENDERER_TIMEOUT_MS) || 180_000;
const APP_TIMEOUT_MS = Number(process.env.DESKTOP_E2E_APP_TIMEOUT_MS) || 120_000;

const desktopE2EEnv = {
  DESKTOP_E2E_MODE: 'true',
  E2E_MODE: 'true',
};

function hhmmss() {
  return new Date().toTimeString().slice(0, 8);
}
function log(...args) {
  console.log(`[idb-blob ${hhmmss()}]`, ...args);
}

function parseArgs(argv) {
  const mode = argv[0] || 'kill-mid-write';
  const flags = {};
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { mode, flags };
}

function appendOutput(buf, chunk) {
  const next = buf + chunk.toString();
  return next.length > 80_000 ? next.slice(-80_000) : next;
}

function getRepoYarnCliPath() {
  const yarnRc = fs.readFileSync(path.join(repoRoot, '.yarnrc.yml'), 'utf8');
  const yarnPathMatch = /^yarnPath:\s*["']?([^"'\r\n]+)["']?\s*$/mu.exec(yarnRc);
  if (!yarnPathMatch) {
    throw new Error('Unable to resolve yarnPath from .yarnrc.yml');
  }
  return path.resolve(repoRoot, yarnPathMatch[1].trim());
}

function yarnInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: process.execPath,
      args: [getRepoYarnCliPath(), ...args],
    };
  }
  return { command: 'yarn', args };
}

function runYarn(args, { timeoutMs }) {
  const { command, args: yarnArgs } = yarnInvocation(args);
  log(`yarn ${args.join(' ')}`);
  const result = spawnSync(command, yarnArgs, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `yarn ${args.join(' ')} failed (status=${result.status})\n${
        result.stderr || result.stdout || ''
      }`,
    );
  }
}

async function findAvailablePort(preferred) {
  const tryListen = (port) =>
    new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(null));
      server.listen(port, '127.0.0.1', () => {
        const { port: p } = server.address();
        server.close(() => resolve(p));
      });
    });
  const hit = await tryListen(preferred);
  if (hit) return hit;
  return tryListen(0);
}

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForRenderer(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Renderer dev server exited early with code ${child.exitCode}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    if (await httpOk(url)) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for renderer at ${url}`);
}

async function startRenderer() {
  const preferredPort = Number(process.env.DESKTOP_E2E_PORT) || 3101;
  const port = await findAvailablePort(preferredPort);
  const rendererUrl = `http://localhost:${port}/`;
  log(`start renderer ${rendererUrl}`);

  const rspackPkg = require.resolve('@rspack/cli/package.json', {
    paths: [repoRoot],
  });
  const rspackCliPath = path.join(path.dirname(rspackPkg), 'bin', 'rspack.js');

  const child = spawn(process.execPath, [rspackCliPath, 'serve'], {
    cwd: desktopDir,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ...desktopE2EEnv,
      BROWSER: 'none',
      TRANSFORM_REGENERATOR_DISABLED: 'true',
      WEB_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (c) => {
    output = appendOutput(output, c);
    if (process.env.DESKTOP_E2E_VERBOSE) process.stdout.write(c);
  });
  child.stderr.on('data', (c) => {
    output = appendOutput(output, c);
    if (process.env.DESKTOP_E2E_VERBOSE) process.stderr.write(c);
  });

  try {
    await waitForRenderer(rendererUrl, child, RENDERER_TIMEOUT_MS);
  } catch (error) {
    await stopProcess(child);
    throw new Error(`${error.message}\n\nRenderer output tail:\n${output}`, {
      cause: error,
    });
  }
  return { child, rendererUrl };
}

async function stopProcess(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') child.kill();
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  if (child.exitCode === null) {
    try {
      if (process.platform === 'win32') child.kill('SIGKILL');
      else process.kill(-child.pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }
}

/** Host disk is never filled. Optional tiny APFS sparseimage for low-disk mode. */
function createSparseVolume({ volMb, runId }) {
  if (process.platform !== 'darwin') {
    throw new Error('low-disk sparseimage isolation is macOS-only');
  }
  const imgPath = path.join(artifactRoot, `${runId}.sparseimage`);
  const mountPoint = path.join(artifactRoot, `${runId}-mnt`);
  fs.mkdirSync(artifactRoot, { recursive: true });
  if (fs.existsSync(imgPath)) fs.rmSync(imgPath, { force: true });
  if (fs.existsSync(mountPoint)) {
    spawnSync('hdiutil', ['detach', mountPoint, '-force'], { encoding: 'utf8' });
    fs.rmSync(mountPoint, { recursive: true, force: true });
  }
  fs.mkdirSync(mountPoint, { recursive: true });

  const create = spawnSync(
    'hdiutil',
    [
      'create',
      '-size',
      `${volMb}m`,
      '-fs',
      'APFS',
      '-volname',
      `OKIDB${runId.slice(-6)}`,
      '-type',
      'SPARSE',
      imgPath,
    ],
    { encoding: 'utf8' },
  );
  if (create.status !== 0) {
    throw new Error(`hdiutil create failed:\n${create.stderr || create.stdout}`);
  }
  const attach = spawnSync(
    'hdiutil',
    ['attach', imgPath, '-mountpoint', mountPoint],
    { encoding: 'utf8' },
  );
  if (attach.status !== 0) {
    throw new Error(`hdiutil attach failed:\n${attach.stderr || attach.stdout}`);
  }
  const userDataDir = path.join(mountPoint, 'user-data');
  fs.mkdirSync(userDataDir, { recursive: true });
  log(`sparse volume ${volMb}MB mounted at ${mountPoint} (host disk untouched)`);
  return {
    imgPath,
    mountPoint,
    userDataDir,
    detach() {
      spawnSync('hdiutil', ['detach', mountPoint, '-force'], { encoding: 'utf8' });
      try {
        fs.rmSync(imgPath, { force: true });
      } catch {
        // ignore
      }
      try {
        fs.rmSync(mountPoint, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

function summarizeBlobs(userDataDir) {
  const roots = [
    path.join(userDataDir, 'WebStorage'),
    path.join(userDataDir, 'IndexedDB'),
  ];
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        const full = path.join(cur, ent.name);
        if (ent.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!full.includes(`${path.sep}indexeddb.blob${path.sep}`)) continue;
        try {
          const st = fs.statSync(full);
          files.push({ path: full, size: st.size });
        } catch {
          // Singleton* / ephemeral files can vanish between readdir and stat.
        }
      }
    }
  }
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  return {
    blobFileCount: files.length,
    blobTotalBytes: totalBytes,
    largestBlobBytes: files.reduce((m, f) => Math.max(m, f.size), 0),
  };
}

function volumeFreeBytes(dir) {
  const result = spawnSync('df', ['-k', dir], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const lines = result.stdout.trim().split('\n');
  const parts = lines[lines.length - 1].split(/\s+/);
  const availK = Number(parts[3]);
  return Number.isFinite(availK) ? availK * 1024 : null;
}

function resetBootFailCounter(userDataDir) {
  // SIGKILL before markBootSuccess trips Desktop's recovery.html after 3 fails.
  // Clear the counter so every harness relaunch still loads the real renderer.
  const storePath = path.join(userDataDir, 'OneKey.json');
  try {
    let raw = {};
    if (fs.existsSync(storePath)) {
      raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    }
    if (!raw || typeof raw !== 'object') raw = {};
    raw.consecutiveBootFailCount = 0;
    raw.bootFailAppVersion = '';
    fs.writeFileSync(storePath, `${JSON.stringify(raw, null, 2)}\n`);
    log(`reset boot-fail counter in ${storePath}`);
  } catch (error) {
    log(`resetBootFailCounter soft-fail: ${error?.message || error}`);
  }
}

async function launchDesktop({ userDataDir, rendererUrl }) {
  resetBootFailCounter(userDataDir);
  const app = await electron.launch({
    executablePath: electronBinary,
    args: [mainPath],
    cwd: desktopDir,
    env: {
      ...process.env,
      ...desktopE2EEnv,
      ELECTRON_IS_DEV: '1',
      DESKTOP_E2E_RENDERER_URL: rendererUrl,
      DESKTOP_E2E_USER_DATA_DIR: userDataDir,
    },
    timeout: APP_TIMEOUT_MS,
  });
  try {
    const page = await app.firstWindow({ timeout: 60_000 });
    // Always land on the renderer origin. Boot-recovery / DevTools windows are
    // common after SIGKILL; Storage Buckets IndexedDB is origin-scoped, so we
    // must be on http://localhost:* — not file://recovery.html.
    if (!page.url().startsWith(rendererUrl)) {
      log(`goto renderer from ${page.url()}`);
      await page.goto(rendererUrl, { waitUntil: 'commit', timeout: 60_000 });
    }
    await waitForIdbReady(page);
    const apiMode = await page.evaluate(() => {
      const proxy = globalThis.$$appGlobals?.$backgroundApiProxy;
      return proxy?.simpleDb?.localTokens && proxy?.simpleDb?.localHistory
        ? 'simpleDb'
        : 'idbDirect';
    });
    log(`desktop ready apiMode=${apiMode} href=${page.url()}`);
    return { app, page, apiMode };
  } catch (error) {
    await app.close().catch(() => {});
    throw error;
  }
}

async function waitForIdbReady(page) {
  const deadline = Date.now() + Math.min(APP_TIMEOUT_MS, 60_000);
  let lastDiag = null;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const diag = await page
      .evaluate(async () => {
        try {
          if (!navigator.storageBuckets?.open) {
            return { ok: false, reason: 'no-storageBuckets' };
          }
          const bucket = await navigator.storageBuckets.open(
            'simple-db_onekey-bucket',
          );
          const db = await new Promise((resolve, reject) => {
            const req = bucket.indexedDB.open('OneKeySimpleDB');
            req.onupgradeneeded = () => {
              if (!req.result.objectStoreNames.contains('keyvaluepairs')) {
                req.result.createObjectStore('keyvaluepairs');
              }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          db.close();
          return {
            ok: true,
            hasSimpleDb: Boolean(
              globalThis.$$appGlobals?.$backgroundApiProxy?.simpleDb,
            ),
          };
        } catch (error) {
          return {
            ok: false,
            reason: `${error?.name || 'Error'}: ${error?.message || error}`,
          };
        }
      })
      .catch((error) => ({
        ok: false,
        reason: String(error?.message || error),
      }));
    lastDiag = diag;
    if (diag?.ok) return;
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(300);
  }
  throw new Error(
    `Timed out waiting for Desktop Storage Bucket IndexedDB: ${JSON.stringify(
      lastDiag,
    )}`,
  );
}

/**
 * Write forged localTokens/localHistory through the real Desktop IndexedDB
 * (Storage Bucket simple-db_onekey-bucket / OneKeySimpleDB). Prefer simpleDb
 * entity APIs when the full UI boot succeeds; otherwise use the same IDB keys
 * SimpleDB would use. Never touches indexeddb.blob files from Node.
 */
async function writeForgedEntity(page, { entity, targetBytes, tag }) {
  return page.evaluate(
    async ({ entityName, bytes, tag: writeTag, storageKey }) => {
      const startedAt = Date.now();
      const pad = 'X'.repeat(Math.max(0, bytes));
      const proxy = globalThis.$$appGlobals?.$backgroundApiProxy;
      try {
        if (proxy?.simpleDb?.[entityName]?.setRawData) {
          if (entityName === 'localTokens') {
            await proxy.simpleDb.localTokens.setRawData({
              data: {
                [`forge_${writeTag}`]: {
                  $key: `forge_${writeTag}`,
                  address: '0xforge',
                  name: 'ForgeToken',
                  symbol: 'FRG',
                  decimals: 18,
                  networkId: 'evm--1',
                  _pad: pad,
                },
              },
              tokenList: {},
              smallBalanceTokenList: {},
              riskyTokenList: {},
              tokenListMap: {},
              tokenListValue: {},
            });
          } else {
            await proxy.simpleDb.localHistory.setRawData({
              pendingTxs: {},
              confirmedTxs: {
                [`forge_${writeTag}`]: [
                  {
                    id: `forge-tx-${writeTag}`,
                    timestamp: Date.now(),
                    _pad: pad,
                  },
                ],
              },
            });
          }
          return {
            ok: true,
            path: 'simpleDb',
            ms: Date.now() - startedAt,
            errorName: null,
            errorMessage: null,
          };
        }

        const bucket = await navigator.storageBuckets.open(
          'simple-db_onekey-bucket',
        );
        const db = await new Promise((resolve, reject) => {
          const req = bucket.indexedDB.open('OneKeySimpleDB');
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('keyvaluepairs')) {
              req.result.createObjectStore('keyvaluepairs');
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const saved =
          entityName === 'localTokens'
            ? {
                data: {
                  data: {
                    [`forge_${writeTag}`]: {
                      $key: `forge_${writeTag}`,
                      address: '0xforge',
                      name: 'ForgeToken',
                      symbol: 'FRG',
                      decimals: 18,
                      networkId: 'evm--1',
                      _pad: pad,
                    },
                  },
                  tokenList: {},
                  smallBalanceTokenList: {},
                  riskyTokenList: {},
                  tokenListMap: {},
                  tokenListValue: {},
                },
                updatedAt: Date.now(),
              }
            : {
                data: {
                  pendingTxs: {},
                  confirmedTxs: {
                    [`forge_${writeTag}`]: [
                      {
                        id: `forge-tx-${writeTag}`,
                        timestamp: Date.now(),
                        _pad: pad,
                      },
                    ],
                  },
                },
                updatedAt: Date.now(),
              };
        await new Promise((resolve, reject) => {
          const tx = db.transaction('keyvaluepairs', 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onabort = () =>
            reject(tx.error || new Error('IndexedDB transaction aborted'));
          tx.onerror = () => reject(tx.error);
          tx.objectStore('keyvaluepairs').put(saved, storageKey);
        });
        db.close();
        return {
          ok: true,
          path: 'idbDirect',
          ms: Date.now() - startedAt,
          errorName: null,
          errorMessage: null,
        };
      } catch (error) {
        return {
          ok: false,
          path: proxy?.simpleDb?.[entityName] ? 'simpleDb' : 'idbDirect',
          ms: Date.now() - startedAt,
          errorName: error?.name || 'Error',
          errorMessage: String(error?.message || error),
        };
      }
    },
    {
      entityName: entity,
      bytes: targetBytes,
      tag,
      storageKey: ENTITY_KEYS[entity],
    },
  );
}

async function readEntity(page, entity) {
  return page.evaluate(
    async ({ entityName, storageKey }) => {
      const proxy = globalThis.$$appGlobals?.$backgroundApiProxy;
      try {
        if (proxy?.simpleDb?.[entityName]?.getRawData) {
          const data = await proxy.simpleDb[entityName].getRawData();
          const json = data == null ? null : JSON.stringify(data);
          return {
            ok: true,
            path: 'simpleDb',
            bytes: json ? json.length : 0,
            errorName: null,
            errorMessage: null,
          };
        }
        const bucket = await navigator.storageBuckets.open(
          'simple-db_onekey-bucket',
        );
        const db = await new Promise((resolve, reject) => {
          const req = bucket.indexedDB.open('OneKeySimpleDB');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const value = await new Promise((resolve, reject) => {
          const tx = db.transaction('keyvaluepairs', 'readonly');
          const req = tx.objectStore('keyvaluepairs').get(storageKey);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        db.close();
        const size =
          value == null
            ? 0
            : typeof value === 'string'
              ? value.length
              : JSON.stringify(value).length;
        return {
          ok: true,
          path: 'idbDirect',
          bytes: size,
          errorName: null,
          errorMessage: null,
        };
      } catch (error) {
        return {
          ok: false,
          path: proxy?.simpleDb?.[entityName] ? 'simpleDb' : 'idbDirect',
          bytes: 0,
          errorName: error?.name || 'Error',
          errorMessage: String(error?.message || error),
        };
      }
    },
    { entityName: entity, storageKey: ENTITY_KEYS[entity] },
  );
}

async function readEntityViaIdb(page, entity) {
  const key = ENTITY_KEYS[entity];
  return page.evaluate(async (storageKey) => {
    try {
      // Prefer the live WebStorage bucket used by SimpleDB.
      const buckets = globalThis.navigator?.storageBuckets;
      if (!buckets?.open) {
        return {
          ok: false,
          errorName: 'Error',
          errorMessage: 'storageBuckets unavailable',
        };
      }
      const bucket = await buckets.open('simple-db_onekey-bucket');
      const db = await new Promise((resolve, reject) => {
        const req = bucket.indexedDB.open('OneKeySimpleDB');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
      });
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction('keyvaluepairs', 'readonly');
        const store = tx.objectStore('keyvaluepairs');
        const req = store.get(storageKey);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
      });
      db.close();
      const size =
        typeof value === 'string'
          ? value.length
          : value == null
            ? 0
            : JSON.stringify(value).length;
      return { ok: true, bytes: size, errorName: null, errorMessage: null };
    } catch (error) {
      return {
        ok: false,
        bytes: 0,
        errorName: error?.name || 'Error',
        errorMessage: String(error?.message || error),
      };
    }
  }, key);
}

function isTargetReadError(result) {
  if (!result || result.ok) return false;
  const msg = result.errorMessage || '';
  return msg.includes(TARGET_ERROR_FRAGMENT);
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function ensureDesktopBuilt() {
  if (!process.env.DESKTOP_E2E_SKIP_COPY_INJECT) {
    runYarn(['copy:inject'], { timeoutMs: COPY_INJECT_TIMEOUT_MS });
  }
  if (!process.env.DESKTOP_E2E_SKIP_BUILD_MAIN) {
    runYarn(['workspace', '@onekeyhq/desktop', 'build:main:dev'], {
      timeoutMs: BUILD_MAIN_TIMEOUT_MS,
    });
  }
  if (!fs.existsSync(mainPath)) {
    throw new Error(`Desktop main missing: ${mainPath}`);
  }
}

async function killAppHard(app) {
  const proc = app.process();
  const pid = proc?.pid;
  try {
    if (pid) process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
  try {
    await Promise.race([
      app.close(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // ignore
  }
  if (pid) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0);
        // still alive
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        return;
      }
    }
  }
}

async function runProbeThreshold({ entity, rendererUrl, userDataDir }) {
  const sizes = [32, 48, 64, 80, 96, 128, 256, 512, 1024, 2048].map(
    (kb) => kb * 1024,
  );
  const results = [];
  const { app, page } = await launchDesktop({ userDataDir, rendererUrl });
  try {
    for (const bytes of sizes) {
      const before = summarizeBlobs(userDataDir);
      const write = await writeForgedEntity(page, {
        entity,
        targetBytes: bytes,
        tag: `probe_${bytes}`,
      });
      // allow Chromium to flush external blob files
      await page.waitForTimeout(300);
      const after = summarizeBlobs(userDataDir);
      const read = await readEntity(page, entity);
      const row = {
        bytes,
        write,
        read,
        blobsBefore: before,
        blobsAfter: after,
        enteredExternalBlob:
          after.blobFileCount > before.blobFileCount ||
          after.blobTotalBytes > before.blobTotalBytes + bytes * 0.5,
      };
      results.push(row);
      log(
        `probe ${entity} ${Math.round(bytes / 1024)}KB write=${write.ok} read=${
          read.ok
        } blobs=${after.blobFileCount}/${after.blobTotalBytes}B external=${
          row.enteredExternalBlob
        }`,
      );
      if (isTargetReadError(read)) {
        return { reproduced: true, results, read };
      }
    }
  } finally {
    await app.close().catch(() => {});
  }
  return { reproduced: false, results };
}

async function runGrowRestart({ entity, bytes, rendererUrl, userDataDir }) {
  {
    const { app, page } = await launchDesktop({ userDataDir, rendererUrl });
    try {
      const write = await writeForgedEntity(page, {
        entity,
        targetBytes: bytes,
        tag: 'grow',
      });
      await page.waitForTimeout(500);
      const blobs = summarizeBlobs(userDataDir);
      log(`grow write ok=${write.ok} blobs=${JSON.stringify(blobs)}`);
      if (!write.ok) {
        return { reproduced: false, phase: 'write', write, blobs };
      }
    } finally {
      await app.close().catch(() => {});
    }
  }
  const { app, page } = await launchDesktop({ userDataDir, rendererUrl });
  try {
    const read = await readEntity(page, entity);
    const readIdb = await readEntityViaIdb(page, entity);
    const blobs = summarizeBlobs(userDataDir);
    const reproduced = isTargetReadError(read) || isTargetReadError(readIdb);
    log(
      `grow-restart read entity=${read.ok} idb=${readIdb.ok} err=${
        read.errorMessage || readIdb.errorMessage || ''
      }`,
    );
    return { reproduced, phase: 'read', read, readIdb, blobs };
  } finally {
    await app.close().catch(() => {});
  }
}

async function startForgedWriteInBackground(
  page,
  { entity, targetBytes, tag, concurrentPuts = 1 },
) {
  return page.evaluate(
    ({ entityName, bytes, tag: writeTag, storageKey, puts }) => {
      const makeSaved = (suffix) => {
        const pad = new Uint8Array(Math.max(0, bytes));
        for (let i = 0; i < pad.length; i += 4096) pad[i] = (suffix + 1) & 0xff;
        if (entityName === 'localTokens') {
          return {
            data: {
              data: {
                [`forge_${writeTag}_${suffix}`]: {
                  $key: `forge_${writeTag}_${suffix}`,
                  address: '0xforge',
                  name: 'ForgeToken',
                  symbol: 'FRG',
                  decimals: 18,
                  networkId: 'evm--1',
                  _pad: pad,
                },
              },
              tokenList: {},
              smallBalanceTokenList: {},
              riskyTokenList: {},
              tokenListMap: {},
              tokenListValue: {},
            },
            updatedAt: Date.now(),
          };
        }
        return {
          data: {
            pendingTxs: {},
            confirmedTxs: {
              [`forge_${writeTag}_${suffix}`]: [
                {
                  id: `forge-tx-${writeTag}-${suffix}`,
                  timestamp: Date.now(),
                  _pad: pad,
                },
              ],
            },
          },
          updatedAt: Date.now(),
        };
      };

      globalThis.__okIdbBlobWrite = {
        startedAt: Date.now(),
        putStartedAt: null,
        done: false,
        errorName: null,
        errorMessage: null,
        puts,
      };

      void (async () => {
        try {
          globalThis.__okIdbBlobWrite.putStartedAt = Date.now();
          const bucket = await navigator.storageBuckets.open(
            'simple-db_onekey-bucket',
          );
          const db = await new Promise((resolve, reject) => {
            const req = bucket.indexedDB.open('OneKeySimpleDB');
            req.onupgradeneeded = () => {
              if (!req.result.objectStoreNames.contains('keyvaluepairs')) {
                req.result.createObjectStore('keyvaluepairs');
              }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          // Fire overlapping puts against the same key to widen the
          // LevelDB-ref vs blob-file commit window before SIGKILL.
          await Promise.all(
            Array.from({ length: Math.max(1, puts) }, (_, idx) => {
              const saved = makeSaved(idx);
              return new Promise((resolve, reject) => {
                const tx = db.transaction('keyvaluepairs', 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onabort = () =>
                  reject(
                    tx.error || new Error('IndexedDB transaction aborted'),
                  );
                tx.onerror = () => reject(tx.error);
                tx.objectStore('keyvaluepairs').put(saved, storageKey);
              });
            }),
          );
          db.close();
          globalThis.__okIdbBlobWrite.done = true;
        } catch (error) {
          globalThis.__okIdbBlobWrite.done = true;
          globalThis.__okIdbBlobWrite.errorName = error?.name || 'Error';
          globalThis.__okIdbBlobWrite.errorMessage = String(
            error?.message || error,
          );
        }
      })();

      return {
        started: true,
        bytes,
        puts: Math.max(1, puts),
      };
    },
    {
      entityName: entity,
      bytes: targetBytes,
      tag,
      storageKey: ENTITY_KEYS[entity],
      puts: concurrentPuts,
    },
  );
}

async function launchDesktopWithRetry({
  userDataDir,
  rendererUrl,
  attempts = 3,
}) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await launchDesktop({ userDataDir, rendererUrl });
    } catch (error) {
      lastError = error;
      log(`launch attempt ${i}/${attempts} failed: ${error?.message || error}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  throw lastError;
}

async function runKillMidWrite({
  entity,
  bytes,
  rounds,
  killAfterMsList,
  rendererUrl,
  userDataDir,
}) {
  const trials = [];
  for (let round = 1; round <= rounds; round += 1) {
    const killAfterMs =
      killAfterMsList[(round - 1) % killAfterMsList.length];
    log(
      `kill-mid-write round ${round}/${rounds} entity=${entity} bytes=${bytes} killAfterMs=${killAfterMs}`,
    );

    // eslint-disable-next-line no-await-in-loop
    const { app, page } = await launchDesktopWithRetry({
      userDataDir,
      rendererUrl,
    });
    const blobsBefore = summarizeBlobs(userDataDir);

    // Start put in-page (non-blocking for Playwright), then SIGKILL mid-write.
    // eslint-disable-next-line no-await-in-loop
    const started = await startForgedWriteInBackground(page, {
      entity,
      targetBytes: bytes,
      tag: `kill_${round}_${Date.now()}`,
    });
    // Wait until the renderer actually entered the IndexedDB put path.
    const putStartedDeadline = Date.now() + 15_000;
    while (Date.now() < putStartedDeadline) {
      // eslint-disable-next-line no-await-in-loop
      const putStarted = await page
        .evaluate(() => Boolean(globalThis.__okIdbBlobWrite?.putStartedAt))
        .catch(() => false);
      if (putStarted) break;
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(10);
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(killAfterMs);
    // eslint-disable-next-line no-await-in-loop
    await killAppHard(app);

    const write = {
      ok: false,
      started: Boolean(started?.started),
      allocatedBytes: started?.bytes ?? null,
      ms: killAfterMs,
      errorName: 'Killed',
      errorMessage: `SIGKILL after ${killAfterMs}ms`,
    };

    // Restart and read — this is where persistent external-blob damage shows.
    let read;
    let readIdb;
    let blobsAfter;
    try {
      // eslint-disable-next-line no-await-in-loop
      const relaunch = await launchDesktopWithRetry({
        userDataDir,
        rendererUrl,
      });
      try {
        // eslint-disable-next-line no-await-in-loop
        read = await readEntity(relaunch.page, entity);
        // eslint-disable-next-line no-await-in-loop
        readIdb = await readEntityViaIdb(relaunch.page, entity);
        blobsAfter = summarizeBlobs(userDataDir);
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await relaunch.app.close().catch(() => {});
      }
    } catch (error) {
      read = {
        ok: false,
        errorName: 'LaunchError',
        errorMessage: String(error?.message || error),
      };
      readIdb = read;
      blobsAfter = summarizeBlobs(userDataDir);
    }

    const trial = {
      round,
      killAfterMs,
      bytes,
      write,
      read,
      readIdb,
      blobsBefore,
      blobsAfter,
      reproduced: isTargetReadError(read) || isTargetReadError(readIdb),
    };
    trials.push(trial);
    log(
      `round ${round} reproduced=${trial.reproduced} readOk=${read?.ok} readErr=${
        read?.errorMessage || ''
      } blobs=${blobsAfter?.blobFileCount}/${blobsAfter?.blobTotalBytes}`,
    );
    writeJson(path.join(artifactRoot, 'latest-trial.json'), trial);
    if (trial.reproduced) {
      return { reproduced: true, trials };
    }
  }
  return { reproduced: false, trials };
}

async function runOverwriteKill({
  entity,
  bytes,
  rounds,
  killAfterMsList,
  rendererUrl,
  userDataDir,
  concurrentPuts = 1,
}) {
  // First establish a durable large external-blob record, then interrupt an
  // in-flight overwrite. This targets the dangling-reference window more
  // tightly than killing a first-time insert.
  {
    const { app, page } = await launchDesktopWithRetry({
      userDataDir,
      rendererUrl,
    });
    try {
      const seed = await writeForgedEntity(page, {
        entity,
        targetBytes: bytes,
        tag: 'seed',
      });
      await page.waitForTimeout(500);
      const blobs = summarizeBlobs(userDataDir);
      log(
        `overwrite-kill seed ok=${seed.ok} path=${seed.path} blobs=${blobs.blobFileCount}/${blobs.blobTotalBytes}`,
      );
      if (!seed.ok || blobs.blobFileCount < 1) {
        return {
          reproduced: false,
          phase: 'seed',
          seed,
          blobs,
          reason: 'failed to establish external blob before overwrite kills',
        };
      }
    } finally {
      await app.close().catch(() => {});
    }
  }

  const trials = [];
  for (let round = 1; round <= rounds; round += 1) {
    const killAfterMs =
      killAfterMsList[(round - 1) % killAfterMsList.length];
    log(
      `overwrite-kill round ${round}/${rounds} entity=${entity} bytes=${
        bytes * 2
      } killAfterMs=${killAfterMs}`,
    );
    // eslint-disable-next-line no-await-in-loop
    const { app, page } = await launchDesktopWithRetry({
      userDataDir,
      rendererUrl,
    });
    const blobsBefore = summarizeBlobs(userDataDir);
    // eslint-disable-next-line no-await-in-loop
    const started = await startForgedWriteInBackground(page, {
      entity,
      targetBytes: bytes * 2,
      tag: `ovw_${round}_${Date.now()}`,
      concurrentPuts,
    });
    const putStartedDeadline = Date.now() + 15_000;
    while (Date.now() < putStartedDeadline) {
      // eslint-disable-next-line no-await-in-loop
      const putStarted = await page
        .evaluate(() => Boolean(globalThis.__okIdbBlobWrite?.putStartedAt))
        .catch(() => false);
      if (putStarted) break;
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(10);
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(killAfterMs);
    // eslint-disable-next-line no-await-in-loop
    await killAppHard(app);

    let read;
    let readIdb;
    let blobsAfter;
    try {
      // eslint-disable-next-line no-await-in-loop
      const relaunch = await launchDesktopWithRetry({
        userDataDir,
        rendererUrl,
      });
      try {
        // eslint-disable-next-line no-await-in-loop
        read = await readEntity(relaunch.page, entity);
        // eslint-disable-next-line no-await-in-loop
        readIdb = await readEntityViaIdb(relaunch.page, entity);
        blobsAfter = summarizeBlobs(userDataDir);
      } finally {
        // eslint-disable-next-line no-await-in-loop
        await relaunch.app.close().catch(() => {});
      }
    } catch (error) {
      read = {
        ok: false,
        errorName: 'LaunchError',
        errorMessage: String(error?.message || error),
      };
      readIdb = read;
      blobsAfter = summarizeBlobs(userDataDir);
    }

    const trial = {
      round,
      killAfterMs,
      bytes: bytes * 2,
      started,
      read,
      readIdb,
      blobsBefore,
      blobsAfter,
      reproduced: isTargetReadError(read) || isTargetReadError(readIdb),
    };
    trials.push(trial);
    log(
      `round ${round} reproduced=${trial.reproduced} readOk=${read?.ok} err=${
        read?.errorMessage || ''
      } blobs=${blobsAfter?.blobFileCount}/${blobsAfter?.blobTotalBytes}`,
    );
    writeJson(path.join(artifactRoot, 'latest-trial.json'), trial);
    if (trial.reproduced) return { reproduced: true, trials };
  }
  return { reproduced: false, trials };
}

/**
 * Restore writable free space on a nearly-full APFS sparseimage.
 * Truncate can itself throw ENOSPC when the volume is maxed out; prefer
 * unlinking reserved escape / ballast files (frees space without allocating).
 */
function ensureLaunchHeadroom(fillPath, mountPoint, minFreeBytes, escapePath) {
  let free = volumeFreeBytes(mountPoint);
  if (free == null || free >= minFreeBytes) return free;

  const tryUnlink = (p, label) => {
    if (!p || !fs.existsSync(p)) return;
    try {
      fs.unlinkSync(p);
      free = volumeFreeBytes(mountPoint);
      log(`unlinked ${label} → free≈${free}`);
    } catch (error) {
      log(
        `unlink ${label} soft-fail: ${error?.code || error?.message || error}`,
      );
    }
  };

  // Escape hatch is reserved before dyn-fill and must be reclaimed first.
  tryUnlink(escapePath, 'escape-headroom');
  if (free != null && free >= minFreeBytes) return free;

  // Truncate often fails with ENOSPC on a dead-full APFS volume — unlink instead.
  if (fs.existsSync(fillPath)) {
    try {
      const st = fs.statSync(fillPath);
      const need = minFreeBytes - (free ?? 0) + 1024 * 1024;
      const nextSize = Math.max(0, st.size - need);
      try {
        fs.truncateSync(fillPath, nextSize);
        free = volumeFreeBytes(mountPoint);
        log(
          `trimmed ballast to restore launch headroom free≈${free} (want≥${minFreeBytes})`,
        );
      } catch (error) {
        log(
          `trim ballast soft-fail: ${error?.code || error?.message || error}; falling back to unlink`,
        );
        tryUnlink(fillPath, 'fill-ballast');
      }
    } catch (error) {
      log(`stat/trim ballast soft-fail: ${error?.code || error?.message || error}`);
      tryUnlink(fillPath, 'fill-ballast');
    }
  }

  free = volumeFreeBytes(mountPoint);
  if (free != null && free < minFreeBytes) {
    log(
      `WARN headroom still low free≈${free} want≥${minFreeBytes} after reclaim`,
    );
  }
  return free;
}

/** Reserve a deletable escape file so post-kill reclaim never depends on truncate. */
function writeEscapeHeadroom(escapePath, bytes) {
  if (bytes <= 0) return 0;
  const chunk = Buffer.alloc(1024 * 1024, 0xee);
  const fd = fs.openSync(escapePath, 'w');
  let written = 0;
  try {
    while (written < bytes) {
      const n = Math.min(chunk.length, bytes - written);
      fs.writeSync(fd, chunk, 0, n);
      written += n;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return written;
}

/** Rebuild pre-ballast after an unlink-based reclaim so the next dyn-fill can ENOSPC again. */
function refillBallastLeavingHeadroom(fillPath, mountPoint, leaveFreeBytes) {
  const free = volumeFreeBytes(mountPoint);
  if (free == null) return 0;
  const targetWrite = Math.max(0, free - leaveFreeBytes);
  if (targetWrite < 1024 * 1024) return 0;
  const chunk = Buffer.alloc(1024 * 1024, 1);
  const fd = fs.openSync(fillPath, 'w');
  let written = 0;
  try {
    while (written < targetWrite) {
      const n = Math.min(chunk.length, targetWrite - written);
      try {
        fs.writeSync(fd, chunk, 0, n);
        written += n;
      } catch (error) {
        if (error?.code === 'ENOSPC') break;
        throw error;
      }
    }
    try {
      fs.fsyncSync(fd);
    } catch {
      // ignore
    }
  } finally {
    fs.closeSync(fd);
  }
  return written;
}

/**
 * Append real bytes to ballast as fast as possible until ENOSPC or deadline.
 * Used mid-overwrite so Chromium's blob write races the volume filling up.
 */
function appendBallastUntilFull(fillPath, { deadlineMs = 2000 } = {}) {
  const chunk = Buffer.alloc(256 * 1024, 0xab);
  const started = Date.now();
  let written = 0;
  let hitEnospc = false;
  const fd = fs.openSync(fillPath, 'a');
  try {
    while (Date.now() - started < deadlineMs) {
      try {
        fs.writeSync(fd, chunk);
        written += chunk.length;
      } catch (error) {
        if (error?.code === 'ENOSPC') {
          hitEnospc = true;
          break;
        }
        throw error;
      }
    }
    try {
      fs.fsyncSync(fd);
    } catch {
      // ignore
    }
  } finally {
    fs.closeSync(fd);
  }
  return {
    written,
    hitEnospc,
    ms: Date.now() - started,
  };
}

async function runLowDisk({
  entity,
  bytes,
  rounds,
  volMb,
  rendererUrl,
  volume,
  killAfterMsList,
  reserveMb,
}) {
  // Mode A: seed first, leave comfortable headroom, then during each overwrite
  // dynamically fill the sparse volume to ENOSPC and SIGKILL — targeting the
  // LevelDB-ref-committed / blob-file-incomplete window without mutating blobs.
  const launchHeadroom = Math.max(
    (reserveMb || 32) * 1024 * 1024,
    28 * 1024 * 1024,
  );

  const seedLaunch = await launchDesktopWithRetry({
    userDataDir: volume.userDataDir,
    rendererUrl,
  });
  try {
    const seed = await writeForgedEntity(seedLaunch.page, {
      entity,
      targetBytes: bytes,
      tag: 'seed',
    });
    await seedLaunch.page.waitForTimeout(500);
    const blobs = summarizeBlobs(volume.userDataDir);
    log(
      `low-disk seed ok=${seed.ok} blobs=${blobs.blobFileCount}/${blobs.blobTotalBytes}`,
    );
    if (!seed.ok || blobs.blobFileCount < 1) {
      return {
        reproduced: false,
        phase: 'seed',
        seed,
        blobs,
        reason: 'failed to establish external blob before ballast',
      };
    }
  } finally {
    await seedLaunch.app.close().catch(() => {});
  }

  const fillPath = path.join(volume.mountPoint, 'fill-ballast.bin');
  const escapePath = path.join(volume.mountPoint, 'escape-headroom.bin');
  // Reserve deletable escape first, then pre-fill the rest. Dyn-fill only
  // appends to fill-ballast so post-kill unlink(escape) always reclaims space
  // even when truncate would ENOSPC.
  const freeBefore = volumeFreeBytes(volume.mountPoint);
  try {
    const escWritten = writeEscapeHeadroom(escapePath, launchHeadroom);
    log(
      `escape-headroom reserved ${Math.round(escWritten / 1024 / 1024)}MB at ${escapePath}`,
    );
  } catch (error) {
    log(
      `escape-headroom soft-fail: ${error?.code || error?.message || error}`,
    );
  }
  const freeAfterEscape = volumeFreeBytes(volume.mountPoint);
  // Leave a thin writable cushion so Electron can start the put before dyn-fill.
  const putCushion = 8 * 1024 * 1024;
  const preFillBytes = Math.max(
    0,
    (freeAfterEscape ?? freeBefore ?? volMb * 1024 * 1024) - putCushion,
  );
  if (preFillBytes > 0) {
    log(
      `low-disk pre-ballast target=${Math.round(preFillBytes / 1024 / 1024)}MB putCushion≈${Math.round(putCushion / 1024 / 1024)}MB (+escape ${Math.round(launchHeadroom / 1024 / 1024)}MB)`,
    );
    try {
      const written = refillBallastLeavingHeadroom(
        fillPath,
        volume.mountPoint,
        putCushion,
      );
      log(`pre-ballast wrote ${Math.round(written / 1024 / 1024)}MB`);
    } catch (error) {
      log(`pre-ballast stopped early: ${error?.code || error?.message || error}`);
    }
  }
  log(
    `low-disk free after pre-ballast=${volumeFreeBytes(volume.mountPoint)} (host untouched)`,
  );

  const killList =
    killAfterMsList?.length > 0
      ? killAfterMsList
      : [0, 5, 10, 20, 40, 80, 150, 300];
  const trials = [];

  for (let round = 1; round <= rounds; round += 1) {
    const killAfterMs = killList[(round - 1) % killList.length];
    try {
      // Ensure escape exists for this round's post-kill reclaim.
      if (!fs.existsSync(escapePath)) {
        ensureLaunchHeadroom(
          fillPath,
          volume.mountPoint,
          launchHeadroom + putCushion,
          escapePath,
        );
        try {
          writeEscapeHeadroom(escapePath, launchHeadroom);
          refillBallastLeavingHeadroom(
            fillPath,
            volume.mountPoint,
            putCushion,
          );
        } catch (error) {
          log(
            `re-reserve escape soft-fail: ${error?.code || error?.message || error}`,
          );
        }
      }
      ensureLaunchHeadroom(
        fillPath,
        volume.mountPoint,
        putCushion,
        /* do not burn escape yet */ undefined,
      );
      log(
        `dyn-fill overwrite round ${round}/${rounds} bytes=${
          bytes * 2
        } killAfterMs=${killAfterMs} free=${volumeFreeBytes(volume.mountPoint)} escape=${fs.existsSync(escapePath)}`,
      );

      let app;
      let page;
      try {
        // eslint-disable-next-line no-await-in-loop
        ({ app, page } = await launchDesktopWithRetry({
          userDataDir: volume.userDataDir,
          rendererUrl,
          attempts: 2,
        }));
      } catch (error) {
        trials.push({
          round,
          killAfterMs,
          reproduced: false,
          errorName: 'LaunchError',
          errorMessage: String(error?.message || error),
          freeBytes: volumeFreeBytes(volume.mountPoint),
        });
        log(`round ${round} launch failed: ${error?.message || error}`);
        ensureLaunchHeadroom(
          fillPath,
          volume.mountPoint,
          launchHeadroom + putCushion,
          escapePath,
        );
        continue;
      }

      const blobsBefore = summarizeBlobs(volume.userDataDir);
      const freeBeforePut = volumeFreeBytes(volume.mountPoint);

      // eslint-disable-next-line no-await-in-loop
      const started = await startForgedWriteInBackground(page, {
        entity,
        targetBytes: bytes * 2,
        tag: `dyn_${round}_${Date.now()}`,
        concurrentPuts: 2,
      });

      const putStartedDeadline = Date.now() + 15_000;
      while (Date.now() < putStartedDeadline) {
        // eslint-disable-next-line no-await-in-loop
        const putStarted = await page
          .evaluate(() => Boolean(globalThis.__okIdbBlobWrite?.putStartedAt))
          .catch(() => false);
        if (putStarted) break;
        // eslint-disable-next-line no-await-in-loop
        await page.waitForTimeout(10);
      }

      // Optional short delay so Chromium can enter blob write, then slam the
      // volume full while the put is still in flight.
      // eslint-disable-next-line no-await-in-loop
      if (killAfterMs > 0) await page.waitForTimeout(killAfterMs);

      const fillResult = appendBallastUntilFull(fillPath, {
        deadlineMs: Math.max(800, 2500 - killAfterMs),
      });
      const freeAfterDynFill = volumeFreeBytes(volume.mountPoint);
      log(
        `dyn-fill wrote=${fillResult.written} enospc=${fillResult.hitEnospc} ms=${fillResult.ms} free=${freeAfterDynFill}`,
      );

      // eslint-disable-next-line no-await-in-loop
      await killAppHard(app).catch((error) => {
        log(`killAppHard soft-fail: ${error?.message || error}`);
      });

      // Free launch headroom via escape unlink — never touch indexeddb.blob.
      ensureLaunchHeadroom(
        fillPath,
        volume.mountPoint,
        launchHeadroom,
        escapePath,
      );

      let read;
      let readIdb;
      let blobsAfter;
      try {
        // eslint-disable-next-line no-await-in-loop
        const relaunch = await launchDesktopWithRetry({
          userDataDir: volume.userDataDir,
          rendererUrl,
          attempts: 3,
        });
        try {
          // eslint-disable-next-line no-await-in-loop
          read = await readEntity(relaunch.page, entity);
          // eslint-disable-next-line no-await-in-loop
          readIdb = await readEntityViaIdb(relaunch.page, entity);
          blobsAfter = summarizeBlobs(volume.userDataDir);
        } finally {
          // eslint-disable-next-line no-await-in-loop
          await relaunch.app.close().catch(() => {});
        }
      } catch (error) {
        read = {
          ok: false,
          errorName: 'LaunchError',
          errorMessage: String(error?.message || error),
        };
        readIdb = read;
        blobsAfter = summarizeBlobs(volume.userDataDir);
        ensureLaunchHeadroom(
          fillPath,
          volume.mountPoint,
          launchHeadroom + putCushion,
          escapePath,
        );
      }

      const trial = {
        round,
        killAfterMs,
        bytes: bytes * 2,
        started,
        fillResult,
        freeBeforePut,
        freeAfterDynFill,
        freeAfterTrim: volumeFreeBytes(volume.mountPoint),
        read,
        readIdb,
        blobsBefore,
        blobsAfter,
        reproduced: isTargetReadError(read) || isTargetReadError(readIdb),
      };
      trials.push(trial);
      log(
        `round ${round} reproduced=${trial.reproduced} readOk=${read?.ok} err=${
          read?.errorMessage || ''
        } blobs=${blobsAfter?.blobFileCount}/${blobsAfter?.blobTotalBytes}`,
      );
      writeJson(path.join(artifactRoot, 'latest-trial.json'), trial);
      if (trial.reproduced) return { reproduced: true, trials };
    } catch (error) {
      log(
        `round ${round} unexpected error (continuing): ${
          error?.message || error
        }`,
      );
      ensureLaunchHeadroom(
        fillPath,
        volume.mountPoint,
        launchHeadroom + putCushion,
        escapePath,
      );
      trials.push({
        round,
        killAfterMs,
        reproduced: false,
        errorName: error?.name || 'UnexpectedError',
        errorMessage: String(error?.message || error),
      });
    }
  }
  return { reproduced: false, trials };
}

/**
 * End-to-end self-heal check on the real Desktop SimpleDB entities via
 * backgroundApiProxy (fault-inject inside e2eProbeUnreadableSelfHeal).
 */
async function runSelfHealVerify({ rendererUrl, userDataDir }) {
  const { app, page } = await launchDesktopWithRetry({
    userDataDir,
    rendererUrl,
  });
  try {
    page.setDefaultTimeout(180_000);

    // Wait until the real background SimpleDB proxy is callable.
    const proxyReadyDeadline = Date.now() + 90_000;
    let proxyReady = false;
    while (Date.now() < proxyReadyDeadline) {
      // eslint-disable-next-line no-await-in-loop
      proxyReady = await page
        .evaluate(() => {
          const proxy = globalThis.$$appGlobals?.$backgroundApiProxy;
          return Boolean(
            proxy?.simpleDb?.localTokens?.setRawData &&
              proxy?.simpleDb?.localTokens?.e2eProbeUnreadableSelfHeal &&
              proxy?.simpleDb?.localHistory?.setRawData &&
              proxy?.simpleDb?.localHistory?.e2eProbeUnreadableSelfHeal,
          );
        })
        .catch(() => false);
      if (proxyReady) break;
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(500);
    }
    if (!proxyReady) {
      const diag = await page
        .evaluate(() => {
          const g = globalThis.$$appGlobals;
          return {
            href: String(globalThis.location?.href || ''),
            hasAppGlobals: Boolean(g),
            hasProxy: Boolean(g?.$backgroundApiProxy),
            hasBg: Boolean(g?.$$backgroundApi),
            hasSimpleDbGlobal: Boolean(g?.$$simpleDb),
            proxySimpleDbKeys: g?.$backgroundApiProxy?.simpleDb
              ? Object.keys(g.$backgroundApiProxy.simpleDb).slice(0, 20)
              : [],
          };
        })
        .catch((error) => ({ error: String(error?.message || error) }));
      log(`self-heal-verify proxy not ready: ${JSON.stringify(diag)}`);
      return {
        passed: false,
        reproduced: false,
        selfHealVerified: false,
        detail: { ok: false, reason: 'backgroundApiProxy.simpleDb not ready', diag },
      };
    }

    const result = await page.evaluate(async () => {
      try {
        globalThis.__OK_SIMPLEDB_SELF_HEAL_E2E__ = true;
        const proxy = globalThis.$$appGlobals?.$backgroundApiProxy?.simpleDb;
        if (!proxy?.localTokens || !proxy?.localHistory) {
          return {
            ok: false,
            reason: 'simpleDb proxy missing inside evaluate',
          };
        }
        const TARGET_MESSAGE = 'Failed to read large IndexedDB value';

        const verifyEntity = async (entityName) => {
          const entity = proxy[entityName];
          const steps = [];
          const seedPayload =
            entityName === 'localTokens'
              ? {
                  data: {
                    self_heal_seed: {
                      $key: 'self_heal_seed',
                      address: '0xselfheal',
                      name: 'SelfHeal',
                      symbol: 'SH',
                      decimals: 18,
                      networkId: 'evm--1',
                    },
                  },
                  tokenList: {},
                  smallBalanceTokenList: {},
                  riskyTokenList: {},
                  tokenListMap: {},
                  tokenListValue: {},
                }
              : {
                  pendingTxs: {},
                  confirmedTxs: {
                    self_heal_seed: [
                      { id: 'self-heal-tx', timestamp: Date.now() },
                    ],
                  },
                };

          await entity.setRawData(seedPayload);
          const seeded = await entity.getRawData();
          if (!seeded) {
            return {
              entityName,
              ok: false,
              steps,
              reason: 'seed write/read failed',
            };
          }
          steps.push('seeded');

          const durable = await entity.e2eProbeUnreadableSelfHeal({
            failTimes: 99,
          });
          const durableOk =
            durable.dataIsNull &&
            durable.removeCalls === 1 &&
            durable.getCalls >= 2 &&
            durable.errorMessage === TARGET_MESSAGE;
          steps.push({ name: 'durableSelfHeal', ok: durableOk, ...durable });
          if (!durableOk) {
            return {
              entityName,
              ok: false,
              steps,
              reason: 'durable self-heal did not drop the record',
            };
          }

          await entity.setRawData(seedPayload);
          const rebuilt = await entity.getRawData();
          const rebuildOk = Boolean(rebuilt);
          steps.push({ name: 'rebuild', ok: rebuildOk });
          if (!rebuildOk) {
            return {
              entityName,
              ok: false,
              steps,
              reason: 'rebuild after self-heal failed',
            };
          }

          const transient = await entity.e2eProbeUnreadableSelfHeal({
            failTimes: 1,
          });
          const transientOk =
            !transient.dataIsNull &&
            transient.removeCalls === 0 &&
            transient.getCalls === 2 &&
            transient.errorMessage === TARGET_MESSAGE;
          steps.push({
            name: 'transientRecover',
            ok: transientOk,
            ...transient,
          });
          if (!transientOk) {
            return {
              entityName,
              ok: false,
              steps,
              reason: 'transient failure incorrectly deleted or failed',
            };
          }

          return {
            entityName,
            entityKey: durable.entityKey,
            ok: true,
            steps,
            targetMessage: TARGET_MESSAGE,
          };
        };

        const results = [];
        for (const name of ['localTokens', 'localHistory']) {
          // eslint-disable-next-line no-await-in-loop
          results.push(await verifyEntity(name));
        }
        return { ok: results.every((r) => r.ok), results };
      } catch (error) {
        return {
          ok: false,
          reason: `${error?.name || 'Error'}: ${error?.message || error}`,
          stack: String(error?.stack || ''),
        };
      }
    });

    log(
      `self-heal-verify ok=${result?.ok} detail=${JSON.stringify(result?.results || result)}`,
    );
    return {
      passed: Boolean(result?.ok),
      reproduced: false,
      selfHealVerified: Boolean(result?.ok),
      detail: result,
    };
  } finally {
    await app.close().catch(() => {});
  }
}

async function main() {
  const { mode, flags } = parseArgs(process.argv.slice(2));
  const entity = flags.entity === 'localHistory' ? 'localHistory' : 'localTokens';
  const rounds = Number(flags.rounds || 20);
  const bytes = Number(flags.bytes || 2 * 1024 * 1024);
  const volMb = Number(flags['vol-mb'] || 256);
  const reserveMb = Number(flags['reserve-mb'] || 32);
  const killAfterMsList = String(flags['kill-ms'] || '0,10,30,80,150,300,600')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const runId = `run-${Date.now()}`;
  fs.mkdirSync(artifactRoot, { recursive: true });

  if (mode === 'help' || flags.help) {
    console.log(`Usage:
  node scenarios/idb-external-blob-corruption-desktop.mjs <mode> [flags]

Modes:
  probe-threshold | grow-restart | kill-mid-write | overwrite-kill | low-disk | self-heal-verify

Flags:
  --entity localTokens|localHistory
  --rounds N
  --bytes N           forged payload pad size (default 2MiB)
  --vol-mb N          sparseimage size for low-disk (default 256)
  --kill-ms a,b,c     SIGKILL delays after put starts

Safety:
  - Never mutates indexeddb.blob files.
  - low-disk uses a disposable sparseimage mount; host free space is untouched.
  - self-heal-verify fault-injects the Chromium error on real SimpleDB entities.
`);
    return;
  }

  log(`mode=${mode} entity=${entity} bytes=${bytes} rounds=${rounds}`);
  log(`artifacts → ${artifactRoot}`);
  log('RULE: no direct blob file mutation');

  await ensureDesktopBuilt();
  const { child: rendererProcess, rendererUrl } = await startRenderer();

  let volume = null;
  let userDataDir = null;
  let result;

  try {
    if (mode === 'low-disk') {
      volume = createSparseVolume({ volMb, runId });
      userDataDir = volume.userDataDir;
      result = await runLowDisk({
        entity,
        bytes,
        rounds,
        volMb,
        rendererUrl,
        volume,
        killAfterMsList,
        reserveMb,
      });
    } else {
      userDataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'onekey-idb-blob-repro-'),
      );
      if (mode === 'probe-threshold') {
        result = await runProbeThreshold({ entity, rendererUrl, userDataDir });
      } else if (mode === 'grow-restart') {
        result = await runGrowRestart({
          entity,
          bytes,
          rendererUrl,
          userDataDir,
        });
      } else if (mode === 'kill-mid-write') {
        result = await runKillMidWrite({
          entity,
          bytes,
          rounds,
          killAfterMsList,
          rendererUrl,
          userDataDir,
        });
      } else if (mode === 'overwrite-kill') {
        result = await runOverwriteKill({
          entity,
          bytes,
          rounds,
          killAfterMsList,
          rendererUrl,
          userDataDir,
        });
      } else if (mode === 'self-heal-verify') {
        result = await runSelfHealVerify({ rendererUrl, userDataDir });
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }
    }

    const outPath = path.join(artifactRoot, `${runId}-${mode}.json`);
    writeJson(outPath, {
      mode,
      entity,
      bytes,
      rounds,
      volMb: mode === 'low-disk' ? volMb : undefined,
      userDataDir,
      reproduced: Boolean(result?.reproduced),
      selfHealVerified: Boolean(result?.selfHealVerified ?? result?.passed),
      targetError: TARGET_ERROR_FRAGMENT,
      blobMutationUsed: false,
      hostDiskFilled: false,
      sparseVolumeUsed: Boolean(volume),
      result,
      finishedAt: new Date().toISOString(),
    });
    log(`wrote ${outPath}`);
    if (mode === 'self-heal-verify') {
      if (result?.passed || result?.selfHealVerified) {
        console.log('\n🟢 self-heal e2e PASSED');
        process.exit(0);
      } else {
        console.log('\n🔴 self-heal e2e FAILED');
        process.exit(1);
      }
    } else if (result?.reproduced) {
      console.log('\n🔴 REPRODUCED accurate large IndexedDB read failure');
      process.exitCode = 0;
    } else {
      console.log('\n🟢 not reproduced this run (natural paths only)');
      process.exitCode = 3;
    }
  } finally {
    await stopProcess(rendererProcess);
    if (volume) {
      volume.detach();
    } else if (userDataDir && process.env.KEEP_PROFILE !== '1') {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } else if (userDataDir) {
      log(`KEEP_PROFILE=1 → left profile at ${userDataDir}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
