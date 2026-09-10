import type { IConnector } from '@onekeyfe/hwk-adapter-core';

// Web/desktop-renderer default (WebUSB). Native stays QR-only; the MV3
// background resolves the offscreen bridge variant instead.
export const createKeystoneUsbConnector = async (): Promise<IConnector> => {
  const { createKeystoneWebUsbConnector } =
    await import('@onekeyfe/hwk-keystone-connector-usb/webusb');
  return createKeystoneWebUsbConnector();
};

// NOTE: the SDK also ships `requestKeystoneUsbPermission()`, but it is
// deliberately NOT re-exported here. `navigator.usb.requestDevice()` must run
// on the UI thread inside the user gesture, so the app requests permission
// via `usePromptWebDeviceAccess` in packages/kit (same as OneKey/Trezor),
// never through a kit-bg service.
