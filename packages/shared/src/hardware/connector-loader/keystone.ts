import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Web/desktop-renderer default (WebUSB). Native stays QR-only; the MV3
// background resolves the offscreen bridge variant instead.
export const createKeystoneUsbConnector = async (): Promise<IConnector> => {
  const { createKeystoneWebUsbConnector } =
    await import('@onekeyfe/hwk-keystone-connector-usb/webusb');
  return createKeystoneWebUsbConnector();
};

// requestKeystoneUsbPermission() is deliberately not re-exported: WebUSB's
// requestDevice() must run on the UI thread inside the user gesture, so permission goes through usePromptWebDeviceAccess in kit, never a kit-bg service.
