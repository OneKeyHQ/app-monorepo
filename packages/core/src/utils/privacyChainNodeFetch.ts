import { createFetchStream } from '@onekeyhq/shared/src/utils/fetchStreamClient';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';
import { streamingFetch } from '@onekeyhq/shared/src/utils/streamingFetch';

// Node requests made outside the runtime Worker: the host relay where the platform has one, else the fetch the relays use.
export const privacyChainNodeFetch: typeof fetch = hostFetchStream
  ? createFetchStream(hostFetchStream)
  : streamingFetch;
