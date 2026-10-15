import { describeRoute } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { privacyChainPerfLog } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

/**
 * Extension: fetch through the background service worker.
 *
 * The Worker that runs the chain runtime lives in the offscreen document, and
 * an offscreen document is still a browser context -- its fetch obeys CORS and
 * mixed content. A Monero node sends no CORS headers unless someone proxied
 * it, which left exactly one of twelve public nodes reachable on 2026-09-22.
 * Forcing every user of a privacy chain through one operator hands that
 * operator their IP, the ranges they sync, and when they broadcast.
 *
 * The background service worker is the context an extension's
 * `host_permissions` unambiguously cover, so the request is relayed there
 * rather than attempted here. MV3 narrowed which extension contexts may issue
 * cross-origin requests; the background is the one that is not in doubt, and
 * a wrong guess would fail as an indistinguishable "Failed to fetch".
 */
export const PRIVACY_CHAIN_NODE_REQUEST_MESSAGE =
  'privacyChain/nodeRequest' as const;

export const xmrHostFetch: IPrivacyChainHostRequest = async (
  url,
  contentType,
  body,
) => {
  const startedAt = Date.now();
  const result: { ok: boolean; b64?: string; error?: string } =
    await chrome.runtime.sendMessage({
      type: PRIVACY_CHAIN_NODE_REQUEST_MESSAGE,
      url,
      contentType,
      // `sendMessage` serializes as JSON, so a Uint8Array would arrive as an
      // object with numeric keys. A plain array survives the trip.
      body: Array.from(body),
    });

  if (!result?.ok || typeof result.b64 !== 'string') {
    throw new OneKeyLocalError(
      result?.error ?? 'xmr: background node request failed',
    );
  }
  const receivedAt = Date.now();
  const decoded = bufferUtils.base64ToBytes(result.b64);
  const bytes = new Uint8Array(
    decoded.buffer,
    decoded.byteOffset,
    decoded.byteLength,
  );
  // Offscreen -> background -> node -> background -> offscreen. Compare with
  // the background's `node fetch` line for the same route: the difference
  // is messaging plus the base64 encoding.
  privacyChainPerfLog('xmr relay (offscreen)', {
    route: describeRoute(url),
    reqBytes: body.byteLength,
    respBytes: bytes.byteLength,
    roundTripMs: receivedAt - startedAt,
    decodeMs: Date.now() - receivedAt,
  });
  return bytes;
};
