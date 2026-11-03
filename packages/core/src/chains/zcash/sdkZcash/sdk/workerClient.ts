import { createPrivacyChainWorkerClient } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';

import { ZCASH_SDK_METHODS } from '../types/methods';

import createZcashWorker from './createZcashWorker';

import type { IZcashSdkApi } from '../types/sdk';

// Every browser carrier uses this transport. The transport itself is shared
// with the other client-scanning chains -- see privacyChainWorkerClient.
const client = createPrivacyChainWorkerClient<IZcashSdkApi>({
  label: 'zcash',
  methods: ZCASH_SDK_METHODS,
  createWorker: createZcashWorker,
  hostStreamRequest: hostFetchStream,
});

export const workerApi = client.api;

// Reset must run outside the Worker: a stuck synchronous WASM call cannot
// receive another message. Storage initialization waits for asynchronous
// browser handle release before acquiring the next owner.
workerApi.resetCarrier = async () => {
  client.reset();
};

export async function ensureWorkerReady(): Promise<void> {
  await client.ensureReady();
}
