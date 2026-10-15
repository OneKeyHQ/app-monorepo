import {
  createWorkerHostStreamRequester,
  servePrivacyChainWorker,
  workerCarrierHasHostStreamRequest,
} from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { createFetchStream } from '@onekeyhq/shared/src/utils/fetchStreamClient';

import { ZCASH_SDK_METHODS } from '../types/methods';

import type { IZcashSdkApi } from '../types/sdk';

// Shared Worker entry for every carrier. Hosts the implementation -- wasm,
// wallet database, scan loop -- so none of it runs on the window thread.
//
// Web/desktop/extensions load this entry by URL. Mobile web-embed bundles the
// same entry through zcashSdkInline.worker.js for file-backed WKWebView pages.
//
// The message protocol and error serialization are shared with the other
// client-scanning chains; see privacyChainWorkerClient.
let storageRequiresWorkerRestart = () => false;

servePrivacyChainWorker<IZcashSdkApi>({
  label: 'zcash',
  methods: ZCASH_SDK_METHODS,
  loadApi: async () => {
    // Eager bundling keeps the inline Worker self-contained. Initialization
    // remains deferred until the first call, and failed loads can be retried.
    const m = await import(/* webpackMode: "eager" */ '../impl');
    storageRequiresWorkerRestart = m.storageRequiresWorkerRestart;
    if (workerCarrierHasHostStreamRequest()) {
      await m.installZcashHostFetch(
        createFetchStream(createWorkerHostStreamRequester()),
      );
    }
    return m.default.getZcashApi();
  },
  storageRequiresRestart: () => storageRequiresWorkerRestart(),
  // The self test's worker stage proves this entry is alive and must answer
  // before the wasm module is loaded -- that is what it is testing.
  intercept: (method, args) =>
    method === 'runRuntimeSelfTest' &&
    (args[0] as { stage?: string } | undefined)?.stage === 'worker'
      ? { result: { stage: 'worker' } }
      : undefined,
});
