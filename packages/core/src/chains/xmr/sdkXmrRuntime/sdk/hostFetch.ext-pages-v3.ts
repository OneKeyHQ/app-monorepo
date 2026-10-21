import { describeRoute } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { privacyChainPerfLog } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

/**
 * Extension: fetch through the background service worker. The offscreen
 * document's fetch obeys CORS and mixed content; the MV3 background is the
 * context `host_permissions` unambiguously cover.
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
  // Minus the background's `node fetch` time for the same route, this is the
  // messaging plus base64 overhead.
  privacyChainPerfLog('xmr relay (offscreen)', {
    route: describeRoute(url),
    reqBytes: body.byteLength,
    respBytes: bytes.byteLength,
    roundTripMs: receivedAt - startedAt,
    decodeMs: Date.now() - receivedAt,
  });
  return bytes;
};
