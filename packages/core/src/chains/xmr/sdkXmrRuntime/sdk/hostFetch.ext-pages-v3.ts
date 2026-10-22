import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
  const decoded = bufferUtils.base64ToBytes(result.b64);
  return new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
};
