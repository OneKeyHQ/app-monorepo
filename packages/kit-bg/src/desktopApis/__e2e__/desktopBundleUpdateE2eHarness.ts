// Reusable e2e harness for the desktop concurrent bundle downloader (OCDS).
//
// The harness drives the REAL exported/production code in
// `../DesktopApiBundleUpdate.ts` — it never re-implements download logic. Each
// scenario file calls the private methods via
// `(api as any).downloadBundleConcurrent` / `downloadBundleSingleStream` and
// asserts on-disk + recorded-range behavior.
//
// What this file provides:
//   - `USERDATA` dir constant (mirrors the value the jest.mock('electron') block
//     in each scenario must point `app.getPath` at).
//   - `sha256(buf)` real SHA256.
//   - `planParts(total)` — mirrors the production 8-segment plan so a scenario
//     can compute segment boundaries for seeding/assertions.
//   - `makeApi()` — a fresh DesktopApiAppBundleUpdate instance.
//   - `seedResumeState(...)` — writes a half-finished `.partial` +
//     `.partial.progress.json` manifest (parts 0..k done, rest done=0) so a
//     resume run re-fetches only the missing tail.
//   - `startFaultServer(content, opts)` — a configurable local Range (206) HTTP
//     server with fault MODES the §6 scenarios need (drop-mid-range, 200,
//     429-then-OK, 5xx, misaligned/over-long/short body, multipart, stall,
//     wrongBytes, Retry-After). Faults can target a specific [start,end] range
//     so a scenario fails exactly one segment. Honors If-Range/ETag.
//
// IMPORTANT: jest.mock(...) calls are NOT in this file. jest.mock hoists per
// test file, so each scenario file must copy the mock block verbatim (see
// `JEST_MOCK_BLOCK` below) — it points the mocked `electron.app.getPath` at
// `USERDATA`, which is what this harness's path helpers assume.

import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

import type DesktopApiAppBundleUpdate from '../DesktopApiBundleUpdate';
import type { AddressInfo } from 'net';

// ---------------------------------------------------------------------------
// Constants mirrored from the production module
// (BUNDLE_SEGMENT_COUNT, the download-dir name). Kept here so scenarios share
// one source of truth without importing the private internals.
// ---------------------------------------------------------------------------
export const SEGMENTS = 8;
export const ETAG = '"e2e-etag-v1"';
export const DOWNLOAD_DIR_NAME = 'onekey-bundle-download';

// The userData root the mocked `electron.app.getPath('userData')` must return.
// Each scenario's jest.mock('electron') block resolves getPath to this value.
export const USERDATA = path.join(os.tmpdir(), 'ocds-e2e-userdata');

// The exact jest.mock(...) block each scenario file must copy near the TOP of
// the file (jest hoists jest.mock above imports per-file; it cannot live in a
// shared helper). The mocks are intentionally minimal: real electron app path +
// real SHA256 so the integrity assertion is genuine, everything else stubbed.
//
// Usage in a scenario file:
//   import { USERDATA } from './__e2e__/desktopBundleUpdateE2eHarness';
//   // then paste JEST_MOCK_BLOCK's contents (it references USERDATA).
export const JEST_MOCK_BLOCK = `// --- Mock the Electron / desktop-app deps so the module loads under node-jest.
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
  const sha = (p) =>
    c.createHash('sha256').update(f.readFileSync(p)).digest('hex');
  return {
    verifySha256: (p, expected) =>
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
}));`;

export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export interface IPlannedPart {
  index: number;
  start: number;
  end: number;
  done: number;
}

// Mirrors loadOrInitManifest's segmentation EXACTLY: ceil-chunk over 8 segments,
// last segment absorbs the remainder, segments past EOF are dropped. Scenarios
// use this to compute boundaries for seeding resume state and to target faults.
export function planParts(total: number): IPlannedPart[] {
  const chunk = Math.ceil(total / SEGMENTS);
  const parts: IPlannedPart[] = [];
  for (let i = 0; i < SEGMENTS; i += 1) {
    const start = i * chunk;
    if (start >= total) break;
    const end = Math.min(start + chunk - 1, total - 1);
    parts.push({ index: parts.length, start, end, done: 0 });
  }
  return parts;
}

// Absolute path to the download dir the production code computes
// (getDownloadDir()): <userData>/onekey-bundle-download. Scenarios use it to
// seed/inspect artifacts.
export function downloadDir(): string {
  return path.join(USERDATA, DOWNLOAD_DIR_NAME);
}

// Wipe the per-test download dir so each scenario starts clean (call in
// beforeEach). Mirrors what the original test did inline.
export function cleanDownloadDir(): void {
  fs.rmSync(downloadDir(), { recursive: true, force: true });
}

// A fresh production downloader instance. The require is deferred so the
// scenario's jest.mock(...) hoisted block is already in effect.
export function makeApi(opts?: {
  stallTimeoutMs?: number;
}): DesktopApiAppBundleUpdate {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const Mod = require('../DesktopApiBundleUpdate')
    .default as typeof DesktopApiAppBundleUpdate;
  return new Mod({ desktopApi: {} as any, ...opts });
}

// Seed a half-finished concurrent run on disk so a resume run (OCDS §5.3 /
// scenario 2) re-fetches ONLY the missing tail. Writes:
//   - <dir>/<appVersion>-<bundleVersion>.zip.partial: a full-size buffer with
//     the CORRECT bytes for every part whose index <= completedThrough and
//     zeros for the unfinished tail.
//   - <...>.partial.progress.json: the manifest with done=segLen for parts
//     0..completedThrough and done=0 for the rest.
// Returns the computed paths + split offset (first byte of the first
// unfinished segment) for assertions.
export function seedResumeState(opts: {
  dir: string;
  appVersion: string;
  bundleVersion: string;
  content: Buffer;
  completedThrough: number; // last fully-done part index (inclusive)
  etag?: string;
}): {
  filePath: string;
  partialPath: string;
  manifestPath: string;
  splitAt: number;
  parts: IPlannedPart[];
} {
  const {
    dir,
    appVersion,
    bundleVersion,
    content,
    completedThrough,
    etag = ETAG,
  } = opts;
  const total = content.length;
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${appVersion}-${bundleVersion}.zip`);
  const partialPath = `${filePath}.partial`;
  const manifestPath = `${partialPath}.progress.json`;

  const parts = planParts(total);
  // The first byte that is NOT covered by a completed segment.
  const firstUnfinished = parts.find((p) => p.index > completedThrough);
  const splitAt = firstUnfinished ? firstUnfinished.start : total;

  // Full-size partial: correct bytes below splitAt, zeros above.
  const partial = Buffer.alloc(total);
  content.copy(partial, 0, 0, splitAt);
  fs.writeFileSync(partialPath, partial);

  const seededParts = parts.map((p) => ({
    ...p,
    done: p.index <= completedThrough ? p.end - p.start + 1 : 0,
  }));
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ etag, size: total, parts: seededParts }),
  );

  return { filePath, partialPath, manifestPath, splitAt, parts };
}

// ---------------------------------------------------------------------------
// Fault server
// ---------------------------------------------------------------------------

export type IFaultMode =
  // Map a Range request to a non-206 status for a number of times.
  | { kind: 'status200'; target?: IRangeTarget; times?: number }
  | {
      kind: 'status429ThenOk';
      target?: IRangeTarget;
      times?: number;
      retryAfter?: string;
    }
  | {
      kind: 'status5xx';
      target?: IRangeTarget;
      status?: number;
      times?: number;
      retryAfter?: string;
    }
  | { kind: 'status404'; target?: IRangeTarget; times?: number }
  | { kind: 'status416'; target?: IRangeTarget; times?: number }
  // Body-shape faults on a 206 response.
  | {
      kind: 'dropAfterBytesForRange';
      target?: IRangeTarget;
      bytes: number;
      times?: number;
    }
  | {
      kind: 'shortBody';
      target?: IRangeTarget;
      missingTail: number;
      times?: number;
    }
  | {
      kind: 'overLongBody';
      target?: IRangeTarget;
      extra: number;
      times?: number;
    }
  | { kind: 'wrongBytes'; target?: IRangeTarget; times?: number }
  // Content-Range / Content-Type faults on a 206 response.
  | { kind: 'misalignedContentRange'; target?: IRangeTarget; times?: number }
  | { kind: 'multipartByteranges'; target?: IRangeTarget; times?: number }
  // Hold the socket open and send nothing (stall watchdog).
  | { kind: 'stall'; target?: IRangeTarget; holdMs?: number; times?: number };

// Targets a specific requested window. When omitted, the fault applies to ANY
// range request. `startGte` lets a scenario fault "the tail" (segments at or
// after a byte offset) without naming exact bounds.
export interface IRangeTarget {
  start?: number;
  end?: number;
  startGte?: number;
}

export interface IFaultServerOpts {
  etag?: string;
  // Initial fault mode (also settable later via setMode).
  mode?: IFaultMode | null;
  // When false the server does NOT honor If-Range (always 206 even on ETag
  // mismatch). Default true.
  honorIfRange?: boolean;
}

export interface IFaultServerHandle {
  url: string;
  ranges: Array<[number, number]>;
  // Full request log: method, range header, parsed [start,end], applied fault.
  requests: Array<{
    range: string | undefined;
    start: number | null;
    end: number | null;
    ifRange: string | undefined;
    appliedMode: IFaultMode['kind'] | null;
  }>;
  setMode: (mode: IFaultMode | null) => void;
  close: () => Promise<void>;
}

function rangeMatchesTarget(
  target: IRangeTarget | undefined,
  start: number,
  end: number,
): boolean {
  if (!target) return true;
  if (target.startGte !== undefined && start < target.startGte) return false;
  if (target.start !== undefined && target.start !== start) return false;
  if (target.end !== undefined && target.end !== end) return false;
  return true;
}

// A configurable local Range (206) HTTP server. Records every requested
// [start,end] and supports the fault MODES the §6 scenarios need. A fault can
// target a specific byte-range so a scenario fails exactly one segment; faults
// with a `times` budget auto-expire so the retried request succeeds (so e.g.
// 429-then-OK actually completes).
export function startFaultServer(
  content: Buffer,
  opts: IFaultServerOpts = {},
): Promise<IFaultServerHandle> {
  const etag = opts.etag ?? ETAG;
  const honorIfRange = opts.honorIfRange ?? true;
  let mode: IFaultMode | null = opts.mode ?? null;
  // Per-mode remaining application budget (the `times` field). Reset whenever
  // setMode installs a new mode object.
  let remaining: number = mode?.times ?? Infinity;

  const ranges: Array<[number, number]> = [];
  const requests: IFaultServerHandle['requests'] = [];

  const setMode = (m: IFaultMode | null) => {
    mode = m;
    remaining = m?.times ?? Infinity;
  };

  const send200 = (res: http.ServerResponse) => {
    res.writeHead(200, {
      'Content-Length': content.length,
      ETag: etag,
      'Accept-Ranges': 'bytes',
    });
    res.end(content);
  };

  const server = http.createServer((req, res) => {
    const rangeHeader = req.headers.range;
    const ifRange = Array.isArray(req.headers['if-range'])
      ? req.headers['if-range'][0]
      : req.headers['if-range'];
    const m = /bytes=(\d+)-(\d+)/.exec(rangeHeader || '');

    // No Range header → whole-body request (the production probe sends
    // bytes=0-0, so this branch is mainly the single-stream / no-range path).
    if (!m) {
      requests.push({
        range: rangeHeader,
        start: null,
        end: null,
        ifRange,
        appliedMode: null,
      });
      send200(res);
      return;
    }

    const start = Number(m[1]);
    const end = Number(m[2]);
    ranges.push([start, end]);

    // If-Range mismatch → server must answer 200 (full body), which the
    // concurrent path treats as a Permanent fallback signal (OCDS §5.5).
    if (honorIfRange && ifRange && ifRange !== etag) {
      requests.push({
        range: rangeHeader,
        start,
        end,
        ifRange,
        appliedMode: null,
      });
      send200(res);
      return;
    }

    // Decide whether the active fault applies to THIS request.
    const active =
      mode && remaining > 0 && rangeMatchesTarget(mode.target, start, end)
        ? mode
        : null;
    if (active) remaining -= 1;

    requests.push({
      range: rangeHeader,
      start,
      end,
      ifRange,
      appliedMode: active?.kind ?? null,
    });

    const slice = content.subarray(start, end + 1);
    const contentRange = `bytes ${start}-${end}/${content.length}`;

    if (!active) {
      res.writeHead(206, {
        'Content-Range': contentRange,
        'Content-Length': slice.length,
        'Accept-Ranges': 'bytes',
        ETag: etag,
      });
      res.end(slice);
      return;
    }

    switch (active.kind) {
      case 'status200': {
        send200(res);
        return;
      }
      case 'status404': {
        res.writeHead(404, { ETag: etag });
        res.end('not found');
        return;
      }
      case 'status416': {
        // Range Not Satisfiable: no body, echo the ETag and a Content-Range
        // with the resource size so it looks like a real 416 response.
        res.writeHead(416, {
          ETag: etag,
          'Content-Range': `bytes */${content.length}`,
        });
        res.end();
        return;
      }
      case 'status429ThenOk': {
        const headers: Record<string, string> = { ETag: etag };
        if (active.retryAfter) headers['Retry-After'] = active.retryAfter;
        res.writeHead(429, headers);
        res.end('rate limited');
        return;
      }
      case 'status5xx': {
        const headers: Record<string, string> = { ETag: etag };
        if (active.retryAfter) headers['Retry-After'] = active.retryAfter;
        res.writeHead(active.status ?? 503, headers);
        res.end('server error');
        return;
      }
      case 'misalignedContentRange': {
        // Claim a window one byte off from what was requested → §5.5 reject.
        res.writeHead(206, {
          'Content-Range': `bytes ${start + 1}-${end + 1}/${content.length}`,
          'Content-Length': slice.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        res.end(slice);
        return;
      }
      case 'multipartByteranges': {
        // multipart/byteranges body is rejected by validateSegmentContentRange.
        res.writeHead(206, {
          'Content-Type':
            'multipart/byteranges; boundary=THIS_STRING_SEPARATES',
          'Content-Range': contentRange,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        res.end(slice);
        return;
      }
      case 'overLongBody': {
        // Send MORE bytes than the requested window → §5.5 over-long reject.
        const extra = Buffer.alloc(active.extra, 0x41);
        const body = Buffer.concat([slice, extra]);
        res.writeHead(206, {
          'Content-Range': contentRange,
          'Content-Length': body.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        res.end(body);
        return;
      }
      case 'shortBody': {
        // Send FEWER bytes than the window then end → §5.5 short-body retry.
        const cut = Math.max(0, slice.length - active.missingTail);
        res.writeHead(206, {
          'Content-Range': contentRange,
          // Advertise the full length but deliver less, then close.
          'Content-Length': slice.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        res.write(slice.subarray(0, cut));
        res.end();
        return;
      }
      case 'wrongBytes': {
        // Correct length + window but corrupted payload → assembly fails the
        // whole-file checksum (OCDS §6 scenario 6 / corrupted assembly).
        const corrupt = Buffer.from(slice);
        for (let i = 0; i < corrupt.length; i += 1) corrupt[i] ^= 0xff;
        res.writeHead(206, {
          'Content-Range': contentRange,
          'Content-Length': corrupt.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        res.end(corrupt);
        return;
      }
      case 'dropAfterBytesForRange': {
        // Send `bytes` of the window then destroy the socket → transient
        // mid-range network drop. Resume must re-fetch only the missing tail.
        res.writeHead(206, {
          'Content-Range': contentRange,
          'Content-Length': slice.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        const head = slice.subarray(0, Math.min(active.bytes, slice.length));
        res.write(head, () => {
          res.socket?.destroy();
        });
        return;
      }
      case 'stall': {
        // Send headers, then nothing, holding the socket so the §5.4 stall
        // (no-progress) watchdog fires. holdMs caps the hold so the test
        // server tears down cleanly even if the client never aborts.
        res.writeHead(206, {
          'Content-Range': contentRange,
          'Content-Length': slice.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        const holdMs = active.holdMs ?? 5000;
        // setTimeout resolves to the DOM `number` overload under this
        // tsconfig's lib, so reach `unref` via the Node timer shape.
        const t = setTimeout(() => {
          try {
            res.socket?.destroy();
          } catch {
            // ignore
          }
        }, holdMs) as unknown as { unref?: () => void };
        // Don't keep the event loop alive on this timer.
        t.unref?.();
        return;
      }
      default: {
        res.writeHead(206, {
          'Content-Range': contentRange,
          'Content-Length': slice.length,
          'Accept-Ranges': 'bytes',
          ETag: etag,
        });
        res.end(slice);
      }
    }
  });

  return new Promise<IFaultServerHandle>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/bundle.zip`,
        ranges,
        requests,
        setMode,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}
