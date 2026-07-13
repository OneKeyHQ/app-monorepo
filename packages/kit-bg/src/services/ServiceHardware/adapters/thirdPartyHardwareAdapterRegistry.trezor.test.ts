import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  resetTrezorSdkLogSubscriptionForTesting,
  thirdPartyHardwareAdapterRegistry,
} from './thirdPartyHardwareAdapterRegistry';

const mockCreateTrezorConnector = jest.fn();

type IHwkSdkLogEvent = {
  type: 'log';
  level?: 'debug' | 'info' | 'warn' | 'error';
  message: string;
};

let trezorSdkEventListener: ((event: IHwkSdkLogEvent) => void) | undefined;
let trezorSdkEventUnsubscribe: jest.Mock | undefined;
const mockOnTrezorSdkEvent = jest.fn(
  (listener: (event: IHwkSdkLogEvent) => void) => {
    trezorSdkEventListener = listener;
    trezorSdkEventUnsubscribe = jest.fn();
    return trezorSdkEventUnsubscribe;
  },
);

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isExtensionBackground: false,
}));

jest.mock('@onekeyhq/shared/src/hardware/connector-loader/trezor', () => ({
  createTrezorConnector: (...args: unknown[]): unknown =>
    mockCreateTrezorConnector(...args) as unknown,
}));

jest.mock('@onekeyfe/hwk-trezor-adapter', () => ({
  TrezorAdapter: jest.fn().mockImplementation((connector) => ({
    connector,
    on: jest.fn(),
    off: jest.fn(),
  })),
  onSdkEvent: (listener: (event: IHwkSdkLogEvent) => void) =>
    mockOnTrezorSdkEvent(listener),
}));

jest.mock('./TrezorAdapter', () => ({
  TrezorAdapter: jest.fn().mockImplementation((hw) => ({ hw })),
}));

jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getAllDevices: jest.fn().mockResolvedValue({ devices: [] }),
  },
}));

// Retrieve the mock fns from the registered mocks (not via an outer const that
// the hoisted jest.mock factory would hit in the temporal dead zone).
const mockSdkLog: jest.Mock = jest.requireMock(
  '@onekeyhq/shared/src/logger/logger',
).defaultLogger.hardware.sdkLog.log;
const mockGetAllDevices: jest.Mock = jest.requireMock(
  '@onekeyhq/kit-bg/src/dbs/local/localDb',
).default.getAllDevices;

describe('thirdPartyHardwareAdapterRegistry Trezor logging', () => {
  beforeEach(() => {
    resetTrezorSdkLogSubscriptionForTesting();
    jest.clearAllMocks();
    trezorSdkEventListener = undefined;
    trezorSdkEventUnsubscribe = undefined;
    mockCreateTrezorConnector.mockResolvedValue({
      setKnownCredentials: jest.fn(),
    });
  });

  it('forwards Trezor HWK adapter logs into sdkLog', async () => {
    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.trezor]();

    expect(mockOnTrezorSdkEvent).toHaveBeenCalledWith(expect.any(Function));

    trezorSdkEventListener?.({
      type: 'log',
      level: 'debug',
      message:
        '[TrezorAdapter][RES] {"method":"btcSignMessage","success":false}',
    });

    expect(mockSdkLog).toHaveBeenCalledWith(
      '[hwk] [TrezorAdapter][RES] {"method":"btcSignMessage","success":false}',
    );
  });

  it('keeps a single Trezor SDK log subscription across repeated factory calls', async () => {
    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.trezor]();
    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.trezor]();

    expect(mockOnTrezorSdkEvent).toHaveBeenCalledTimes(1);
    expect(trezorSdkEventUnsubscribe).not.toHaveBeenCalled();
  });

  it('warm-loads only valid THP credentials into the connector', async () => {
    const validCredential = {
      credential: 'credential',
      host_static_key: 'host-static-key',
      trezor_static_public_key: 'trezor-static-public-key',
      autoconnect: false,
    };
    const setKnownCredentials = jest.fn();
    mockCreateTrezorConnector.mockResolvedValueOnce({ setKnownCredentials });
    const dbDevice: IDBDevice = {
      id: 'db-device-id',
      name: 'Trezor',
      features: '{}',
      connectId: 'connect-id',
      uuid: 'uuid',
      deviceId: 'device-id',
      deviceType: EDeviceType.Unknown,
      settingsRaw: '{}',
      settings: {
        thpCredentials: [validCredential, { credential: 'missing-host-key' }],
      },
      createdAt: 0,
      updatedAt: 0,
    };
    mockGetAllDevices.mockResolvedValueOnce({
      devices: [dbDevice],
    });

    await thirdPartyHardwareAdapterRegistry[EHardwareVendor.trezor]();

    expect(setKnownCredentials).toHaveBeenCalledWith([validCredential]);
    expect(mockSdkLog).toHaveBeenCalledWith(
      '[3rdPartyHW][Registry] trezor warm-load credentials count=2 valid=1',
    );
  });
});
