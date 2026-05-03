import { extractBearerToken, verifyAccessToken } from '../auth';
import { sendError, sendJson } from '../http-types';

import type { IHandlerContext } from '../http-types';

/**
 * POST /v1/bot-wallet-keys/:keyId/revoke
 *
 * Idempotent: calling on an already-revoked record returns 200 again.
 * Auth/path errors collapse to 401/404 just like fetch — same error shape.
 */
export function handleRevoke(
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
  ctx.store.revoke(pathParams.keyId, ctx.now());
  sendJson(ctx.res, 200, { revoked: true });
}
