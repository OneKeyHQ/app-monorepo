import ZcashSdkInlineWorker from './zcashSdkInline.worker';

// WKWebView cannot load a Worker script directly from the bundled file URL.
// The loader embeds the same Worker entry; wallet and storage logic stay shared.
export default function createZcashWorker(): Worker {
  return new ZcashSdkInlineWorker();
}
