import type { Store } from './store';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type IHandlerContext = {
  store: Store;
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  body: string;
  now: () => number;
};

export type IJsonError =
  | 'INVALID_BODY'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'REVOKED'
  | 'INTERNAL';

export function sendJson(
  res: ServerResponse,
  status: number,
  payload: object,
): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendError(
  res: ServerResponse,
  status: number,
  error: IJsonError,
): void {
  sendJson(res, status, { error });
}
