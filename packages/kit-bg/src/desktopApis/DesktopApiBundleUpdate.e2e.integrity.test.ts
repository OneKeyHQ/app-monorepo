/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- e2e specs drive the real private download methods via `(api as any)` */
// End-to-end integrity regression for the desktop concurrent downloader.
//
// Drives the REAL `downloadBundleConcurrent` (8-range, positioned-write,
// manifest resume, SHA verify) against the shared local Range HTTP fault
// server. These scenarios exercise the §5.5 integrity guards and the §6
// terminal-failure boundary that pure unit tests cannot reach end-to-end:
//
//   OCDS-T5  Mis-aligned / short / over-long 206 → rejected, NO cross-segment
//            corruption. (a) Content-Range window != requested → rejected +
//            clean fallback. (b) over-long body → clamped to part.end, neighbour
//            not overrun, clean fallback. (c) short body → transient retry
//            resumes the tail, final SHA is correct.
//   OCDS-T6  Corrupted assembly → whole-file checksum mismatch → terminal
//            (rejects with a SHA mismatch error) and does NOT loop forever — a
//            single call returns/throws in bounded wall-clock time.
//
// Server/plan/sha/seed setup lives in the shared harness. The jest.mock(...)
// block below is per-file (jest hoists jest.mock above imports), copied verbatim
// from DesktopApiBundleUpdate.e2e.test.ts / the harness's JEST_MOCK_BLOCK.

import crypto from 'crypto';
import fs from 'fs';

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

describe('DesktopApiBundleUpdate — concurrent download integrity e2e', () => {
  jest.setTimeout(30_000);
  const TOTAL = 4 * 1024 * 1024; // 4 MiB → 8 × 512 KiB segments
  let content: Buffer;
  let expectedSha: string;

  beforeEach(() => {
    cleanDownloadDir();
    content = crypto.randomBytes(TOTAL);
    expectedSha = sha256(content);
  });

  const makeParams = (bundleVersion: string, downloadUrl: string) => ({
    latestVersion: '1.0.0',
    bundleVersion,
    downloadUrl,
    sha256: expectedSha,
  });

  const partialPathFor = (bundleVersion: string) =>
    `${downloadDir()}/1.0.0-${bundleVersion}.zip.partial`;
  const finalPathFor = (bundleVersion: string) =>
    `${downloadDir()}/1.0.0-${bundleVersion}.zip`;

  // ---------------------------------------------------------------------------
  // OCDS-T5 (a): a 206 whose Content-Range window != the requested range is
  // rejected (§5.5). The whole run falls back cleanly: it throws a Permanent
  // CONCURRENT_DOWNLOAD_FALLBACK error and the stale partial/manifest are
  // discarded (no silent corruption left on disk, no final file promoted).
  // ---------------------------------------------------------------------------
  test('OCDS-T5(a): misaligned 206 Content-Range → rejected, clean fallback, no corruption', async () => {
    const parts = planParts(TOTAL);
    const target = parts[3]; // fault exactly one middle segment
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'misalignedContentRange',
        target: { start: target.start, end: target.end },
      },
    });
    try {
      const bundleVersion = '202605051';
      const api = makeApi();
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      await expect(
        (api as any).downloadBundleConcurrent(
          makeParams(bundleVersion, srv.url),
          probe,
        ),
      ).rejects.toThrow(/CONCURRENT_DOWNLOAD_FALLBACK/);

      // No silent corruption: no final file promoted, and the discarded
      // partial/manifest are gone (fallback wiped the unusable bytes).
      expect(fs.existsSync(finalPathFor(bundleVersion))).toBe(false);
      expect(fs.existsSync(partialPathFor(bundleVersion))).toBe(false);
      expect(
        fs.existsSync(`${partialPathFor(bundleVersion)}.progress.json`),
      ).toBe(false);
    } finally {
      await srv.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OCDS-T5 (b): an over-long 206 body (more bytes than the requested window) is
  // clamped to part.end — it never overruns the neighbour segment — then the run
  // rejects Permanent (§5.5 over-long guard) and falls back cleanly. We target a
  // NON-last segment so the over-long bytes would land in the neighbour's region
  // if the guard were missing; assert no final file (no corrupt assembly) and
  // the partial/manifest discarded.
  // ---------------------------------------------------------------------------
  test('OCDS-T5(b): over-long 206 body → clamped to part.end, no neighbour overrun, clean fallback', async () => {
    const parts = planParts(TOTAL);
    const target = parts[2]; // middle segment → neighbour (parts[3]) follows it
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'overLongBody',
        target: { start: target.start, end: target.end },
        // 64 KiB past the planned end — would spill into the neighbour region.
        extra: 64 * 1024,
      },
    });
    try {
      const bundleVersion = '202605052';
      const api = makeApi();
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      await expect(
        (api as any).downloadBundleConcurrent(
          makeParams(bundleVersion, srv.url),
          probe,
        ),
      ).rejects.toThrow(/CONCURRENT_DOWNLOAD_FALLBACK/);

      // The over-long body did not corrupt the assembly: no final file exists,
      // and the unusable partial/manifest were discarded on fallback. (The
      // production guard clamps the write to part.end BEFORE rejecting, so the
      // neighbour's region was never written by this segment.)
      expect(fs.existsSync(finalPathFor(bundleVersion))).toBe(false);
      expect(fs.existsSync(partialPathFor(bundleVersion))).toBe(false);
    } finally {
      await srv.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OCDS-T5 (c): a short 206 body — the server advertises the full segment
  // window but delivers only a prefix before the socket closes — is a Transient
  // interruption (§5.5 short-body guard / §5.4). The bytes already written are
  // kept on disk and the missing tail is re-fetched in place. With a `times: 1`
  // budget the fault fires once; the retry resumes from the persisted cursor and
  // the assembled file's whole-file SHA is correct (no corruption).
  //
  // The short delivery is produced by `dropAfterBytesForRange` (send a prefix,
  // then destroy the socket) rather than a Content-Length-mismatch close: a
  // hard socket teardown is a deterministic transient drop, whereas a framing
  // mismatch leaves the close ordering up to the HTTP client and can race the
  // retry. Both are "a short body that resumes the tail"; this one is stable.
  // ---------------------------------------------------------------------------
  test('OCDS-T5(c): short 206 body → transient retry resumes the tail, final SHA correct', async () => {
    const parts = planParts(TOTAL);
    const target = parts[5];
    const segLen = target.end - target.start + 1;
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'dropAfterBytesForRange',
        target: { start: target.start, end: target.end },
        // Deliver all but the last 4 KiB, then drop the socket → short body.
        bytes: segLen - 4096,
        times: 1,
      },
    });
    try {
      const bundleVersion = '202605053';
      const api = makeApi();
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      const result = await (api as any).downloadBundleConcurrent(
        makeParams(bundleVersion, srv.url),
        probe,
      );

      // Corrected retry → final file present and SHA matches.
      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);
      // Resume proof: the faulted segment ([target.start, target.end]) was
      // requested at least twice — the initial (short) GET ending at target.end,
      // then a tail GET whose window starts ABOVE target.start (resumed from the
      // persisted cursor, not restarted at the segment head).
      const segmentReqs = srv.ranges.filter(([, e]) => e === target.end);
      expect(segmentReqs.length).toBeGreaterThanOrEqual(2);
      const tailResume = segmentReqs.some(([s]) => s > target.start);
      expect(tailResume).toBe(true);
    } finally {
      await srv.close();
    }
  });

  // ---------------------------------------------------------------------------
  // OCDS-T6: a segment serves corrupt-but-correctly-shaped bytes (right length +
  // window, wrong payload). The window/length guards pass, the file assembles,
  // but the whole-file SHA256 verify fails. The single downloadBundleConcurrent
  // call must reject with a SHA mismatch error and NOT loop forever — it returns
  // in bounded wall-clock time. (The §5.5/§6 once-via-single-stream retry is the
  // OUTER caller's job; one concurrent call is terminal for the bad assembly.)
  // ---------------------------------------------------------------------------
  test('OCDS-T6: corrupted assembly → SHA mismatch terminal, bounded time, no infinite loop', async () => {
    const parts = planParts(TOTAL);
    const target = parts[1];
    const srv = await startFaultServer(content, {
      // No `times` budget → the corruption persists across any in-place retry,
      // so this is a genuinely-corrupt object (the wrong bytes never heal).
      mode: {
        kind: 'wrongBytes',
        target: { start: target.start, end: target.end },
      },
    });
    try {
      const bundleVersion = '202605054';
      const api = makeApi();
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };

      const startedAt = Date.now();
      await expect(
        (api as any).downloadBundleConcurrent(
          makeParams(bundleVersion, srv.url),
          probe,
        ),
      ).rejects.toThrow(/SHA256/);
      const elapsed = Date.now() - startedAt;

      // Bounded: a single call returned/threw well under the test timeout — it
      // did not spin re-downloading forever.
      expect(elapsed).toBeLessThan(20_000);
      // The bad assembly was discarded (no corrupt final file promoted).
      expect(fs.existsSync(finalPathFor(bundleVersion))).toBe(false);
    } finally {
      await srv.close();
    }
  });
});
