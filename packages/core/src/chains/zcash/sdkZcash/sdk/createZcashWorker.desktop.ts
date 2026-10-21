import ZcashSdkInlineWorker from './zcashSdkInline.worker';

// Release builds load the renderer from file://, where a Worker cannot start
// from a file URL. The Blob Worker web uses works there.
export default function createZcashWorker(): Worker {
  return new ZcashSdkInlineWorker();
}
