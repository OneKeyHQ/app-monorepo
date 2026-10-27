const BYTES_PER_GIB = 1024 ** 3;

function getBrowserDeviceMemoryGB(): number | null {
  if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
    const memoryGB = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof memoryGB === 'number' && memoryGB > 0) {
      return memoryGB;
    }
  }
  return null;
}

export function getDeviceMemoryGBSync(): number | null {
  const totalMemoryBytes = globalThis.desktopApi?.totalMemoryBytes;
  if (
    typeof totalMemoryBytes === 'number' &&
    Number.isFinite(totalMemoryBytes) &&
    totalMemoryBytes > 0
  ) {
    return totalMemoryBytes / BYTES_PER_GIB;
  }
  return getBrowserDeviceMemoryGB();
}

export async function getDeviceMemoryGB(): Promise<number | null> {
  return getDeviceMemoryGBSync();
}
