// Shared by the main-process updater and the first before-quit handler. Keep the
// renderer/background alive until the whole manual cleanup commits or fails.
let barrier: { promise: Promise<void>; resolve: () => void } | undefined;

export function beginManualUpdateCacheClearInMain() {
  if (!barrier) {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    barrier = { promise, resolve };
  }
}

export function getManualUpdateCacheClearBarrier() {
  return barrier?.promise;
}

export function releaseManualUpdateCacheClearInMain() {
  const current = barrier;
  barrier = undefined;
  current?.resolve();
}
