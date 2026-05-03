import { handleFetch } from './handlers/fetch';
import { handleRegister } from './handlers/register';
import { handleRevoke } from './handlers/revoke';
import { sendError } from './http-types';

import type { IHandlerContext } from './http-types';
import type { Store } from './store';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_BODY_BYTES = 64 * 1024; // 64 KiB; key payloads are tiny

export type IRouterDeps = {
  store: Store;
  now?: () => number;
};

const KEY_ID_RE = /^[A-Za-z0-9_-]{1,128}$/; // base64url token shape

type IRouteMatch =
  | {
      kind: 'register';
    }
  | {
      kind: 'fetch';
      keyId: string;
    }
  | {
      kind: 'revoke';
      keyId: string;
    }
  | { kind: 'not-found' };

function matchRoute(method: string, pathname: string): IRouteMatch {
  if (method === 'POST' && pathname === '/v1/bot-wallet-keys') {
    return { kind: 'register' };
  }
  // /v1/bot-wallet-keys/:keyId/revoke
  const revokeMatch = pathname.match(
    /^\/v1\/bot-wallet-keys\/([^/]+)\/revoke$/,
  );
  if (revokeMatch) {
    if (method !== 'POST') return { kind: 'not-found' };
    const keyId = revokeMatch[1];
    if (!KEY_ID_RE.test(keyId)) return { kind: 'not-found' };
    return { kind: 'revoke', keyId };
  }
  // /v1/bot-wallet-keys/:keyId
  const fetchMatch = pathname.match(/^\/v1\/bot-wallet-keys\/([^/]+)$/);
  if (fetchMatch) {
    if (method !== 'GET') return { kind: 'not-found' };
    const keyId = fetchMatch[1];
    if (!KEY_ID_RE.test(keyId)) return { kind: 'not-found' };
    return { kind: 'fetch', keyId };
  }
  return { kind: 'not-found' };
}

function logAuditRoute(route: IRouteMatch): void {
  if (process.env.BOT_WALLET_KEY_SERVICE_AUDIT_REQUESTS !== '1') {
    return;
  }
  if (
    route.kind === 'fetch' ||
    route.kind === 'revoke' ||
    route.kind === 'register'
  ) {
    process.stderr.write(`audit: ${route.kind}\n`);
  }
}

async function readBody(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<string | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (body: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(body);
    };
    req.on('data', (chunk: Buffer) => {
      if (settled) {
        return;
      }
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        sendError(res, 400, 'INVALID_BODY');
        req.destroy();
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => {
      if (!res.headersSent) {
        sendError(res, 400, 'INVALID_BODY');
      }
      finish(null);
    });
  });
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const requestedHeaders = req.headers['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    typeof requestedHeaders === 'string' && requestedHeaders.length > 0
      ? requestedHeaders
      : 'Content-Type, Authorization',
  );
  res.setHeader('Access-Control-Max-Age', '600');
}

export function createRequestHandler(deps: IRouterDeps) {
  const now = deps.now ?? Date.now;
  return async function requestHandler(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      const method = req.method ?? '';
      const url = new URL(req.url ?? '/', 'http://127.0.0.1:8787');

      applyCorsHeaders(req, res);
      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const route = matchRoute(method, url.pathname);
      logAuditRoute(route);

      if (route.kind === 'not-found') {
        sendError(res, 404, 'NOT_FOUND');
        return;
      }

      // Only register has a body; fetch/revoke ignore body.
      let body = '';
      if (route.kind === 'register') {
        const maybeBody = await readBody(req, res);
        if (maybeBody === null) return; // already responded with INVALID_BODY
        body = maybeBody;
      }

      const ctx: IHandlerContext = {
        store: deps.store,
        req,
        res,
        url,
        body,
        now,
      };

      if (route.kind === 'register') {
        handleRegister(ctx);
      } else if (route.kind === 'fetch') {
        handleFetch(ctx, { keyId: route.keyId });
      } else {
        handleRevoke(ctx, { keyId: route.keyId });
      }
    } catch (e) {
      process.stderr.write(`request error: ${String(e)}\n`);
      if (!res.headersSent) {
        sendError(res, 500, 'INTERNAL');
      } else {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
  };
}
