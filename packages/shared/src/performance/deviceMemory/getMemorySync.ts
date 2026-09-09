// Web / Extension: navigator.deviceMemory when the browser exposes it.

export function getDeviceMemoryGBSync(): number | null {
  if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
    const memGB = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof memGB === 'number' && memGB > 0) {
      return memGB;
    }
  }
  return null;
}

export async function getDeviceMemoryGB(): Promise<number | null> {
  return getDeviceMemoryGBSync();
}
