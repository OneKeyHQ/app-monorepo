/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, onekey/no-raw-error -- e2e specs drive the real private download methods via `(api as any)`; the local waitFor helper throws a plain Error on timeout */
// End-to-end lifecycle regression for the desktop concurrent downloader.
//
// Sibling of DesktopApiBundleUpdate.e2e.test.ts (which covers OCDS-T2). This
// file drives the REAL production methods on DesktopApiAppBundleUpdate against
// the shared local Range HTTP harness and exercises the lifecycle behaviors:
//
//   OCDS-T7  — progress monotonic (§5.7): the progress the module reports via
//              webContents.send(UPDATE_DOWNLOADING, { transferred, ... }) never
//              decreases across a normal concurrent run.
//   OCDS-T8  — cancel mid-run (§5.8): cancelling an in-flight run stops the
//              in-flight requests, removes the .partial/.progress artifacts, and
//              resets isDownloading; nothing is resurrected.
//   OCDS-T11 — single-flight (§5.8): two concurrent downloadBundle() calls for
//              the same destination JOIN one in-flight run (the second returns
//              the SAME promise) and only one set of segment requests happens —
//              the artifacts are never co-written.
//
// Like the sibling file, the jest.mock(...) block below is copied VERBATIM from
// the harness's JEST_MOCK_BLOCK (jest.mock hoists per-file, so it cannot be
// shared via the helper). Server/seed/plan utilities come from the harness.

import crypto from 'crypto';
import fs from 'fs';

import {
  ETAG,
  SEGMENTS,
  USERDATA,
  cleanDownloadDir,
  downloadDir,
  makeApi,
  sha256,
  startFaultServer,
} from './__e2e__/desktopBundleUpdateE2eHarness';

// --- Mock the Electron / desktop-app deps so the module loads under node-jest.
// (Copied from desktopBundleUpdateE2eHarness.ts JEST_MOCK_BLOCK — jest.mock
// hoists per-file so it cannot be shared via the helper.)
jest.mock('electron', () => ({ app: { getPath: () => USERDATA } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info() {}, warn() {}, error() {}, transports: {} },
}));
jest.mock('@onekeyhq/desktop/app/bundle', () => {
  const c = require('crypto');
  const f = require('fs');
  const sha = (p: string) =>
    c.createHash('sha256').update(f.readFileSync(p)).digest('hex');
  return {
    verifySha256: (p: string, expected: string) =>
      sha(p).toLowerCase() === String(expected).toLowerCase(),
    calculateSHA256: sha,
    lastSHA256FailureReason: () => 'MISMATCH',
    checkFileSha512: () => true,
    getBundleDirName: () => 'bundle',
    getBundleExtractDir: () => require('path').join(USERDATA, 'extract'),
    testExtractedSha256FromVerifyAscFile: () => true,
    verifyMetadataFileSha256: () => true,
  };
});
jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: new Proxy({}, { get: () => 'ipc-key' }),
}));
jest.mock(
  '@onekeyhq/desktop/app/libs/store',
  () => new Proxy({}, { get: () => () => undefined }),
);
jest.mock('@onekeyhq/desktop/app/windowProgressBar', () => ({
  clearWindowProgressBar() {},
  updateWindowProgressBar() {},
}));

// Install a fake main window so the production emitProgress path
// (getMainWindow()?.webContents.send(...)) actually runs and can be observed.
// getMainWindow() reads globalThis.$desktopMainAppFunctions.getSafelyMainWindow.
// ipcMessageKeys is mocked to a Proxy → every key is the string 'ipc-key', so
// the UPDATE_DOWNLOADING channel arrives as 'ipc-key'.
function installProgressWindow(): { sends: Array<[string, any]> } {
  const sends: Array<[string, any]> = [];
  const fakeWindow = {
    webContents: {
      send: (channel: string, payload: any) => {
        sends.push([channel, payload]);
      },
    },
  };
  (globalThis as any).$desktopMainAppFunctions = {
    getSafelyMainWindow: () => fakeWindow,
  };
  return { sends };
}

function uninstallProgressWindow() {
  delete (globalThis as any).$desktopMainAppFunctions;
}

describe('DesktopApiBundleUpdate — concurrent download lifecycle e2e', () => {
  jest.setTimeout(30_000);
  const TOTAL = 4 * 1024 * 1024; // 4 MiB → 8 × 512 KiB segments
  let content: Buffer;
  let expectedSha: string;

  beforeEach(() => {
    cleanDownloadDir();
    content = crypto.randomBytes(TOTAL);
    expectedSha = sha256(content);
  });

  afterEach(() => {
    uninstallProgressWindow();
  });

  // OCDS-T7 — Progress is monotonic non-decreasing within a run even though the
  // 8 workers report concurrently. We observe the REAL reported progress on the
  // production IPC path (webContents.send) and assert `transferred` never drops.
  test('OCDS-T7: reported progress is monotonic non-decreasing across a run', async () => {
    const { sends } = installProgressWindow();
    const srv = await startFaultServer(content);
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601070',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      // Sanity: the download genuinely completed and verified.
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);

      // Pull every transferred value the module reported on the real IPC path.
      const transferredSeries = sends
        .filter(([channel]) => channel === 'ipc-key')
        .map(([, payload]) => payload?.transferred as number)
        .filter((v) => typeof v === 'number');

      // We must have observed real progress reports (initial emit + per-chunk).
      expect(transferredSeries.length).toBeGreaterThan(1);

      // Monotonic non-decreasing: no report ever moves the bar backward.
      for (let i = 1; i < transferredSeries.length; i += 1) {
        expect(transferredSeries[i]).toBeGreaterThanOrEqual(
          transferredSeries[i - 1],
        );
      }

      // It must actually reach the full size at the end (real completion).
      expect(transferredSeries[transferredSeries.length - 1]).toBe(TOTAL);
    } finally {
      await srv.close();
    }
  });

  // OCDS-T8 — Cancel mid-run. Start a download against a server that STALLS
  // every range (sends 206 headers then no body), so all 8 segment requests
  // are in-flight and parked. Then call the module's clearDownload() — which
  // fires the per-dest cancel (abortAll) BEFORE wiping artifacts. Assert: the
  // run aborts (rejects "Download cancelled"), isDownloading is reset, and the
  // .partial/.progress artifacts are gone (not resurrected by the still-settling
  // run).
  test('OCDS-T8: cancel mid-run stops in-flight work and removes artifacts', async () => {
    const srv = await startFaultServer(content, {
      // Hold every range socket open with headers-only; holdMs caps the server
      // teardown so it never leaks past the test even if abort somehow misses.
      mode: { kind: 'stall', holdMs: 10_000 },
    });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601080',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      const partialPath = `${downloadDir()}/1.0.0-202601080.zip.partial`;
      const manifestPath = `${partialPath}.progress.json`;

      // Kick off the concurrent run; it will park on the stalled sockets.
      const runPromise = (api as any).downloadBundleConcurrent(params, probe);

      // Wait until the run has genuinely begun: it set isDownloading, registered
      // its per-dest cancel, pre-allocated the .partial, AND at least one segment
      // GET has actually reached the (stalled) server — so we are cancelling a
      // real in-flight transfer, not a run that has not issued any request yet.
      await waitFor(() => {
        return (
          (api as any).isDownloading === true &&
          (api as any).cancelByDest.size > 0 &&
          fs.existsSync(partialPath) &&
          srv.requests.length > 0
        );
      });

      // Some segment requests are on the wire (in-flight, parked on the stall).
      expect(srv.requests.length).toBeGreaterThan(0);

      // Cancel via the module's own clearDownload(): stops in-flight work first,
      // then deletes artifacts (OCDS §5.8 ordering).
      const clearPromise = api.clearDownload();

      // The in-flight run must terminate (it does not silently hang). It rejects
      // with "Download cancelled" / a transient wrap of the aborted request.
      await expect(runPromise).rejects.toBeDefined();
      await clearPromise;

      // In-flight stopped → isDownloading reset.
      expect((api as any).isDownloading).toBe(false);

      // Artifacts removed and NOT resurrected by the settling run.
      expect(fs.existsSync(partialPath)).toBe(false);
      expect(fs.existsSync(manifestPath)).toBe(false);
      // The whole download dir was wiped by clearDownload (then lazily
      // re-created empty by getDownloadDir); it must contain no leftover
      // artifacts for this dest.
      const leftovers = fs.existsSync(downloadDir())
        ? fs.readdirSync(downloadDir())
        : [];
      expect(leftovers.filter((n) => n.includes('202601080'))).toEqual([]);
    } finally {
      await srv.close();
    }
  });

  // OCDS-T11 — Two concurrent downloadBundle() for the same dest must JOIN one
  // in-flight run (single-flight), never co-write the same artifacts. The
  // single-flight de-dup lives in the public downloadBundle() (keyed on the dest
  // zip path) and is independent of the http/https routing. We keep
  // downloadBundle() (real single-flight) and downloadBundleConcurrent() (real
  // download) as production code; we only shim the internal http/https routing
  // method runDownloadBundle so the http test server reaches the concurrent
  // path. Asserting: both calls resolve to the SAME result object (joined, not
  // re-run) and exactly one set of segment requests happened (8 ranges, not 16).
  test('OCDS-T11: two concurrent downloadBundle() for same dest join one run (single-flight)', async () => {
    const srv = await startFaultServer(content);
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601110',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      // Spy that counts how many times the REAL concurrent download actually
      // ran. We route runDownloadBundle (the http/https selector) straight to
      // the real downloadBundleConcurrent so the http harness URL is accepted;
      // the single-flight join under test is entirely in downloadBundle().
      let concurrentRuns = 0;
      jest
        .spyOn(api as any, 'runDownloadBundle')
        .mockImplementation((p: any) => {
          concurrentRuns += 1;
          return (api as any).downloadBundleConcurrent(p, probe);
        });

      // Fire two downloadBundle() calls for the SAME dest concurrently.
      const p1 = api.downloadBundle(params as any);
      const p2 = api.downloadBundle(params as any);

      const [r1, r2] = await Promise.all([p1, p2]);

      // Joined: both calls resolve to the SAME result object — the second call
      // did not start its own run, it returned the in-flight run's value. (The
      // promise references differ only because downloadBundle is an `async`
      // function, so each call gets its own outer wrapper promise; the
      // load-bearing proof of single-flight is the shared resolved value plus
      // the single underlying run below, not wrapper-promise identity.)
      expect(r1).toBe(r2);

      // The underlying run executed exactly ONCE (de-duplicated).
      expect(concurrentRuns).toBe(1);

      // Final file is correct and verified.
      const downloadedFile = r1?.downloadedFile;
      expect(downloadedFile).toBeTruthy();
      expect(sha256(fs.readFileSync(downloadedFile as string))).toBe(
        expectedSha,
      );

      // Only ONE set of segment requests happened — no co-write / double fetch.
      // A single run fetches the 8 segments once; a second run would have
      // (re)requested ranges. Allow == SEGMENTS (no retries on the clean server).
      const uniqueRanges = new Set(srv.ranges.map(([s, e]) => `${s}-${e}`));
      expect(srv.ranges.length).toBe(SEGMENTS);
      expect(uniqueRanges.size).toBe(SEGMENTS);

      // The single-flight map de-duplicated and cleaned up on settle.
      expect((api as any).inflightDownloads.size).toBe(0);
    } finally {
      await srv.close();
    }
  });
});

// Poll until `cond()` is truthy or the deadline passes. Used to detect that an
// in-flight run has genuinely started before we cancel it (OCDS-T8), without
// re-implementing any production logic.
async function waitFor(
  cond: () => boolean,
  {
    timeoutMs = 5000,
    intervalMs = 10,
  }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-await-in-loop
  while (Date.now() < deadline) {
    if (cond()) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  if (!cond()) throw new Error('waitFor: condition not met before timeout');
}
