import appStorage from '@onekeyhq/shared/src/storage/appStorage';

// The chart's main runtime owns these writes. Never read this queue from bg
// or a worklet; those runtimes do not share the same JavaScript heap.
const pendingWrites = new Map<string, Promise<void>>();

export async function readChartLocalStorage(key: string) {
  await pendingWrites.get(key);
  return appStorage.getItem(key);
}

export function writeChartLocalStorage(key: string, serialized: string) {
  const write = (pendingWrites.get(key) ?? Promise.resolve()).then(() =>
    appStorage.setItem(key, serialized),
  );
  const settled = write.then(
    () => undefined,
    () => undefined,
  );
  pendingWrites.set(key, settled);
  void settled.then(() => {
    if (pendingWrites.get(key) === settled) pendingWrites.delete(key);
  });
  return write;
}
