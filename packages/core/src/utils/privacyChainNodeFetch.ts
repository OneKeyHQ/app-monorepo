import { createFetchStream } from '@onekeyhq/shared/src/utils/fetchStreamClient';
import { fetchBytesWithIdleTimeout } from '@onekeyhq/shared/src/utils/fetchWithIdleTimeout';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';
import { streamingFetch } from '@onekeyhq/shared/src/utils/streamingFetch';

// The host relay where the platform has one; without one, this runtime is the host and sends itself.
const nodeTransport: typeof fetch = hostFetchStream
  ? createFetchStream(hostFetchStream)
  : streamingFetch;

/**
 * A node request made outside the runtime Worker, under the relay's rules on every platform:
 * no cookies, no redirects, and the reply read only up to the relay's size cap.
 */
export async function privacyChainNodeRequest(url: string, init: RequestInit) {
  return fetchBytesWithIdleTimeout(
    url,
    { ...init, credentials: 'omit', redirect: 'error' },
    undefined,
    nodeTransport,
  );
}
