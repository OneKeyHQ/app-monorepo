export default function createXmrWorker(): Worker {
  return new Worker(new URL('./xmrSdkWorker.ts', import.meta.url));
}
