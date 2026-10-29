import { createPrivacyChainWorkerClient } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';

import { XMR_RUNTIME_METHODS } from '../methods';

import createXmrWorker from './createXmrWorker';
import { xmrHostFetch } from './hostFetch';

import type { IXmrRuntimeApi } from '..';

const client = createPrivacyChainWorkerClient<IXmrRuntimeApi>({
  label: 'xmr',
  methods: XMR_RUNTIME_METHODS,
  createWorker: createXmrWorker,
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
