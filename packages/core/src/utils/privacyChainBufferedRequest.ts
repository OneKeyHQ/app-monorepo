import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createFetchStream } from '@onekeyhq/shared/src/utils/fetchStreamClient';
import { fetchBytesWithIdleTimeout } from '@onekeyhq/shared/src/utils/fetchWithIdleTimeout';
import type { IFetchStreamRequester } from '@onekeyhq/shared/types/fetchStream';

/** Assemble binary RPC responses inside the runtime Worker, never the carrier. */
export function createPrivacyChainBufferedRequest(
  requester?: IFetchStreamRequester,
) {
  const fetchImpl = requester ? createFetchStream(requester) : fetch;
  return async (url: string, contentType: string, body: Uint8Array) => {
    const response = await fetchBytesWithIdleTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: body.length ? new Uint8Array(body) : undefined,
      },
      undefined,
      fetchImpl,
    );
    if (!response.ok) {
      throw new OneKeyLocalError(
        `node answered HTTP ${response.status} ${response.statusText}`,
      );
    }
    return response.bytes;
  };
}
