import { describeRoute } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { createFetchStreamHandler } from '@onekeyhq/shared/src/utils/fetchStream';
import { fetchBytesWithIdleTimeout } from '@onekeyhq/shared/src/utils/fetchWithIdleTimeout';
import { privacyChainPerfLog } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';
import { streamingFetch } from '@onekeyhq/shared/src/utils/streamingFetch';
import type { IFetchStreamRequester } from '@onekeyhq/shared/types/fetchStream';

import { isPrivacyChainRelayTargetAllowed } from './privacyChainRelayTargets';

import type { IPrivacyChainRelayTargetSource } from './privacyChainRelayTargets';

export type IPrivacyChainNodeRelayResult =
  | { ok: true; b64: string }
  | { ok: false; error: string };

const NOT_A_CONFIGURED_NODE = 'not a configured privacy-chain node';

/**
 * A privacy-chain node request made on behalf of a browser context (the
 * extension's offscreen document, the mobile web-embed), from a context whose
 * networking has no CORS or mixed-content rule.
 *
 * The response travels as base64: the bridges serialize as JSON, a number
 * array is ~3.6x the bytes and base64 1.33x.
 */
export async function relayPrivacyChainNodeRequest({
  url,
  contentType,
  body,
  targets,
  fetchImpl = streamingFetch,
}: {
  url: string;
  contentType: string;
  body: Uint8Array;
  targets: IPrivacyChainRelayTargetSource;
  // Native `streamingFetch` is expo/fetch: RN's own fetch ignores `redirect`.
  fetchImpl?: typeof fetch;
}): Promise<IPrivacyChainNodeRelayResult> {
  try {
    // Only http(s): the caller must not reach other schemes through us.
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: `unsupported protocol ${parsed.protocol}` };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, error: 'URL credentials are not supported' };
    }
    if (!(await isPrivacyChainRelayTargetAllowed(parsed.href, targets))) {
      return { ok: false, error: NOT_A_CONFIGURED_NODE };
    }
    const fetchStartedAt = Date.now();
    // Fails only on silence: a large batch over a proxy can take minutes.
    // Fetch the URL that was checked, not a raw string another parser may
    // read differently.
    const response = await fetchBytesWithIdleTimeout(
      parsed.href,
      {
        method: 'POST',
        headers: { 'Content-Type': contentType || 'application/json' },
        // Same limits as desktop: no session cookies, no hop to a host the
        // user did not configure.
        credentials: 'omit',
        redirect: 'error',
        // A zero-length body is a GET-shaped call in monerod's binary API; some
        // proxies reject an explicit empty buffer.
        body: body.length > 0 ? new Uint8Array(body) : undefined,
      },
      undefined,
      fetchImpl,
    );
    if (!response.ok) {
      return {
        ok: false,
        error: `node answered HTTP ${response.status} ${response.statusText}`,
      };
    }
    const fetchedAt = Date.now();
    const b64 = bufferUtils.bytesToBase64(response.bytes);
    privacyChainPerfLog('node fetch (relay)', {
      route: describeRoute(url),
      status: response.status,
      reqBytes: body.byteLength,
      respBytes: response.bytes.byteLength,
      fetchMs: fetchedAt - fetchStartedAt,
      encodeMs: Date.now() - fetchedAt,
    });
    return { ok: true, b64 };
  } catch (error) {
    // Carry the cause: an outage, a wrong address and a TLS error must not
    // all read as "request failed".
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The chunked counterpart for the same callers. Node calls are POSTs to a
 * configured node; the shared handler adds the credential, redirect and size
 * limits.
 */
export function createPrivacyChainFetchStreamRelay(
  targets: IPrivacyChainRelayTargetSource,
  fetchImpl?: typeof fetch,
): IFetchStreamRequester {
  const handler = createFetchStreamHandler(fetchImpl);
  return async (request) => {
    if (request.action !== 'open') {
      return handler(request);
    }
    if ((request.method ?? 'GET').toUpperCase() !== 'POST') {
      return { ok: false, error: 'unsupported fetch method' };
    }
    let href: string;
    try {
      href = new URL(request.url).href;
      if (!(await isPrivacyChainRelayTargetAllowed(href, targets))) {
        return { ok: false, error: NOT_A_CONFIGURED_NODE };
      }
    } catch (error) {
      // The extension listener replies only on resolve; never reject.
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    return handler({ ...request, url: href });
  };
}
