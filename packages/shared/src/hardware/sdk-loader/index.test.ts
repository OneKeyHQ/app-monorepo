import { importHardwareSDK } from '.';

import { EHardwareTransportType } from '../../../types';

const mockCommonSdk = { transport: 'direct' };
const mockIframeSdkFactory = jest.fn(() => ({
  __esModule: true,
  default: { HardwareSDKTopLevel: {} },
}));

jest.mock('@onekeyfe/hd-common-connect-sdk', () => ({
  __esModule: true,
  default: mockCommonSdk,
}));

jest.mock('@onekeyfe/hd-web-sdk', () => mockIframeSdkFactory());

describe('importHardwareSDK', () => {
  beforeEach(() => {
    mockIframeSdkFactory.mockClear();
  });

  it.each([
    EHardwareTransportType.WEBUSB,
    EHardwareTransportType.DesktopWebBle,
  ])(
    'uses the iframe-free common SDK for %s',
    async (hardwareTransportType) => {
      await expect(importHardwareSDK({ hardwareTransportType })).resolves.toBe(
        mockCommonSdk,
      );
      expect(mockIframeSdkFactory).not.toHaveBeenCalled();
    },
  );
});
