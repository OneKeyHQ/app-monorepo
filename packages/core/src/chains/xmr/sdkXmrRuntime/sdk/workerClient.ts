import { createPrivacyChainWorkerClient } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';

import { XMR_RUNTIME_METHODS } from '../methods';

import createXmrWorker from './createXmrWorker';

import type { IXmrRuntimeApi } from '..';

const client = createPrivacyChainWorkerClient<IXmrRuntimeApi>({
  label: 'xmr',
  methods: XMR_RUNTIME_METHODS,
  createWorker: createXmrWorker,
  hostStreamRequest: hostFetchStream,
});

export const workerApi = client.api;

export async function ensureWorkerReady(): Promise<void> {
  await client.ensureReady();
}
