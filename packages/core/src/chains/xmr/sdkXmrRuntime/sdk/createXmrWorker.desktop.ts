import XmrSdkInlineWorker from './xmrSdkInline.worker';

// Release builds load the renderer from file://, where a Worker cannot start
// from a file URL. The Blob Worker web uses works there.
export default function createXmrWorker(): Worker {
  return new XmrSdkInlineWorker();
}
