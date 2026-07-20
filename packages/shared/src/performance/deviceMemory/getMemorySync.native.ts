// Native (iOS/Android): expo-device totalMemory (sync constant, bytes → GB)
import * as ExpoDevice from 'expo-device';

export function getDeviceMemoryGBSync(): number | null {
  const totalMem = ExpoDevice.totalMemory;
  if (typeof totalMem === 'number' && totalMem > 0) {
    return totalMem / (1024 * 1024 * 1024);
  }
  return null;
}

export async function getDeviceMemoryGB(): Promise<number | null> {
  return getDeviceMemoryGBSync();
}
