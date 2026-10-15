import { createXmrRuntimeProxy } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/proxy';
import { workerApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/workerClient';

import type { IWebembedApi } from './instance/IWebembedApi';

// WebEmbed owns the transport; the same Worker as web and desktop owns the
// wallet. The native background is Hermes and cannot run wasm, so this WebView
// is the only place on iOS and Android where the runtime can exist at all.
class WebEmbedApiChainXmr {
  constructor() {
    Object.assign(
      this,
      createXmrRuntimeProxy(() => workerApi),
    );
  }
}

export default WebEmbedApiChainXmr as unknown as new () => IWebembedApi['chainXmr'];
