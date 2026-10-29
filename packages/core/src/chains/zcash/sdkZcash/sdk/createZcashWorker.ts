export default function createZcashWorker(): Worker {
  return new Worker(new URL('./zcashSdkWorker.ts', import.meta.url));
}
