/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- e2e specs drive the real private download methods via `(api as any)` */
// End-to-end FAILURE-MODE regression for the desktop concurrent downloader.
//
// Companion to DesktopApiBundleUpdate.e2e.test.ts (which covers the happy-path
// OCDS-T2). This file drives the REAL `downloadBundleConcurrent` against a local
// Range HTTP server configured to FAIL specific segments, and asserts the OCDS
// §4 failure-class recoveries:
//
//   OCDS-T1  the connection drops on one segment a few times -> only that
//            segment is re-fetched (retry in place, confined to its own
//            window); the other segments are each requested exactly once; final
//            SHA correct; no from-0 restart.
//   OCDS-T3  server answers 200 to a Range request -> Permanent -> the
//            concurrent run throws a concurrentFallbackError, and the on-disk
//            artifacts (.partial + manifest) are discarded.
//   OCDS-T4  429 (with Retry-After) then 206 on a segment -> Transient ->
//            backoff + retry + keep; eventual success; final SHA correct; no
//            from-0 restart.
//
// We drive the production private methods via (api as any) and never
// re-implement download logic. Server/seed/plan utilities come from the shared
// harness; the jest.mock block is copied verbatim from the sibling e2e test
// (jest.mock is per-file and hoisted, so it cannot be shared via the helper).

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  ETAG,
  USERDATA,
  cleanDownloadDir,
  downloadDir,
  makeApi,
  planParts,
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

// Production's module-private `isConcurrentFallback` keys off an error whose
// message is prefixed CONCURRENT_DOWNLOAD_FALLBACK. We pin THAT exact contract
// (the message prefix), not the wrapper error class, so the assertion cannot
// drift if production changes the error type.
const FALLBACK_PREFIX = 'CONCURRENT_DOWNLOAD_FALLBACK';
function isFallbackError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(FALLBACK_PREFIX);
}

describe('DesktopApiBundleUpdate — concurrent download failure-mode e2e', () => {
  jest.setTimeout(30_000);
  const TOTAL = 4 * 1024 * 1024; // 4 MiB -> 8 × 512 KiB segments
  let content: Buffer;
  let expectedSha: string;

  beforeEach(() => {
    cleanDownloadDir();
    content = crypto.randomBytes(TOTAL);
    expectedSha = sha256(content);
  });

  // OCDS-T1: the connection drops on one segment a few times. The transient drop
  // must be retried IN PLACE (within that segment's own window), the other 7
  // segments must be requested exactly once each, and there must be no from-0
  // restart of the whole file.
  test('OCDS-T1: connection drop re-fetches only the affected segment, no full restart', async () => {
    const parts = planParts(TOTAL);
    // Fault the LAST segment so the dropped window is unambiguous. Its `end`
    // uniquely identifies the segment across every resume attempt (each resume
    // keeps the same end but advances start), so target by end.
    const victim = parts[parts.length - 1];
    const DROPS = 2; // drop the connection twice, then serve cleanly
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'dropAfterBytesForRange',
        target: { end: victim.end },
        bytes: 0, // destroy the socket before any payload byte: a clean drop
        times: DROPS,
      },
    });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601020',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      // Integrity: assembled file is byte-correct.
      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);

      // Every non-victim segment was requested exactly once (its planned start),
      // i.e. no segment restarted from byte 0.
      for (const p of parts.filter((x) => x.index !== victim.index)) {
        const hits = srv.ranges.filter(([s]) => s === p.start);
        expect(hits).toEqual([[p.start, p.end]]);
      }

      // Victim segment: requested DROPS+1 times (each drop -> one transient
      // retry-in-place), all confined to the victim's own window [start,end].
      // The retries NEVER spill below the segment's planned start, i.e. the
      // segment resumes in place instead of any segment restarting from byte 0.
      const victimHits = srv.ranges.filter(([, e]) => e === victim.end);
      expect(victimHits.length).toBe(DROPS + 1);
      expect(victimHits.every(([s]) => s >= victim.start)).toBe(true);

      // No request anywhere restarted the whole file from byte 0 beyond the one
      // legitimate segment-0 fetch (the victim is the LAST segment, so byte 0 is
      // owned solely by segment 0 — any extra [0,*] hit would be a full restart).
      const fromZero = srv.ranges.filter(([s]) => s === 0);
      expect(fromZero).toEqual([[parts[0].start, parts[0].end]]);
    } finally {
      await srv.close();
    }
  });

  // OCDS-T3: the server answers 200 (full body) to a Range request. This is a
  // Permanent class signal -> the concurrent run must reject with a
  // concurrentFallbackError AND discard its on-disk artifacts (the .partial and
  // manifest) so the single-stream fallback starts clean.
  test('OCDS-T3: 200 to a Range request -> concurrentFallbackError thrown and artifacts discarded', async () => {
    // status200 targets ANY range request -> the first segment GET gets a 200.
    const srv = await startFaultServer(content, {
      mode: { kind: 'status200' },
    });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601021',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      let caught: unknown;
      try {
        await (api as any).downloadBundleConcurrent(params, probe);
      } catch (e) {
        caught = e;
      }

      // It threw, and it is the fallback class (Permanent -> fall back to
      // single-stream).
      expect(caught).toBeDefined();
      expect(isFallbackError(caught)).toBe(true);
      expect((caught as Error).message).toContain('200');

      // Permanent -> artifacts discarded: no final file, no .partial, no
      // manifest left behind for the dead concurrent attempt.
      const filePath = computeFinalFilePath(params);
      expect(fs.existsSync(filePath)).toBe(false);
      expect(fs.existsSync(`${filePath}.partial`)).toBe(false);
      expect(fs.existsSync(`${filePath}.partial.progress.json`)).toBe(false);
    } finally {
      await srv.close();
    }
  });

  // OCDS-T4: a segment gets a 429 (with Retry-After) on its first attempt, then
  // a 206 on the next. This is Transient -> back off (honoring Retry-After),
  // retry, KEEP artifacts, eventual success; the final SHA is correct and no
  // segment restarts from byte 0.
  test('OCDS-T4: 429+Retry-After then 206 -> backoff + retry succeeds, no restart from 0', async () => {
    const parts = planParts(TOTAL);
    // Fault one specific segment (the 2nd) once with a 429 carrying a short
    // Retry-After; the retry then succeeds (206) because the times budget is
    // spent. Target by end so it matches even if the request is re-issued.
    const victim = parts[1];
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'status429ThenOk',
        target: { end: victim.end },
        times: 1,
        retryAfter: '0', // 0s -> retry immediately, keeps the test fast
      },
    });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601022',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      // Integrity: assembled file is byte-correct.
      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);

      // The 429'd segment was retried (requested twice): once -> 429, once ->
      // 206. Both at its planned start (a 429 wrote nothing, so part.done stayed
      // 0 and the retry re-requests the same window) — that is a retry-in-place,
      // not a from-0 restart of the WHOLE file.
      const victimHits = srv.ranges.filter(([, e]) => e === victim.end);
      expect(victimHits.length).toBe(2);
      expect(victimHits.every(([s]) => s === victim.start)).toBe(true);

      // Every OTHER segment was requested exactly once at its planned start.
      for (const p of parts.filter((x) => x.index !== victim.index)) {
        const hits = srv.ranges.filter(([s]) => s === p.start);
        expect(hits).toEqual([[p.start, p.end]]);
      }

      // Resume proof: the whole file never restarted — segment 0 fetched once.
      const fromZero = srv.ranges.filter(([s]) => s === 0);
      expect(fromZero).toEqual([[parts[0].start, parts[0].end]]);
    } finally {
      await srv.close();
    }
  });

  // OCDS-T10: a segment's socket stalls (server sends the 206 headers then
  // holds, delivering no body). The §5.4 no-progress stall watchdog must fire,
  // destroy the request, and the segment is retried in place -> eventual
  // success, final SHA correct. The stall timeout is injected at 200ms so this
  // runs in well under a second instead of the 60s production default.
  test('OCDS-T10: stalled segment -> stall watchdog fires -> transient retry succeeds', async () => {
    const parts = planParts(TOTAL);
    const victim = parts[parts.length - 1];
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'stall',
        target: { end: victim.end },
        holdMs: 5000, // hold far longer than the 200ms watchdog so it fires first
        times: 1, // stall once; the retried request serves normally
      },
    });
    try {
      const api = makeApi({ stallTimeoutMs: 200 });
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601023',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      // Integrity after the stall + retry.
      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);

      // The stalled segment was requested at least twice (stall -> retry), both
      // within its own window (no from-0 restart of the whole file).
      const victimHits = srv.ranges.filter(([, e]) => e === victim.end);
      expect(victimHits.length).toBeGreaterThanOrEqual(2);
      expect(victimHits.every(([s]) => s >= victim.start)).toBe(true);
    } finally {
      await srv.close();
    }
  });
});

// The final destination path the production code computes from these params:
// <userData>/onekey-bundle-download/<appVersion>-<bundleVersion>.zip. Recomputed
// here (not imported from internals) only for the artifact-discard assertion.
function computeFinalFilePath(params: {
  latestVersion: string;
  bundleVersion: string;
}): string {
  return path.join(
    downloadDir(),
    `${params.latestVersion}-${params.bundleVersion}.zip`,
  );
}
