import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface IAndroidUsbDeviceCandidate {
  connectId?: string | null;
  serialNo?: string | null;
  deviceId?: string | null;
  commType?: string | null;
}

function extractDeviceKeys(
  device?: IAndroidUsbDeviceCandidate | null,
): string[] {
  if (!device) {
    return [];
  }
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const raw of [device.connectId, device.serialNo]) {
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        keys.push(normalized);
      }
    }
  }
  return keys;
}

// Tracks live Android USB device presence from SDK connect/disconnect events
// and latest USB/combined search results, without disposing the SDK on plug/unplug.
export class AndroidUsbPresenceTracker {
  private trackedDevices: Array<Set<string>> = [];

  private hasAnonymousUsbDevice = false;

  hasUsbDevice(): boolean {
    if (!platformEnv.isNativeAndroid) {
      return false;
    }
    return this.trackedDevices.length > 0 || this.hasAnonymousUsbDevice;
  }

  isUsbDeviceId(connectId?: string | null): boolean {
    if (!platformEnv.isNativeAndroid || typeof connectId !== 'string') {
      return false;
    }
    const normalized = connectId.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return this.trackedDevices.some((group) => group.has(normalized));
  }

  handleDeviceConnect(device?: IAndroidUsbDeviceCandidate | null): void {
    if (!platformEnv.isNativeAndroid || device?.commType !== 'usb') {
      return;
    }
    const keys = extractDeviceKeys(device);
    if (keys.length === 0) {
      this.hasAnonymousUsbDevice = true;
      return;
    }
    this.upsertDeviceKeys(keys);
  }

  handleDeviceDisconnect(device?: IAndroidUsbDeviceCandidate | null): void {
    if (!platformEnv.isNativeAndroid || !device) {
      return;
    }
    if (device.commType && device.commType !== 'usb') {
      return;
    }
    const keys = extractDeviceKeys(device);
    if (keys.length === 0) {
      if (device.commType === 'usb') {
        this.clear();
      }
      return;
    }
    const keySet = new Set(keys);
    const prevLength = this.trackedDevices.length;
    this.trackedDevices = this.trackedDevices.filter(
      (group) => ![...group].some((k) => keySet.has(k)),
    );
    if (
      device.commType === 'usb' ||
      this.trackedDevices.length !== prevLength
    ) {
      this.hasAnonymousUsbDevice = false;
    }
  }

  noteSearchDevicesResult(
    devices: Array<IAndroidUsbDeviceCandidate> | undefined,
    options?: { transportType?: string },
  ): void {
    if (!platformEnv.isNativeAndroid) {
      return;
    }
    if (options?.transportType === 'ble') {
      return;
    }
    const usbDevices = (devices ?? []).filter((d) => d?.commType === 'usb');
    this.trackedDevices = [];
    this.hasAnonymousUsbDevice = false;
    for (const device of usbDevices) {
      const keys = extractDeviceKeys(device);
      if (keys.length > 0) {
        this.upsertDeviceKeys(keys);
      } else {
        this.hasAnonymousUsbDevice = true;
      }
    }
  }

  clear(): void {
    this.trackedDevices = [];
    this.hasAnonymousUsbDevice = false;
  }

  private upsertDeviceKeys(keys: string[]): void {
    const incoming = new Set(keys);
    const merged = new Set(keys);
    const remaining: Array<Set<string>> = [];
    for (const group of this.trackedDevices) {
      if ([...group].some((k) => incoming.has(k))) {
        for (const k of group) {
          merged.add(k);
        }
      } else {
        remaining.push(group);
      }
    }
    remaining.push(merged);
    this.trackedDevices = remaining;
  }
}
