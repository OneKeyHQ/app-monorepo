import { EHardwareTransportType } from '@onekeyhq/shared/types';

import platformEnv from '../platformEnv';

import deviceUtils, { isUsbHardwareTransportType } from './deviceUtils';

type IDBDevice = Parameters<typeof deviceUtils.getDeviceConnectId>[0];

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktopLinux: false,
    isNative: false,
    isNativeAndroid: false,
    isNativeIOS: false,
    isSupportDesktopBle: true,
    isSupportWebUSB: true,
  },
}));

jest.mock('../hardware/instance', () => ({
  CoreSDKLoader: jest.fn(),
}));

describe('deviceUtils hardware transport policy', () => {
  const mockPlatformEnv = platformEnv as {
    isDesktopLinux: boolean;
    isNative: boolean;
    isNativeAndroid: boolean;
    isNativeIOS: boolean;
    isSupportDesktopBle: boolean;
    isSupportWebUSB: boolean;
  };

  beforeEach(() => {
    mockPlatformEnv.isDesktopLinux = false;
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isSupportDesktopBle = true;
    mockPlatformEnv.isSupportWebUSB = true;
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

  it('keeps NativeUsb on Android and normalizes it to platform default elsewhere', () => {
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeAndroid = true;
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isSupportDesktopBle = false;
    mockPlatformEnv.isSupportWebUSB = false;
    expect(
      deviceUtils.normalizeHardwareTransportTypeForPlatform({
        transportType: EHardwareTransportType.NativeUsb,
      }),
    ).toBe(EHardwareTransportType.NativeUsb);

    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isNativeIOS = true;
    expect(
      deviceUtils.normalizeHardwareTransportTypeForPlatform({
        transportType: EHardwareTransportType.NativeUsb,
      }),
    ).toBe(EHardwareTransportType.BLE);

    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isSupportDesktopBle = true;
    mockPlatformEnv.isSupportWebUSB = true;
    expect(
      deviceUtils.normalizeHardwareTransportTypeForPlatform({
        transportType: EHardwareTransportType.NativeUsb,
      }),
    ).toBe(EHardwareTransportType.WEBUSB);
  });

  it('uses usbConnectId with connectId fallback for NativeUsb in getDeviceConnectId', () => {
    expect(
      deviceUtils.getDeviceConnectId(
        {
          connectId: 'fallback-connect-id',
          usbConnectId: 'usb-serial-123',
        } as IDBDevice,
        EHardwareTransportType.NativeUsb,
      ),
    ).toBe('usb-serial-123');

    expect(
      deviceUtils.getDeviceConnectId(
        {
          connectId: 'fallback-connect-id',
          usbConnectId: '',
        } as IDBDevice,
        EHardwareTransportType.NativeUsb,
      ),
    ).toBe('fallback-connect-id');
  });

  it('identifies USB hardware transport types via isUsbHardwareTransportType', () => {
    expect(isUsbHardwareTransportType(EHardwareTransportType.WEBUSB)).toBe(
      true,
    );
    expect(isUsbHardwareTransportType(EHardwareTransportType.Bridge)).toBe(
      true,
    );
    expect(isUsbHardwareTransportType(EHardwareTransportType.NativeUsb)).toBe(
      true,
    );
    expect(
      deviceUtils.isUsbHardwareTransportType(EHardwareTransportType.NativeUsb),
    ).toBe(true);
    expect(isUsbHardwareTransportType(EHardwareTransportType.BLE)).toBe(false);
    expect(
      isUsbHardwareTransportType(EHardwareTransportType.DesktopWebBle),
    ).toBe(false);
    expect(isUsbHardwareTransportType(undefined)).toBe(false);
  });
});
