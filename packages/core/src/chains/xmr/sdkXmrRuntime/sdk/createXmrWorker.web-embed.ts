import XmrSdkInlineWorker from './xmrSdkInline.worker';

// WKWebView cannot load a Worker script from the bundled file URL; the loader embeds the same entry.
export default function createXmrWorker(): Worker {
  return new XmrSdkInlineWorker();
}
