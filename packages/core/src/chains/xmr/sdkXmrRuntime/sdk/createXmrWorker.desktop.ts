import XmrSdkDesktopWorker from './xmrSdkDesktop.worker';

// A `new URL()` Worker shares the app's chunk graph, so its runtime carries
// SRI placeholders that cannot resolve. The loader emits the same entry as a
// standalone same-origin file; the CSP forbids the Blob Worker web uses.
export default function createXmrWorker(): Worker {
  return new XmrSdkDesktopWorker();
}
