/* eslint-disable import-js/order */
// Must stay first: release builds read version globals at module load.
import '@onekeyhq/core/src/utils/privacyChainWorkerReleaseEnv';
import { createPrivacyChainBufferedRequest } from '@onekeyhq/core/src/utils/privacyChainBufferedRequest';
import {
  createWorkerHostRequester,
  createWorkerHostStreamRequester,
  servePrivacyChainWorker,
  workerCarrierHasHostRequest,
  workerCarrierHasHostStreamRequest,
} from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

import { XMR_RUNTIME_METHODS } from '../methods';

import type { IXmrRuntimeApi } from '..';

// Shared Worker entry for every carrier: hosts the wasm module, the SQLite
// wallet database and the scan loop off the window thread. Platform loaders
// live in the createXmrWorker.* files.
let storageRequiresWorkerRestart = () => false;

servePrivacyChainWorker<IXmrRuntimeApi>({
  label: 'xmr',
  methods: XMR_RUNTIME_METHODS,
  loadApi: async () => {
    // Eager bundling keeps the inline Worker self-contained. Instantiation
    // stays deferred to the first call, and a failed load can be retried.
    const m = await import(/* webpackMode: "eager" */ '../carrier/loadRuntime');
    const api = await m.loadXmrRuntime();
    storageRequiresWorkerRestart = m.xmrStorageRequiresWorkerRestart;
    // Keep decoding and binary assembly in this Worker. Plain web uses its own
    // bounded Fetch; other carriers relay chunks through the available host.
    if (workerCarrierHasHostStreamRequest()) {
      await m.installXmrHostRequester(
        createPrivacyChainBufferedRequest(createWorkerHostStreamRequester()),
      );
    } else if (workerCarrierHasHostRequest()) {
      await m.installXmrHostRequester(createWorkerHostRequester('xmr'));
    } else {
      await m.installXmrHostRequester(createPrivacyChainBufferedRequest());
    }
    return api;
  },
  storageRequiresRestart: () => storageRequiresWorkerRestart(),
});
