import XmrSdkInlineWorker from './xmrSdkInline.worker';

// Web serves its assets from another origin (app-assets), and a Worker script
// must be same-origin. The Blob Worker the web-embed uses sidesteps that.
export default function createXmrWorker(): Worker {
  return new XmrSdkInlineWorker();
}
