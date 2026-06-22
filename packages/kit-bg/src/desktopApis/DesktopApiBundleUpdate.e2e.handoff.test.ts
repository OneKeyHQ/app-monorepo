/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- e2e specs drive the real private download methods via `(api as any)` */
// End-to-end HANDOFF regression for the desktop bundle downloader (OCDS gap N3).
//
// The sibling e2e files assert the two ENDS of the concurrent->single-stream
// transition in isolation:
//   - DesktopApiBundleUpdate.e2e.failures.test.ts (OCDS-T3) asserts the
//     concurrent path THROWS a concurrentFallbackError on a 200-to-Range and
//     discards its artifacts — but stops at the throw.
//   - DesktopApiBundleUpdate.e2e.singlestream.test.ts asserts the single-stream
//     path succeeds — but is invoked directly, never reached via a fallback.
//
// Neither drives the REAL orchestrator (`runDownloadBundle`, the body behind the
// public `downloadBundle`) across the join: probe -> concurrent permanent
// fallback -> single-stream -> final file whose SHA matches. This file closes
// that gap by driving the production `downloadBundle` END-TO-END against ONE
// local server and asserting the transition COMPLETES: the single-stream leg
// runs, writes the file, and the on-disk SHA equals the expected SHA. The
// server range-log is the load-bearing proof of the handoff ORDER (probe 206 ->
// concurrent closed-Range gets a Permanent signal -> single-stream produces the
// body).
//
// `runDownloadBundle` HARD-ENFORCES `https://` at three gates (the http->
// single-stream short-circuit at the top of runDownloadBundle, probeBundleRange,
// and downloadBundleSingleStream's top guard). So — exactly like the
// singlestream e2e file — we run a real local HTTPS server with a self-signed
// cert and relax TLS verification for THIS process only
// (https.globalAgent rejectUnauthorized=false). The production code is
// unchanged: it really does `https.get(...)` against a real TLS socket.
//
// The jest.mock(...) block below is per-file (jest hoists jest.mock above
// imports), copied verbatim from the sibling e2e files / the harness
// JEST_MOCK_BLOCK.

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

import {
  USERDATA,
  cleanDownloadDir,
  downloadDir,
  makeApi,
  planParts,
  sha256,
} from './__e2e__/desktopBundleUpdateE2eHarness';

import type { AddressInfo } from 'net';

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

// ---------------------------------------------------------------------------
// Local self-signed HTTPS server that records each request's PHASE so the
// concurrent->single-stream handoff order can be asserted from the range-log.
//
// Phase is derived purely from the request shape the production code emits, so
// the assertions key off REAL behavior (not a test-only flag):
//   - PROBE: `Range: bytes=0-0`, NO If-Range  -> 206 (Content-Range 0-0/total)
//            => probeBundleRange sees supportsRange=true + total -> concurrent
//            is attempted.
//   - CONCURRENT SEGMENT: a closed `Range: bytes=s-e` carrying `If-Range`
//            (downloadBundlePart always sends If-Range when an ETag is known)
//            -> answered 200 (full body). The concurrent path treats 200-to-a-
//            Range as a Permanent signal -> concurrentFallbackError -> it
//            discards its .partial+manifest and the orchestrator falls back.
//   - SINGLE STREAM: the fallback leg starts fresh (the concurrent attempt
//            discarded its partial), so it sends NO Range header. We answer 200
//            with the full body; single-stream streams it to <file>.partial,
//            renames, and SHA-verifies.
//
// Only the single-stream (no-Range) request delivers the body that becomes the
// final file, so a correct final SHA PROVES the single-stream leg ran — the
// concurrent leg never wrote a usable byte (it only ever received 200s and
// discarded its artifacts).
// ---------------------------------------------------------------------------
const ETAG = '"e2e-handoff-etag-v1"';

type IPhase = 'probe' | 'concurrent-segment' | 'single-stream' | 'other';

interface IHandoffRequest {
  phase: IPhase;
  start: number | null;
  end: number | null;
  hasIfRange: boolean;
  statusSent: number;
}

interface IHandoffServer {
  url: string;
  log: IHandoffRequest[];
  close: () => Promise<void>;
}

function startHandoffServer(content: Buffer): Promise<IHandoffServer> {
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  );
  const log: IHandoffRequest[] = [];

  const server = https.createServer(
    { key: pems.private, cert: pems.cert },
    (req, res) => {
      const rangeHeader = req.headers.range;
      const ifRange = Array.isArray(req.headers['if-range'])
        ? req.headers['if-range'][0]
        : req.headers['if-range'];
      const hasIfRange = Boolean(ifRange);
      // Closed range `bytes=s-e` (probe + concurrent segments). The open-ended
      // single-stream resume `bytes=n-` would NOT match this regex, but the
      // fresh fallback sends no Range at all, so we never depend on it here.
      const m = /bytes=(\d+)-(\d+)/.exec(rangeHeader || '');
      const start = m ? Number(m[1]) : null;
      const end = m ? Number(m[2]) : null;

      const record = (phase: IPhase, statusSent: number) =>
        log.push({ phase, start, end, hasIfRange, statusSent });

      // No Range header -> the fresh single-stream fallback leg. Serve the full
      // body with 200; single-stream writes it to .partial then renames.
      if (start === null) {
        record('single-stream', 200);
        res.writeHead(200, {
          'Content-Length': content.length,
          ETag: ETAG,
          'Accept-Ranges': 'bytes',
        });
        res.end(content);
        return;
      }

      // Probe: `bytes=0-0` with no If-Range -> honest 206 so probeBundleRange
      // reports supportsRange=true and the total size, enabling the concurrent
      // attempt that we then force to fall back.
      if (!hasIfRange && start === 0 && end === 0) {
        record('probe', 206);
        const slice = content.subarray(0, 1);
        res.writeHead(206, {
          'Content-Range': `bytes 0-0/${content.length}`,
          'Content-Length': slice.length,
          'Accept-Ranges': 'bytes',
          ETag: ETAG,
        });
        res.end(slice);
        return;
      }

      // Any other closed Range (the concurrent segments carry If-Range) -> 200
      // full body. downloadBundlePart maps 200-to-a-Range to a Permanent
      // concurrentFallbackError, which drives the handoff.
      record('concurrent-segment', 200);
      res.writeHead(200, {
        'Content-Length': content.length,
        ETag: ETAG,
        'Accept-Ranges': 'bytes',
      });
      res.end(content);
    },
  );

  return new Promise<IHandoffServer>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `https://127.0.0.1:${port}/bundle.zip`,
        log,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

describe('DesktopApiBundleUpdate — concurrent->single-stream handoff e2e', () => {
  jest.setTimeout(30_000);

  // The real probe / single-stream legs open TLS sockets via https.get with no
  // explicit agent, so they use https.globalAgent. Relax cert verification on
  // THAT for the test process only; production code is unchanged. Restore after.
  let prevReject: boolean | undefined;
  beforeAll(() => {
    prevReject = https.globalAgent.options.rejectUnauthorized;
    https.globalAgent.options.rejectUnauthorized = false;
  });
  afterAll(() => {
    https.globalAgent.options.rejectUnauthorized = prevReject;
  });

  // 4 MiB: comfortably >= BUNDLE_MIN_CONCURRENT_BYTES (2 MiB), so the probe
  // result makes the orchestrator attempt the concurrent path (8 x 512 KiB).
  const TOTAL = 4 * 1024 * 1024;
  let content: Buffer;
  let expectedSha: string;

  beforeEach(() => {
    cleanDownloadDir();
    content = crypto.randomBytes(TOTAL);
    expectedSha = sha256(content);
  });

  // OCDS N3 (SPEC #3): the REAL `downloadBundle` orchestrator drives the FULL
  // transition. The concurrent attempt hits a Permanent 200-to-a-Range, falls
  // back THROUGH runDownloadBundle into the single-stream path, and the
  // single-stream leg produces a final file whose SHA matches end-to-end.
  test('downloadBundle: concurrent permanent fallback -> single-stream completes with correct SHA', async () => {
    const srv = await startHandoffServer(content);
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202603010',
        downloadUrl: srv.url,
        // fileSize is REQUIRED by the single-stream leg (the fallback target);
        // the concurrent leg derives its total from the probe instead.
        fileSize: TOTAL,
        sha256: expectedSha,
      };

      // Drive the REAL public entry point — NOT downloadBundleConcurrent /
      // downloadBundleSingleStream directly — so the whole runDownloadBundle
      // join (probe -> concurrent -> fallback -> single-stream) is exercised.
      const result = await (api as any).downloadBundle(params);

      // 1) End-to-end success: the final assembled file exists and its REAL SHA
      //    over the on-disk bytes matches. Because only the single-stream leg
      //    ever delivered a usable body, this asserts the HANDOFF completed —
      //    the concurrent leg alone could never have produced this file.
      const finalPath = path.join(downloadDir(), `1.0.0-202603010.zip`);
      expect(result.downloadedFile).toBe(finalPath);
      expect(fs.existsSync(finalPath)).toBe(true);
      const finalBuf = fs.readFileSync(finalPath);
      expect(finalBuf.length).toBe(TOTAL);
      expect(sha256(finalBuf)).toBe(expectedSha);

      // 2) Range-log proves the handoff ORDER. The probe came first (one 206 at
      //    bytes=0-0, no If-Range).
      const probes = srv.log.filter((r) => r.phase === 'probe');
      expect(probes.length).toBe(1);
      expect(probes[0].statusSent).toBe(206);
      expect(probes[0].start).toBe(0);
      expect(probes[0].end).toBe(0);

      // 3) >=1 concurrent SEGMENT was attempted (closed Range + If-Range) and
      //    every such request got the Permanent 200-to-a-Range signal that
      //    triggers the fallback. These segment requests prove the concurrent
      //    leg actually ran before the join — not just the probe.
      const segments = srv.log.filter((r) => r.phase === 'concurrent-segment');
      expect(segments.length).toBeGreaterThanOrEqual(1);
      expect(segments.every((r) => r.hasIfRange)).toBe(true);
      expect(segments.every((r) => r.statusSent === 200)).toBe(true);
      // Concurrent segments are closed windows from the 8-segment plan, i.e.
      // their starts are planned segment offsets (never an arbitrary byte).
      const plannedStarts = new Set(planParts(TOTAL).map((p) => p.start));
      expect(segments.every((r) => plannedStarts.has(r.start as number))).toBe(
        true,
      );

      // 4) The HANDOFF target ran: exactly one single-stream request (the fresh
      //    fallback leg sends NO Range header) delivered the full body that
      //    became the final file. This is the load-bearing "single-stream leg
      //    ran end-to-end" proof — without the transition there would be zero
      //    single-stream requests.
      const singleStream = srv.log.filter((r) => r.phase === 'single-stream');
      expect(singleStream.length).toBe(1);
      expect(singleStream[0].start).toBeNull();
      expect(singleStream[0].hasIfRange).toBe(false);
      expect(singleStream[0].statusSent).toBe(200);

      // 5) ORDER: the single-stream request is the LAST request, occurring
      //    strictly AFTER the probe and after every concurrent segment — i.e.
      //    the single-stream leg was reached BY the fallback, not before it.
      const ssIndex = srv.log.findIndex((r) => r.phase === 'single-stream');
      const lastSegmentIndex = srv.log
        .map((r, i) => (r.phase === 'concurrent-segment' ? i : -1))
        .reduce((a, b) => Math.max(a, b), -1);
      expect(ssIndex).toBe(srv.log.length - 1);
      expect(ssIndex).toBeGreaterThan(lastSegmentIndex);
      expect(ssIndex).toBeGreaterThan(
        srv.log.findIndex((r) => r.phase === 'probe'),
      );

      // 6) The concurrent leg left NO artifacts behind — it discarded its
      //    .partial+manifest on the Permanent fallback, so the only file on
      //    disk is the clean single-stream result (no stale .partial / manifest
      //    that a later resume could half-trust).
      expect(fs.existsSync(`${finalPath}.partial`)).toBe(false);
      expect(fs.existsSync(`${finalPath}.partial.progress.json`)).toBe(false);
    } finally {
      await srv.close();
    }
  });
});
