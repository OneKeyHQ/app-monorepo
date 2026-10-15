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

// Shared Worker entry for every carrier. Hosts the wasm module, the SQLite
// wallet database and the scan loop, so none of it runs on the window thread.
//
// Web, desktop and the extension's offscreen document load this by URL.
// Mobile bundles the same entry through xmrSdkInline.worker.js, because
// WKWebView cannot load a Worker script from a bundled file URL.
//
// Scanning is what forces this. Pure trial-decryption measured 153 blocks per
// second, so the CPU cost is real but modest -- on the page thread it would
// still be hundreds of milliseconds of frozen UI per step, with no error and
// no timeout to show for it.
servePrivacyChainWorker<IXmrRuntimeApi>({
  label: 'xmr',
  methods: XMR_RUNTIME_METHODS,
  loadApi: async () => {
    // Eager bundling keeps the inline Worker self-contained. Instantiation
    // stays deferred to the first call, and a failed load can be retried.
    const m = await import(/* webpackMode: "eager" */ '../carrier/loadRuntime');
    const api = await m.loadXmrRuntime();
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
});
