/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- e2e specs drive the real private download methods via `(api as any)` */
// End-to-end regression for OCDS gap N1 (SPEC #4): a 416 "Range Not
// Satisfiable" on a resume request is TRANSIENT, not Permanent.
//
// `classifyHttpStatus(416) === 'transient'` (DesktopApiBundleUpdate.ts) — a 416
// must NEVER discard the resumable bytes already on disk nor restart the whole
// file from byte 0. This file drives the REAL production methods against local
// Range servers configured to answer 416 a few times then recover, and asserts
// the OCDS §4 transient contract on BOTH download paths:
//
//   N1-A (concurrent): one segment is served 416 a few times, then 206.
//        416 is Transient -> the segment is retried IN PLACE (its own window,
//        never below its planned start), the surviving 7 segments are each
//        requested exactly once, the final assembled SHA is correct, and the
//        whole file never restarts from byte 0.
//
//   N1-B (single-stream resume): the server answers the open-ended resume
//        `Range: bytes=<n>-` with 416. The production code treats a 416 as
//        "the partial already holds every byte" -> it renames the partial to
//        the final file and verifies the SHA. We seed a FULL correct partial,
//        assert the recovery finalizes to a byte-correct file, and assert it
//        sent EXACTLY the one open-ended resume Range from downloadedBytes
//        (NOT a restart from 0).
//
// We drive the production private methods via (api as any) and never
// re-implement download logic. The concurrent server/seed/plan utilities come
// from the shared harness (status416 fault mode); the single-stream 416 case
// needs an open-ended Range (`bytes=<n>-`) the shared http fault server does
// not model, so it uses a dedicated local self-signed HTTPS server (same
// pattern as the single-stream e2e file, since downloadBundleSingleStream
// hard-enforces https://). The jest.mock block is copied verbatim from the
// sibling e2e tests (jest.mock is per-file and hoisted, so it cannot be shared
// via the helper).

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

// eslint-disable-next-line import/no-extraneous-dependencies
import selfsigned from 'selfsigned';

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
// N1-B local self-signed HTTPS server for the single-stream open-ended-Range
// 416 case.
//
// `downloadBundleSingleStream` forces `https://` AND resumes via an open-ended
// `Range: bytes=<n>-` (no closing offset), which the shared http fault server's
// `bytes=(\d+)-(\d+)` matcher does not model. This dedicated server answers the
// open-ended resume Range with 416 (Range Not Satisfiable) for the first
// `status416Times` requests — production reads that as "the partial already has
// every byte" and finalizes it. Records every parsed resume offset so the test
// can prove it sent the open-ended Range from downloadedBytes (not a from-0
// restart). We relax cert verification for THIS process only; the production
// code is unchanged — it really opens a TLS socket via https.get.
// ---------------------------------------------------------------------------
interface ISingleStream416Server {
  url: string;
  // Parsed resume offsets from every `Range: bytes=<n>-` request (null = none).
  rangeStarts: Array<number | null>;
  statusesSent: number[];
  close: () => Promise<void>;
}

function startHttps416ResumeServer(
  content: Buffer,
  opts: { status416Times: number },
): Promise<ISingleStream416Server> {
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  );
  const rangeStarts: Array<number | null> = [];
  const statusesSent: number[] = [];
  let remaining416 = opts.status416Times;

  const server = https.createServer(
    { key: pems.private, cert: pems.cert },
    (req, res) => {
      const rangeHeader = req.headers.range;
      // Single-stream resumes with an OPEN-ENDED range: `bytes=<n>-`.
      const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader || '');
      const start = m ? Number(m[1]) : null;
      rangeStarts.push(start);

      // A resume Range present + 416 budget remaining -> answer 416 Range Not
      // Satisfiable. Production treats this as "the partial holds every byte"
      // and finalizes the partial (rename + SHA verify) WITHOUT discarding it.
      if (start !== null && start > 0 && remaining416 > 0) {
        remaining416 -= 1;
        statusesSent.push(416);
        res.writeHead(416, {
          ETag: ETAG,
          'Content-Range': `bytes */${content.length}`,
        });
        res.end();
        return;
      }

      // Otherwise serve an honest open-ended 206 from `start` to EOF. (Only
      // reached if production retries past the 416 budget, which the transient
      // contract for THIS case does not — 416 finalizes immediately when a
      // partial is present. Kept so the server is well-formed.)
      const from = start ?? 0;
      const slice = content.subarray(from);
      statusesSent.push(206);
      res.writeHead(206, {
        'Content-Range': `bytes ${from}-${content.length - 1}/${
          content.length
        }`,
        'Content-Length': slice.length,
        'Accept-Ranges': 'bytes',
        ETag: ETAG,
      });
      res.end(slice);
    },
  );

  return new Promise<ISingleStream416Server>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `https://127.0.0.1:${port}/bundle.zip`,
        rangeStarts,
        statusesSent,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

// Seed a FULL-SIZE correct `.partial` for the single-stream 416-recovery model:
// a 416 means "you already have every byte", so the partial must already be the
// complete, byte-correct content for the rename+SHA-verify recovery to succeed.
function seedFullSingleStreamPartial(opts: {
  appVersion: string;
  bundleVersion: string;
  content: Buffer;
}): { partialPath: string; filePath: string } {
  const dir = downloadDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(
    dir,
    `${opts.appVersion}-${opts.bundleVersion}.zip`,
  );
  const partialPath = `${filePath}.partial`;
  fs.writeFileSync(partialPath, opts.content);
  return { partialPath, filePath };
}

describe('DesktopApiBundleUpdate — 416 transient (OCDS N1 / SPEC #4) e2e', () => {
  jest.setTimeout(30_000);

  // The single-stream method only routes through its SHA-verifying https path
  // for a real https server, which a self-signed cert would otherwise reject.
  // Production `https.get(url, opts)` passes no `agent`, so it uses
  // `https.globalAgent`; relax cert verification on THAT for the test process
  // only (production code unchanged — it still really opens a TLS socket).
  let prevReject: boolean | undefined;
  beforeAll(() => {
    prevReject = https.globalAgent.options.rejectUnauthorized;
    https.globalAgent.options.rejectUnauthorized = false;
  });
  afterAll(() => {
    https.globalAgent.options.rejectUnauthorized = prevReject;
  });

  beforeEach(() => {
    cleanDownloadDir();
  });

  // N1-A: a single segment is served 416 a few times, then 206. 416 is
  // Transient (classifyHttpStatus 416 -> 'transient' -> httpStatusError yields a
  // plain retryable Error, NOT a concurrentFallbackError). The segment must be
  // retried IN PLACE within its own window, the surviving segments untouched
  // (exactly one request each), the final SHA correct, and NO from-0 restart.
  test('N1-A concurrent: 416 a few times on one segment -> transient retry-in-place, survivors kept, recovers 206, correct SHA, no restart from 0', async () => {
    const TOTAL = 4 * 1024 * 1024; // 4 MiB -> 8 × 512 KiB segments
    const content = crypto.randomBytes(TOTAL);
    const expectedSha = sha256(content);

    const parts = planParts(TOTAL);
    // Fault the LAST segment so its window is unambiguous: its `end` uniquely
    // identifies the segment across every resume attempt (resume keeps the same
    // end). 416 TIMES below the §5.4 retry budget (BUNDLE_PART_MAX_RETRY=3) so
    // the retried request recovers (206).
    const victim = parts[parts.length - 1];
    const STATUS416_TIMES = 2; // "a few times", then recover
    const srv = await startFaultServer(content, {
      mode: {
        kind: 'status416',
        target: { end: victim.end },
        times: STATUS416_TIMES,
      },
    });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202602050',
        downloadUrl: srv.url,
        sha256: expectedSha,
      };
      const probe = { finalUrl: srv.url, totalBytes: TOTAL, etag: ETAG };
      const result = await (api as any).downloadBundleConcurrent(params, probe);

      // Integrity: REAL SHA over the REAL assembled file matches.
      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);

      // Survivors kept: every non-victim segment was requested EXACTLY once at
      // its planned start — i.e. the 416 on the victim did not discard or
      // re-fetch any other segment, and nothing restarted from byte 0.
      for (const p of parts.filter((x) => x.index !== victim.index)) {
        const hits = srv.ranges.filter(([s]) => s === p.start);
        expect(hits).toEqual([[p.start, p.end]]);
      }

      // 416 is TRANSIENT -> retry-in-place: the victim was requested
      // STATUS416_TIMES+1 times (each 416 -> one transient retry, then the 206),
      // and EVERY request stayed within the victim's own window (start never
      // dipped below its planned start). A 416 writes no body, so part.done
      // stayed 0 and each retry re-requested the SAME [start,end] window.
      const victimHits = srv.ranges.filter(([, e]) => e === victim.end);
      expect(victimHits.length).toBe(STATUS416_TIMES + 1);
      expect(victimHits.every(([s]) => s === victim.start)).toBe(true);

      // 416 proof on the appliedMode log: the victim window really received the
      // status416 fault exactly STATUS416_TIMES (then the recovery 206 with no
      // fault). This pins that the path under test was the 416 branch, not some
      // other transient class.
      const victim416Applied = srv.requests.filter(
        (r) => r.end === victim.end && r.appliedMode === 'status416',
      );
      expect(victim416Applied.length).toBe(STATUS416_TIMES);

      // No from-0 restart of the WHOLE file: byte 0 is owned solely by segment 0
      // (the victim is the LAST segment), so the only [0,*] hit is segment 0's
      // single legitimate fetch. Any extra would be a full restart.
      const fromZero = srv.ranges.filter(([s]) => s === 0);
      expect(fromZero).toEqual([[parts[0].start, parts[0].end]]);
    } finally {
      await srv.close();
    }
  });

  // N1-B: the single-stream resume request (open-ended `Range: bytes=<n>-`) is
  // answered 416. Production reads a 416-with-partial as "the partial already
  // holds every byte" and finalizes it (rename partial -> final + SHA verify)
  // WITHOUT discarding the on-disk bytes or restarting from 0. We seed a FULL
  // correct partial, assert the recovery yields a byte-correct file, and assert
  // it sent EXACTLY one open-ended resume Range from downloadedBytes.
  test('N1-B single-stream: 416 on the open-ended resume Range -> partial finalized, correct SHA, no restart from 0', async () => {
    const TOTAL = 1 * 1024 * 1024; // 1 MiB — small (single-stream path)
    const content = crypto.randomBytes(TOTAL);
    const expectedSha = sha256(content);

    // Seed the COMPLETE correct partial: a 416 means there is nothing more to
    // fetch, so the recovery just finalizes these exact bytes.
    const { partialPath } = seedFullSingleStreamPartial({
      appVersion: '1.0.0',
      bundleVersion: '202602051',
      content,
    });
    // Sanity: the resume offset the open-ended Range will carry == TOTAL.
    expect(fs.statSync(partialPath).size).toBe(TOTAL);

    const srv = await startHttps416ResumeServer(content, { status416Times: 1 });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202602051',
        downloadUrl: srv.url,
        fileSize: TOTAL,
        sha256: expectedSha,
      };
      const result = await (api as any).downloadBundleSingleStream(params);

      // 416 recovery finalized the partial: REAL SHA over the REAL assembled
      // file matches, and it is exactly TOTAL bytes (no append corruption, no
      // discard).
      const finalBuf = fs.readFileSync(result.downloadedFile);
      expect(finalBuf.length).toBe(TOTAL);
      expect(sha256(finalBuf)).toBe(expectedSha);

      // The 416 was treated as TRANSIENT-recoverable, NOT a hard failure: the
      // partial was renamed to the final file (so the partial is gone).
      expect(fs.existsSync(partialPath)).toBe(false);

      // No restart from 0: it sent EXACTLY one request, an open-ended resume
      // Range starting at the full downloadedBytes (TOTAL), and that request was
      // the 416 — never a fresh `bytes=0-` whole-file restart.
      expect(srv.rangeStarts).toEqual([TOTAL]);
      expect(srv.statusesSent).toEqual([416]);
    } finally {
      await srv.close();
    }
  });
});
