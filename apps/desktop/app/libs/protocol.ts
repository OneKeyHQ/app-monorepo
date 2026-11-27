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
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
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

export function createBufferResponse(
  buffer: Buffer,
  filePath: string,
): Response {
  const body = new Uint8Array(buffer.byteLength);
  body.set(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': getMimeTypeForPath(filePath),
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
