/* cspell:ignore unhandle */
import path from 'path';

import type { Protocol } from 'electron';

// Custom scheme used to serve the renderer bundle via protocol.handle /
// interceptFileProtocol. Module-scoped so softRestartRenderer and
// createMainWindow reference the SAME value — a divergence would make the
// pre-recreate cleanup silently no-op and reintroduce the stale-handler bug
// it exists to prevent.
export const PROTOCOL = 'file';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

export function getMimeTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function parseSingleByteRange(
  rangeHeader: string,
  totalLength: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;
  if (totalLength === 0) return 'unsatisfiable';

  if (!startStr) {
    // Suffix byte range: bytes=-N
    const suffixLength = Number(endStr);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return 'unsatisfiable';
    }
    const start = Math.max(0, totalLength - suffixLength);
    return { start, end: totalLength - 1 };
  }

  const start = Number(startStr);
  const end = endStr
    ? Math.min(Number(endStr), totalLength - 1)
    : totalLength - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= totalLength ||
    end < start
  ) {
    return 'unsatisfiable';
  }
  return { start, end };
}

function toArrayBufferUint8Array(slice: Buffer): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(slice.byteLength);
  body.set(slice);
  return body;
}

export function createBufferResponse(
  buffer: Buffer,
  filePath: string,
  request?: Pick<Request, 'headers'>,
): Response {
  const contentType = getMimeTypeForPath(filePath);
  const rangeHeader = request?.headers?.get('range');
  if (rangeHeader) {
    const parsedRange = parseSingleByteRange(rangeHeader, buffer.byteLength);
    if (parsedRange === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${buffer.byteLength}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }
    if (parsedRange) {
      const slice = buffer.subarray(parsedRange.start, parsedRange.end + 1);
      return new Response(toArrayBufferUint8Array(slice), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(slice.byteLength),
          'Content-Range': `bytes ${parsedRange.start}-${parsedRange.end}/${buffer.byteLength}`,
        },
      });
    }
  }

  return new Response(toArrayBufferUint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(buffer.byteLength),
    },
  });
}

// Clears either a modern `protocol.handle` registration or a legacy
// `interceptFileProtocol` registration on `protocol`. Returns true if any
// existing handler was cleared.
export function clearProtocolHandlerIfNeeded(
  protocol: Pick<Protocol, 'isProtocolIntercepted' | 'uninterceptProtocol'> &
    Partial<Pick<Protocol, 'isProtocolHandled' | 'unhandle'>>,
  scheme: string = PROTOCOL,
): boolean {
  let cleared = false;
  if (
    typeof protocol.isProtocolHandled === 'function' &&
    typeof protocol.unhandle === 'function' &&
    protocol.isProtocolHandled(scheme)
  ) {
    protocol.unhandle(scheme);
    cleared = true;
  }
  if (
    typeof protocol.isProtocolIntercepted === 'function' &&
    typeof protocol.uninterceptProtocol === 'function' &&
    protocol.isProtocolIntercepted(scheme)
  ) {
    protocol.uninterceptProtocol(scheme);
    cleared = true;
  }
  return cleared;
}
