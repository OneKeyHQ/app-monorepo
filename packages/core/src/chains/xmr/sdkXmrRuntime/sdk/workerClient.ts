import { createPrivacyChainWorkerClient } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';

import { XMR_RUNTIME_METHODS } from '../methods';

import createXmrWorker from './createXmrWorker';
import { xmrHostFetch } from './hostFetch';

import type { IXmrRuntimeApi } from '..';

// Every browser carrier uses this transport, which is shared with the other
// client-scanning chains -- see privacyChainWorkerClient.
const client = createPrivacyChainWorkerClient<IXmrRuntimeApi>({
  label: 'xmr',
  methods: XMR_RUNTIME_METHODS,
  createWorker: createXmrWorker,
  // Per-platform; see hostFetch. `undefined` on a carrier that has no better
  // channel than the runtime's own fetch.
  hostRequest: xmrHostFetch,
  hostStreamRequest: hostFetchStream,
});

export const workerApi = client.api;

export async function ensureWorkerReady(): Promise<void> {
  await client.ensureReady();
}

export function resetXmrCarrier(): void {
  client.reset();
}
