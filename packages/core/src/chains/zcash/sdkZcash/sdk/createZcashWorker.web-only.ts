import ZcashSdkInlineWorker from './zcashSdkInline.worker';

// Web serves its assets from another origin (app-assets), and a Worker script
// must be same-origin. The Blob Worker the web-embed uses sidesteps that.
export default function createZcashWorker(): Worker {
  return new ZcashSdkInlineWorker();
}
