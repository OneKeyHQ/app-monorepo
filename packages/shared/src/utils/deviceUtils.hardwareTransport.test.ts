import { EHardwareTransportType } from '@onekeyhq/shared/types';

import platformEnv from '../platformEnv';

import deviceUtils from './deviceUtils';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktopLinux: false,
    isNative: false,
    isSupportDesktopBle: true,
    isSupportWebUSB: true,
  },
}));

jest.mock('../hardware/instance', () => ({
  CoreSDKLoader: jest.fn(),
}));

describe('deviceUtils hardware transport policy', () => {
  const mockPlatformEnv = platformEnv as { isDesktopLinux: boolean };

  beforeEach(() => {
    mockPlatformEnv.isDesktopLinux = false;
  });

  it('normalizes Bridge to WebUSB on Linux desktop', () => {
    mockPlatformEnv.isDesktopLinux = true;

    expect(
      deviceUtils.getDesktopUsbTransportType({
        usbCommunicationMode: 'bridge',
      }),
    ).toBe(EHardwareTransportType.WEBUSB);
    expect(
      deviceUtils.normalizeHardwareTransportTypeForPlatform({
        transportType: EHardwareTransportType.Bridge,
      }),
    ).toBe(EHardwareTransportType.WEBUSB);
  });

  it('keeps the Bridge development override on other desktop platforms', () => {
    expect(
      deviceUtils.getDesktopUsbTransportType({
        usbCommunicationMode: 'bridge',
      }),
    ).toBe(EHardwareTransportType.Bridge);
  });

  it('forces Protocol V2 USB traffic to WebUSB when Bridge is configured', () => {
    expect(
      deviceUtils.getDesktopUsbTransportType({
        usbCommunicationMode: 'bridge',
        connectProtocol: 'V2',
      }),
    ).toBe(EHardwareTransportType.WEBUSB);
    expect(
      deviceUtils.normalizeHardwareTransportTypeForPlatform({
        transportType: EHardwareTransportType.Bridge,
        connectProtocol: 'V2',
      }),
    ).toBe(EHardwareTransportType.WEBUSB);
  });
});
