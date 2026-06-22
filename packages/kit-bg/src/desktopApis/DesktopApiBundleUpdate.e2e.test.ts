/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- e2e specs drive the real private download methods via `(api as any)` */
// End-to-end regression for the desktop concurrent downloader.
//
// Drives the REAL `downloadBundleConcurrent` (8-range, positioned-write,
// manifest resume, SHA verify) against a local HTTP server with proper Range
// support. The public entry enforces https:// and routes http:// to
// single-stream, so we call the internal concurrent method directly with an
// http://localhost URL (it picks http/https by URL via reqProtocol).
//
// Covers OCDS conformance scenario T2 (the parts that pure unit tests cannot):
//   1. full concurrent download assembles + verifies SHA256 end-to-end;
//   2. resume re-fetches ONLY the missing segments (no restart from byte 0).
//
// Server/plan/sha/seed setup lives in the shared harness so the other scenario
// files do not duplicate it. The jest.mock(...) block below is per-file (jest
// hoists jest.mock above imports), copied from the harness's JEST_MOCK_BLOCK.

import crypto from 'crypto';
import fs from 'fs';

import {
  ETAG,
  SEGMENTS,
  USERDATA,
  cleanDownloadDir,
  downloadDir,
  makeApi,
  seedResumeState,
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

describe('DesktopApiBundleUpdate — concurrent download e2e', () => {
  jest.setTimeout(30_000);
  const TOTAL = 4 * 1024 * 1024; // 4 MiB → 8 × 512 KiB segments
  let content: Buffer;
  let expectedSha: string;

  beforeEach(() => {
    cleanDownloadDir();
    content = crypto.randomBytes(TOTAL);
    expectedSha = sha256(content);
  });

  test('OCDS-T2: full concurrent download assembles and verifies SHA256', async () => {
    const srv = await startFaultServer(content);
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601010',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);
      // every byte covered → all 8 segment ranges were requested
      expect(srv.ranges.length).toBeGreaterThanOrEqual(SEGMENTS);
    } finally {
      await srv.close();
    }
  });

  test('OCDS-T2: resume re-fetches only the missing segments (no restart from 0)', async () => {
    const srv = await startFaultServer(content);
    try {
      // Seed a half-finished run: segments 0..4 already complete (correct bytes
      // on disk + done=segLen), segments 5..7 not started (zeros + done=0).
      const { splitAt } = seedResumeState({
        dir: downloadDir(),
        appVersion: '1.0.0',
        bundleVersion: '202601011',
        content,
        completedThrough: 4,
      });

      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202601011',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      // correct final file
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);
      // resume proof: NOTHING below the split (segments 0..4) was re-requested
      const reRequestedBelowSplit = srv.ranges.filter(([s]) => s < splitAt);
      expect(reRequestedBelowSplit).toEqual([]);
      // and the tail WAS fetched
      expect(srv.ranges.some(([s]) => s >= splitAt)).toBe(true);
    } finally {
      await srv.close();
    }
  });
});
