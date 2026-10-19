import XmrSdkInlineWorker from './xmrSdkInline.worker';

// WKWebView cannot load a Worker script directly from the bundled file URL.
// The loader embeds the same Worker entry; wallet and storage logic stay
// shared with every other carrier.
export default function createXmrWorker(): Worker {
  return new XmrSdkInlineWorker();
}
