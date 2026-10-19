import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

/**
 * Mobile: fetch from the React Native side.
 *
 * On iOS and Android the runtime lives in this web-embed WebView, whose own
 * fetch obeys CORS and mixed content -- and Android serves the page from a
 * virtual https origin, so a plain-http node is refused before a request is
 * made. The request goes up the page's private channel to the app's
 * background, whose networking is native and has no CORS rule. Cleartext is
 * still subject to the app's transport policy (iOS allows only the local
 * network; Android none).
 */

export const PRIVACY_CHAIN_NODE_REQUEST_METHOD =
  'privacyChainNodeRequest' as const;

type IRelayResult = { ok: true; b64: string } | { ok: false; error: string };

type IPrivateChannel = {
  request: (args: { method: string; params: unknown }) => Promise<unknown>;
};

function privateChannel(): IPrivateChannel | undefined {
  return (globalThis as { $onekey?: { $private?: IPrivateChannel } }).$onekey
    ?.$private;
}

async function pageFetch(
  url: string,
  contentType: string,
  body: Uint8Array,
): Promise<Uint8Array> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: body.length > 0 ? new Uint8Array(body) : undefined,
  });
  if (!response.ok) {
    throw new OneKeyLocalError(
      `xmr: node answered HTTP ${response.status} ${response.statusText}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

export const xmrHostFetch: IPrivacyChainHostRequest = async (
  url,
  contentType,
  body,
) => {
  const channel = privateChannel();
  let result: IRelayResult | undefined;
  try {
    result = (await channel?.request({
      method: PRIVACY_CHAIN_NODE_REQUEST_METHOD,
      // The bridge serializes as JSON; base64 is the compact form that
      // survives it.
      params: { url, contentType, b64: bufferUtils.bytesToBase64(body) },
    })) as IRelayResult | undefined;
  } catch (error) {
    // The channel itself is unavailable (an app build without the relay, the
    // page not yet connected). Keep working as before this relay existed:
    // the page's own fetch, which reaches CORS-enabled https nodes.
    console.warn('[xmr] native relay unavailable; using the page fetch', {
      error: error instanceof Error ? error.message : String(error),
    });
    return pageFetch(url, contentType, body);
  }
  if (!result) {
    return pageFetch(url, contentType, body);
  }
  if (!result.ok) {
    // The relay ran and the node failed: that is the answer, not a reason to
    // retry through a channel with stricter rules.
    throw new OneKeyLocalError(result.error);
  }
  return new Uint8Array(bufferUtils.base64ToBytes(result.b64));
};
