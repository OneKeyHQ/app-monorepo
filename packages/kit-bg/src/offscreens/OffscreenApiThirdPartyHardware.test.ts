import { createTrezorWebUsbConnector } from '@onekeyfe/hwk-trezor-connector-webusb';

import OffscreenApiThirdPartyHardware from './OffscreenApiThirdPartyHardware';
import { emitOffscreenEventToBackground } from './offscreenEventBus';

jest.mock('./offscreenEventBus', () => ({
  emitOffscreenEventToBackground: jest.fn(),
}));

jest.mock('@onekeyfe/hwk-trezor-connector-webusb', () => ({
  createTrezorWebUsbConnector: jest.fn(() => ({
    searchDevices: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    setKnownCredentials: jest.fn(),
  })),
}));

const mockedCreateTrezorWebUsbConnector = jest.mocked(
  createTrezorWebUsbConnector,
);
const mockedEmitOffscreenEventToBackground = jest.mocked(
  emitOffscreenEventToBackground,
);

describe('OffscreenApiThirdPartyHardware Trezor logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards Trezor HWK core and transport logs through hwkSdkEvent', async () => {
    const api = new OffscreenApiThirdPartyHardware();

    await api.searchDevices({ vendor: 'trezor' });

    const options = mockedCreateTrezorWebUsbConnector.mock.calls[0]?.[0];
    expect(options?.thp).toEqual(
      expect.objectContaining({
        appName: 'OneKey Wallet',
        hostName: expect.not.stringMatching(/^OneKey$/),
      }),
    );
    expect(options?.thp?.logger).toEqual(expect.any(Function));
    expect(options?.transportOptions?.logger).toEqual(expect.any(Function));

    options?.thp?.logger?.({
      level: 'info',
      scope: 'trezor-core',
      event: 'session.method.response',
      data: {
        name: 'btcSignMessage',
        responseType: 'Failure',
        message: 'Failure_ActionCancelled',
      },
    });
    options?.transportOptions?.logger?.({
      level: 'error',
      scope: 'trezor-webusb',
      event: 'webusb.transferIn.error',
      data: {
        error: 'Device disconnected',
      },
    });

    expect(mockedEmitOffscreenEventToBackground).toHaveBeenCalledWith(
      'hwkSdkEvent',
      expect.objectContaining({
        type: 'log',
        message:
          '[trezor-core] session.method.response {"name":"btcSignMessage","responseType":"Failure","message":"Failure_ActionCancelled"}',
      }),
    );
    expect(mockedEmitOffscreenEventToBackground).toHaveBeenCalledWith(
      'hwkSdkEvent',
      expect.objectContaining({
        type: 'log',
        message:
          '[trezor-webusb] webusb.transferIn.error {"error":"Device disconnected"}',
      }),
    );
  });
});
