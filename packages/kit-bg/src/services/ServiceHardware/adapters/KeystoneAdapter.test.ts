import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';
import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import { thirdPartyHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { KeystoneAdapter } from './KeystoneAdapter';

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms');
  jest
    .spyOn(actual.thirdPartyHardwareUiStateAtom, 'set')
    .mockResolvedValue(undefined);
  return actual;
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        log: jest.fn(),
      },
    },
  },
}));

const mockedThirdPartyHardwareUiStateAtom = jest.mocked(
  thirdPartyHardwareUiStateAtom,
);

describe('KeystoneAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only clears Keystone UI for the interaction that currently owns it', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
    };
    const adapter = new KeystoneAdapter(hw as never) as unknown as {
      activeInteractionId?: string;
    };
    adapter.activeInteractionId = 'hwk-keystone-current';

    listeners.get('interaction-ended')?.({
      payload: { interactionId: 'hwk-keystone-stale' },
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).not.toHaveBeenCalled();

    listeners.get('interaction-ended')?.({
      payload: { interactionId: 'hwk-keystone-current' },
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('forwards QR display and scan requests to the shared UI state', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
    };

    const adapter = new KeystoneAdapter(hw as never);
    expect(adapter.vendor).toBe('keystone');
    expect(adapter.supportsAllNetworkGetAddress).toBe(true);

    listeners.get(UI_REQUEST.REQUEST_QR_DISPLAY)?.({
      payload: {
        data: {
          urType: 'crypto-request',
          urData: 'a1b2',
          animated: true,
        },
      },
    });
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith({
      action: 'request-keystone-qr-display',
      uiRequestId: expect.any(String),
      vendor: 'keystone',
      payload: {
        urType: 'crypto-request',
        urData: 'a1b2',
        animated: true,
      },
    });

    listeners.get(UI_REQUEST.REQUEST_QR_SCAN)?.({});
    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenLastCalledWith({
      action: 'request-keystone-qr-scan',
      uiRequestId: expect.any(String),
      vendor: 'keystone',
      payload: undefined,
    });
  });

  it('uses the connect id resolved by USB connection to load device info', async () => {
    const hw = {
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'hwk-keystone-interaction',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          interactionId: 'hwk-keystone-interaction',
          connectId: `keystone-wallet:${'ab'.repeat(32)}`,
          deviceId: 'ab'.repeat(32),
          model: 'Keystone 3 Pro',
          modelName: 'Keystone 3 Pro',
          firmwareVersion: '2.0.0',
          raw: { availableChannels: ['usb'] },
        },
      }),
    };
    const adapter = new KeystoneAdapter(hw as never);

    await expect(
      adapter.connectDevice('keystone-usb:serial'),
    ).resolves.toMatchObject({
      success: true,
      payload: {
        connectId: `keystone-wallet:${'ab'.repeat(32)}`,
        deviceId: 'ab'.repeat(32),
        model: 'Keystone 3 Pro',
        modelName: 'Keystone 3 Pro',
        label: undefined,
        firmwareVersion: '2.0.0',
        raw: { availableChannels: ['usb'] },
      },
    });
    expect(hw.getDeviceInfo).toHaveBeenCalledWith(
      'hwk-keystone-interaction',
      '',
    );
  });

  it('reports stable USB identity until the SDK ends the interaction', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const walletId = 'cd'.repeat(32);
    const hw = {
      on: jest.fn((eventName: string, listener: (event: unknown) => void) => {
        listeners.set(eventName, listener);
      }),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'keystone-usb-interaction',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: `keystone-wallet:${walletId}`,
          deviceId: walletId,
          model: 'Keystone 3 Pro',
          firmwareVersion: '2.0.0',
          connectionType: 'usb',
        },
      }),
    };
    const adapter = new KeystoneAdapter(hw as never);
    const events: unknown[] = [];
    adapter.onConnectionStateChange((event) => events.push(event));

    await adapter.connectDevice('keystone-search-target');
    listeners.get('interaction-ended')?.({
      payload: { interactionId: 'keystone-usb-interaction' },
    });

    expect(events).toEqual([
      {
        type: 'connected',
        device: expect.objectContaining({
          interactionId: 'keystone-usb-interaction',
          connectId: `keystone-wallet:${walletId}`,
          deviceId: walletId,
          connectionType: 'usb',
        }),
      },
      {
        type: 'disconnected',
        interactionId: 'keystone-usb-interaction',
      },
    ]);
  });

  it('serializes replacement connectDevice calls inside the vendor adapter', async () => {
    let resolveFirst:
      | ((value: { success: true; payload: string }) => void)
      | undefined;
    const firstConnect = new Promise<{ success: true; payload: string }>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const hw = {
      on: jest.fn(),
      cancel: jest.fn(),
      connectDevice: jest
        .fn()
        .mockImplementationOnce(() => firstConnect)
        .mockResolvedValueOnce({
          success: true,
          payload: 'hwk-keystone-second',
        }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          vendor: 'keystone',
          connectId: `keystone-wallet:${'ab'.repeat(32)}`,
          deviceId: 'ab'.repeat(32),
          model: 'Keystone 3 Pro',
          firmwareVersion: '2.0.0',
          connectionType: 'usb',
        },
      }),
    };
    const adapter = new KeystoneAdapter(hw as never);

    const first = adapter.connectDevice('keystone-usb:first');
    await Promise.resolve();
    expect(hw.connectDevice).toHaveBeenCalledTimes(1);

    const second = adapter.connectDevice('keystone-usb:second');
    await Promise.resolve();
    expect(hw.cancel).toHaveBeenCalledWith(undefined);
    expect(hw.connectDevice).toHaveBeenCalledTimes(1);

    resolveFirst?.({
      success: true,
      payload: 'hwk-keystone-first',
    });
    await expect(first).resolves.toMatchObject({ success: true });
    await expect(second).resolves.toMatchObject({ success: true });
    expect(hw.connectDevice).toHaveBeenCalledTimes(2);
  });

  it('keeps device search targets separate and returns a resolved interaction', async () => {
    const walletId = 'ab'.repeat(32);
    const hw = {
      on: jest.fn(),
      searchDeviceTargets: jest.fn().mockResolvedValue([
        {
          searchTargetId: 'keystone-qr:connect',
          vendor: 'keystone',
          connectionType: 'qr',
          kind: 'interactive',
        },
      ]),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'hwk-keystone-interaction',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          vendor: 'keystone',
          connectId: `keystone-wallet:${walletId}`,
          deviceId: walletId,
          model: 'Keystone 3 Pro',
          modelName: 'Keystone 3 Pro',
          firmwareVersion: '2.0.0',
          connectionType: 'qr',
        },
      }),
    };
    const adapter = new KeystoneAdapter(hw as never);

    await expect(
      adapter.searchDeviceTargets({ transportType: 'qr' }),
    ).resolves.toEqual([
      {
        searchTargetId: 'keystone-qr:connect',
        vendor: 'keystone',
        connectionType: 'qr',
        kind: 'interactive',
      },
    ]);
    await expect(adapter.connectDevice('keystone-qr:connect')).resolves.toEqual(
      {
        success: true,
        payload: {
          interactionId: 'hwk-keystone-interaction',
          connectId: `keystone-wallet:${walletId}`,
          deviceId: walletId,
          model: 'Keystone 3 Pro',
          modelName: 'Keystone 3 Pro',
          label: undefined,
          firmwareVersion: '2.0.0',
          connectionType: 'qr',
          raw: {},
        },
      },
    );
    expect(hw.connectDevice).toHaveBeenCalledWith('keystone-qr:connect');
    expect(hw.getDeviceInfo).toHaveBeenCalledWith(
      'hwk-keystone-interaction',
      '',
    );
  });

  it('uses guarded UI cleanup when a round trip is cancelled', () => {
    const hw = {
      on: jest.fn(),
      cancel: jest.fn(),
    };
    const adapter = new KeystoneAdapter(hw as never);

    adapter.cancel();

    expect(mockedThirdPartyHardwareUiStateAtom.set).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(hw.cancel).toHaveBeenCalledWith(undefined);
  });

  it('does not persist a transport session as the wallet identity', async () => {
    const hw = {
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'keystone-usb-session:1',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          connectId: 'keystone-usb-session:1',
          deviceId: '',
          model: 'Keystone 3 Pro',
          firmwareVersion: '2.0.0',
        },
      }),
      releaseInteraction: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new KeystoneAdapter(hw as never);

    const result = await adapter.connectDevice('keystone-usb:serial');

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.payload.code).toBe(HardwareErrorCode.DeviceMismatch);
    expect(hw.releaseInteraction).toHaveBeenCalledWith(
      'keystone-usb-session:1',
    );
  });

  it('releases the interaction when connected device info cannot be loaded', async () => {
    const hw = {
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'hwk-keystone-interaction',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: false,
        payload: { code: 10_113 },
      }),
      releaseInteraction: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new KeystoneAdapter(hw as never);

    await expect(adapter.connectDevice('keystone-usb:serial')).resolves.toEqual(
      {
        success: false,
        payload: { code: 10_113 },
      },
    );
    expect(hw.releaseInteraction).toHaveBeenCalledWith(
      'hwk-keystone-interaction',
    );
  });
});
