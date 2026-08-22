import { createTrezorWebUsbConnector } from '@onekeyfe/hwk-trezor-connector-webusb';

import OffscreenApiThirdPartyHardware from './OffscreenApiThirdPartyHardware';
import { emitOffscreenEventToBackground } from './offscreenEventBus';

const mockConfigure = jest.fn();
const mockLedgerCall = jest.fn();
const mockLedgerConfigure = jest.fn();
const mockLedgerReset = jest.fn();

jest.mock('./offscreenEventBus', () => ({
  emitOffscreenEventToBackground: jest.fn(),
}));

jest.mock('@onekeyfe/hwk-trezor-connector-webusb', () => ({
  createTrezorWebUsbConnector: jest.fn(() => ({
    searchDevices: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    setKnownCredentials: jest.fn(),
    configure: mockConfigure,
  })),
}));

jest.mock('@onekeyfe/hwk-ledger-adapter', () => ({
  onSdkEvent: jest.fn(),
}));

jest.mock('@onekeyfe/hwk-ledger-connector-webhid', () => ({
  createLedgerWebHidConnector: jest.fn(() => ({
    call: mockLedgerCall,
    configure: mockLedgerConfigure,
    reset: mockLedgerReset,
    on: jest.fn(),
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
    mockLedgerCall.mockResolvedValue({
      isGenuine: true,
      deviceId: 'device-id',
    });
    mockLedgerConfigure.mockResolvedValue(undefined);
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

  it('forwards connector runtime configuration across the offscreen boundary', async () => {
    const api = new OffscreenApiThirdPartyHardware();

    await api.configure({
      vendor: 'trezor',
      config: {
        ledgerGenuineCheckWebSocketUrl:
          'wss://attestation.onekey.test/session/opaque',
      },
    });

    expect(mockConfigure).toHaveBeenCalledWith({
      ledgerGenuineCheckWebSocketUrl:
        'wss://attestation.onekey.test/session/opaque',
    });
  });

  it('clears a one-shot Ledger relay locally before returning the result', async () => {
    const api = new OffscreenApiThirdPartyHardware();

    await api.configure({
      vendor: 'ledger',
      config: {
        ledgerGenuineCheckWebSocketUrl:
          'wss://attestation.onekey.test/session/opaque',
      },
    });

    await expect(
      api.call({
        vendor: 'ledger',
        sessionId: 'ledger-session',
        method: 'getDeviceGenuineCheck',
        callParams: {},
      }),
    ).resolves.toEqual({
      isGenuine: true,
      deviceId: 'device-id',
    });

    expect(mockLedgerConfigure).toHaveBeenCalledWith({
      ledgerGenuineCheckWebSocketUrl: undefined,
    });
    expect(mockLedgerReset).toHaveBeenCalledTimes(1);
  });

  it('clears a one-shot Ledger relay locally when genuine check fails', async () => {
    const api = new OffscreenApiThirdPartyHardware();
    await api.configure({
      vendor: 'ledger',
      config: {
        ledgerGenuineCheckWebSocketUrl:
          'wss://attestation.onekey.test/session/opaque',
      },
    });
    mockLedgerCall.mockRejectedValueOnce(new Error('relay disconnected'));

    await expect(
      api.call({
        vendor: 'ledger',
        sessionId: 'ledger-session',
        method: 'getDeviceGenuineCheck',
        callParams: {},
      }),
    ).rejects.toThrow('relay disconnected');

    expect(mockLedgerConfigure).toHaveBeenCalledWith({
      ledgerGenuineCheckWebSocketUrl: undefined,
    });
    expect(mockLedgerReset).toHaveBeenCalledTimes(1);
  });

  it('keeps the Ledger connector session after a default genuine check', async () => {
    const api = new OffscreenApiThirdPartyHardware();

    await api.call({
      vendor: 'ledger',
      sessionId: 'ledger-session',
      method: 'getDeviceGenuineCheck',
      callParams: {},
    });

    expect(mockLedgerConfigure).not.toHaveBeenCalled();
    expect(mockLedgerReset).not.toHaveBeenCalled();
  });
});
