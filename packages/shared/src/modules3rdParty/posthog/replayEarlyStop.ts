// Only native has a process-wide recorder that can outlive a JS reload.
export function stopLeftoverNativeReplay(): Promise<void> {
  return Promise.resolve();
}
