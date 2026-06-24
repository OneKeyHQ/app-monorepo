/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- e2e specs drive the real private download methods via `(api as any)` */
// End-to-end regression for the desktop SINGLE-STREAM bundle downloader.
//
// Drives the REAL `downloadBundleSingleStream` (open-ended-Range resume,
// 200-on-resume restart, SHA verify) against a local Range server. Unlike the
// concurrent path, `downloadBundleSingleStream` HARD-ENFORCES an `https://`
// URL at its top guard (and selects `reqProtocol` from the same string), so we
// cannot reach it with an http://localhost URL. We therefore run a real local
// HTTPS server with a self-signed cert and relax TLS verification ONLY for this
// test process (NODE_TLS_REJECT_UNAUTHORIZED=0). The production method itself
// is unchanged — it really does `https.get(...)` against a real TLS socket.
//
// Covers OCDS conformance scenarios:
//   - Single-stream resume: seed a truncated `.partial`, assert it resumes from
//     downloadedBytes via an open-ended `Range: bytes=<n>-` and the final SHA
//     is correct (the parts a pure unit test cannot exercise).
//   - OCDS G2 (200-on-resume restarts cleanly): server answers the resumed
//     request with 200 (full body); assert NO append corruption — the partial
//     is truncated/restarted and the final SHA is correct.
//   - OCDS-T10 (stall watchdog): DEFERRED — see the test body for the precise
//     reason (the stall timeout is a 60s module-level const that lives only in
//     the concurrent path, and is neither small enough nor injectable).
//
// The jest.mock(...) block below is per-file (jest hoists jest.mock above
// imports), copied verbatim from desktopBundleUpdateE2eHarness.ts JEST_MOCK_BLOCK.

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
// Local self-signed HTTPS Range server.
//
// `downloadBundleSingleStream` forces `https://` (line ~1106) AND derives
// `reqProtocol` from the same URL string, so an http URL cannot reach it. We
// give it a real TLS endpoint and relax cert verification for THIS process
// only. Records every requested open-ended `Range: bytes=<n>-` so resume can
// be asserted; `force200` makes the server ignore Range and reply 200 (the G2
// case).
// ---------------------------------------------------------------------------
const ETAG = '"e2e-ss-etag-v1"';

interface ISingleStreamServer {
  url: string;
  // Parsed resume offsets from every `Range: bytes=<n>-` request (null = no Range).
  rangeStarts: Array<number | null>;
  statusesSent: number[];
  close: () => Promise<void>;
}

function startHttpsRangeServer(
  content: Buffer,
  opts: { force200?: boolean } = {},
): Promise<ISingleStreamServer> {
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 1, keySize: 2048 },
  );
  const rangeStarts: Array<number | null> = [];
  const statusesSent: number[] = [];

  const server = https.createServer(
    { key: pems.private, cert: pems.cert },
    (req, res) => {
      const rangeHeader = req.headers.range;
      const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader || '');
      const start = m ? Number(m[1]) : null;
      rangeStarts.push(start);

      // G2: server ignores the resume Range and serves the whole body with 200.
      if (opts.force200 || start === null || start === 0) {
        statusesSent.push(200);
        res.writeHead(200, {
          'Content-Length': content.length,
          ETag: ETAG,
          'Accept-Ranges': 'bytes',
        });
        res.end(content);
        return;
      }

      // Honest open-ended resume: 206 with bytes from `start` to EOF.
      const slice = content.subarray(start);
      statusesSent.push(206);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${content.length - 1}/${
          content.length
        }`,
        'Content-Length': slice.length,
        'Accept-Ranges': 'bytes',
        ETag: ETAG,
      });
      res.end(slice);
    },
  );

  return new Promise<ISingleStreamServer>((resolve) => {
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

// Seed a TRUNCATED `.partial` (only the first `prefixBytes` correct bytes) for
// the single-stream resume model: the method reads `fs.statSync(partial).size`
// and resumes via `Range: bytes=<size>-`. (This differs from the concurrent
// seedResumeState helper, which writes a FULL-SIZE positioned-write partial.)
function seedSingleStreamPartial(opts: {
  appVersion: string;
  bundleVersion: string;
  content: Buffer;
  prefixBytes: number;
}): { partialPath: string; filePath: string } {
  const dir = downloadDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(
    dir,
    `${opts.appVersion}-${opts.bundleVersion}.zip`,
  );
  const partialPath = `${filePath}.partial`;
  fs.writeFileSync(partialPath, opts.content.subarray(0, opts.prefixBytes));
  return { partialPath, filePath };
}

describe('DesktopApiBundleUpdate — single-stream download e2e', () => {
  jest.setTimeout(30_000);

  // The single-stream method only routes through the SHA-verifying https path
  // for a real https server, which a self-signed cert would otherwise reject.
  // Production `https.get(url, opts)` passes no `agent`, so it uses
  // `https.globalAgent`; relax cert verification on THAT for the test process
  // only (the production code is unchanged — it still really opens a TLS socket
  // via https.get). We restore the prior value afterwards.
  let prevReject: boolean | undefined;
  beforeAll(() => {
    prevReject = https.globalAgent.options.rejectUnauthorized;
    https.globalAgent.options.rejectUnauthorized = false;
  });
  afterAll(() => {
    https.globalAgent.options.rejectUnauthorized = prevReject;
  });

  const TOTAL = 1 * 1024 * 1024; // 1 MiB — small (single-stream path).
  let content: Buffer;
  let expectedSha: string;

  beforeEach(() => {
    cleanDownloadDir();
    content = crypto.randomBytes(TOTAL);
    expectedSha = sha256(content);
  });

  test('Single-stream resume: open-ended Range from downloadedBytes + correct SHA', async () => {
    const prefixBytes = Math.floor(TOTAL * 0.4); // already-downloaded prefix
    seedSingleStreamPartial({
      appVersion: '1.0.0',
      bundleVersion: '202602010',
      content,
      prefixBytes,
    });

    const srv = await startHttpsRangeServer(content);
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202602010',
        downloadUrl: srv.url,
        fileSize: TOTAL,
        sha256: expectedSha,
      };
      const result = await (api as any).downloadBundleSingleStream(params);

      // Final assembled file is byte-correct.
      expect(fs.existsSync(result.downloadedFile)).toBe(true);
      expect(sha256(fs.readFileSync(result.downloadedFile))).toBe(expectedSha);

      // Resume proof: it sent EXACTLY one request, an open-ended Range starting
      // at the seeded prefix size (NOT a restart from 0).
      expect(srv.rangeStarts).toEqual([prefixBytes]);
      expect(srv.statusesSent).toEqual([206]);
    } finally {
      await srv.close();
    }
  });

  test('OCDS G2: 200-on-resume restarts cleanly (no append corruption) + correct SHA', async () => {
    const prefixBytes = Math.floor(TOTAL * 0.4);
    const { partialPath } = seedSingleStreamPartial({
      appVersion: '1.0.0',
      bundleVersion: '202602011',
      content,
      prefixBytes,
    });
    // Sanity: a partial really exists so the resume Range is sent.
    expect(fs.statSync(partialPath).size).toBe(prefixBytes);

    // Server ignores the Range and answers 200 with the FULL body. If the
    // method appended onto the existing partial it would produce
    // prefixBytes+TOTAL bytes and a wrong SHA. The production code truncates
    // the partial first (flags:'w', downloadedBytes=0) and restarts cleanly.
    const srv = await startHttpsRangeServer(content, { force200: true });
    try {
      const api = makeApi();
      const params = {
        latestVersion: '1.0.0',
        bundleVersion: '202602011',
        downloadUrl: srv.url,
        fileSize: TOTAL,
        sha256: expectedSha,
      };
      const result = await (api as any).downloadBundleSingleStream(params);

      // No append corruption: exact size + exact SHA of the clean full body.
      const finalBuf = fs.readFileSync(result.downloadedFile);
      expect(finalBuf.length).toBe(TOTAL);
      expect(sha256(finalBuf)).toBe(expectedSha);

      // It DID send the resume Range (the server chose to answer 200).
      expect(srv.rangeStarts).toEqual([prefixBytes]);
      expect(srv.statusesSent).toEqual([200]);
    } finally {
      await srv.close();
    }
  });

  // OCDS-T10 (stalled socket -> stall watchdog -> transient retry) is now
  // covered in DesktopApiBundleUpdate.e2e.failures.test.ts. The §5.4 stall
  // watchdog lives only in the concurrent per-segment path, so T10 is exercised
  // there against `downloadBundleConcurrent` using the now-injectable
  // `stallTimeoutMs` (200ms) — not on this single-stream file.
});
