// Web / Desktop: navigator.deviceMemory (Chrome/Chromium only, returns GB)

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
