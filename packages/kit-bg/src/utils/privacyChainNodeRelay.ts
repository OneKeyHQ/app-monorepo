import { describeRoute } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { fetchBytesWithIdleTimeout } from '@onekeyhq/shared/src/utils/fetchWithIdleTimeout';
import { privacyChainPerfLog } from '@onekeyhq/shared/src/utils/privacyChainPerfLog';

export type IPrivacyChainNodeRelayResult =
  | { ok: true; b64: string }
  | { ok: false; error: string };

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
}: {
  url: string;
  contentType: string;
  body: Uint8Array;
}): Promise<IPrivacyChainNodeRelayResult> {
  try {
    // Only http(s): the caller must not reach other schemes through us.
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: `unsupported protocol ${parsed.protocol}` };
    }
    const fetchStartedAt = Date.now();
    // Fails only on silence, never on a slow-but-steady transfer: a
    // wallet2-sized batch over a proxy can take minutes and be fine.
    const response = await fetchBytesWithIdleTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType || 'application/json' },
      // A zero-length body is a GET-shaped call in monerod's binary API; some
      // proxies reject an explicit empty buffer.
      body: body.length > 0 ? new Uint8Array(body) : undefined,
    });
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
