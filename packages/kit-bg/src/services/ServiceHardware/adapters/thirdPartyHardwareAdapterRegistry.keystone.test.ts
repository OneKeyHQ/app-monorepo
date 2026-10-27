import { KeystoneAdapter as HwkKeystoneAdapter } from '@onekeyfe/hwk-keystone-adapter';

import { createKeystoneUsbConnector } from '@onekeyhq/shared/src/hardware/connector-loader/keystone';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { getOffscreenHardwareBridgeClient } from './offscreenHardwareBridgeClient';
import { thirdPartyHardwareAdapterRegistry } from './thirdPartyHardwareAdapterRegistry';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { hardware: { sdkLog: { log: jest.fn() } } },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNative: false,
  isExtensionBackground: false,
}));

jest.mock('@onekeyhq/shared/src/hardware/connector-loader/keystone', () => ({
  createKeystoneUsbConnector: jest.fn(),
}));

jest.mock('@onekeyfe/hwk-keystone-adapter', () => ({
  KeystoneAdapter: jest.fn(),
}));

jest.mock('./KeystoneAdapter', () => ({
  KeystoneAdapter: jest.fn().mockImplementation((hw) => ({ hw })),
}));

jest.mock('./offscreenHardwareBridgeClient', () => ({
  getOffscreenHardwareBridgeClient: jest.fn(),
}));

describe('Keystone adapter initialization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(platformEnv, {
      isNative: false,
      isExtensionBackground: false,
    });
  });

  it('initializes native QR without attempting to create a USB connector', async () => {
    Object.assign(platformEnv, { isNative: true });
    jest
      .mocked(createKeystoneUsbConnector)
      .mockRejectedValue(new Error('USB is unavailable on native'));

    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.keystone]();

    expect(createKeystoneUsbConnector).not.toHaveBeenCalled();
    expect(HwkKeystoneAdapter).toHaveBeenCalledWith({
      origin: 'OneKey',
      usbConnector: undefined,
    });
  });

  it('passes the direct USB connector to the SDK on web and desktop', async () => {
    const connector = { connectionType: 'usb' };
    jest
      .mocked(createKeystoneUsbConnector)
      .mockResolvedValue(connector as never);

    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.keystone]();

    expect(createKeystoneUsbConnector).toHaveBeenCalledWith();
    expect(HwkKeystoneAdapter).toHaveBeenCalledWith({
      origin: 'OneKey',
      usbConnector: connector,
    });
  });

  it('uses the offscreen bridge in the extension background', async () => {
    Object.assign(platformEnv, { isExtensionBackground: true });
    const bridge = { call: jest.fn() };
    jest
      .mocked(getOffscreenHardwareBridgeClient)
      .mockReturnValue(bridge as never);

    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.keystone]();

    expect(createKeystoneUsbConnector).toHaveBeenCalledWith({ bridge });
  });

  it('surfaces USB initialization errors instead of creating a QR-only adapter', async () => {
    const error = new Error('USB connector failed to load');
    jest.mocked(createKeystoneUsbConnector).mockRejectedValue(error);

    await expect(
      thirdPartyHardwareAdapterRegistry[EHardwareVendor.keystone](),
    ).rejects.toBe(error);
    expect(HwkKeystoneAdapter).not.toHaveBeenCalled();
  });
});
