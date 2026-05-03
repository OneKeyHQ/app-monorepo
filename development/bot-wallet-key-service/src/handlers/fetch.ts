import { extractBearerToken, verifyAccessToken } from '../auth';
import { sendError, sendJson } from '../http-types';

import type { IHandlerContext } from '../http-types';

/**
 * GET /v1/bot-wallet-keys/:keyId
 *
 * Returns 401 for ANY auth failure (missing header / wrong prefix /
 * non-base64 token / wrong token) — never distinguishes the cause to the
 * client (timing + error-shape parity, NFR18). 404 only for "keyId does not
 * exist". 403 for revoked records.
 */
export function handleFetch(
  ctx: IHandlerContext,
  pathParams: { keyId: string },
): void {
  const auth = extractBearerToken(ctx.req.headers.authorization);
  const record = ctx.store.get(pathParams.keyId);

  if (!auth.ok) {
    sendError(ctx.res, 401, 'UNAUTHORIZED');
    return;
  }
  if (record === undefined) {
    sendError(ctx.res, 404, 'NOT_FOUND');
    return;
  }
  if (!verifyAccessToken(auth.tokenBase64Url, record.accessTokenSha256)) {
    sendError(ctx.res, 401, 'UNAUTHORIZED');
    return;
  }
  if (record.revokedAt !== undefined) {
    sendError(ctx.res, 403, 'REVOKED');
    return;
  }
  sendJson(ctx.res, 200, { keyBase64: record.keyBase64 });
}
