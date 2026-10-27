import { DEVICE, EConnectorInteraction } from '@onekeyfe/hwk-adapter-core';
import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
  type IThirdPartyLiveConnectionState,
  thirdPartyAppInstallAtom,
  thirdPartyHardwareUiStateAtom,
  thirdPartyLiveConnectionAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { LedgerAdapter } from './LedgerAdapter';

import type { IHardwareWallet } from '@onekeyfe/hwk-adapter-core';

jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
    getDevice: jest.fn(),
    updateDeviceConnectId: jest.fn(),
  },
}));

describe('LedgerAdapter', () => {
  it('records the channel the SDK connected the Ledger over until it disconnects', async () => {
    const handlers = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((event: string, handler: (event: unknown) => void) => {
        handlers.set(event, handler);
      }),
    };
    let live: IThirdPartyLiveConnectionState | undefined;
    const atomSet = jest
      .spyOn(thirdPartyLiveConnectionAtom, 'set')
      .mockImplementation(async (update) => {
        live = typeof update === 'function' ? update(live) : update;
      });
    try {
      expect(new LedgerAdapter(hw as never).vendor).toBe('ledger');
      const emit = (event: string, payload: unknown) =>
        handlers.get(event)?.({ type: event, payload });

      emit(DEVICE.CONNECT, { connectId: 'ble-1', connectionType: 'ble' });
      await Promise.resolve();
      expect(live).toEqual({
        vendor: 'ledger',
        connectId: 'ble-1',
        connectionType: 'ble',
      });

      emit(DEVICE.DISCONNECT, { connectId: 'usb-1' });
      await Promise.resolve();
      expect(live?.connectId).toBe('ble-1');

      emit(DEVICE.DISCONNECT, { connectId: 'ble-1' });
      await Promise.resolve();
      expect(live).toBeUndefined();
    } finally {
      atomSet.mockRestore();
    }
  });

  it('passes resetSession through to the HWK adapter searchDevices call', async () => {
    const hw = {
      searchDevices: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
    };
    const adapter = new LedgerAdapter(hw as never);

    await adapter.searchDevices({ resetSession: true });

    expect(hw.searchDevices).toHaveBeenCalledWith({ resetSession: true });
  });

  it('returns search targets through the Ledger discovery path', async () => {
    const hw = {
      searchDeviceTargets: jest.fn().mockResolvedValue([
        {
          searchTargetId: '',
          searchTargetReusePolicy: 'current-discovery',
          vendor: 'ledger',
          connectionType: 'usb',
          kind: 'physical',
          model: 'nanoX',
          modelName: 'Ledger Nano X',
        },
      ]),
      on: jest.fn(),
    };
    const adapter = new LedgerAdapter(hw as never);

    await expect(adapter.searchDeviceTargets()).resolves.toEqual([
      {
        searchTargetId: '',
        searchTargetReusePolicy: 'current-discovery',
        vendor: 'ledger',
        connectionType: 'usb',
        kind: 'physical',
        label: undefined,
        model: 'nanoX',
        modelName: 'Ledger Nano X',
        serialNumber: undefined,
      },
    ]);
    expect(hw.searchDeviceTargets).toHaveBeenCalledTimes(1);
  });

  it('connects Ledger USB and returns the SDK interaction id', async () => {
    const hw = {
      activeTransport: 'hid',
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'hwk-ledger-interaction',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: { connectId: '', deviceId: '' },
      }),
    };
    const adapter = new LedgerAdapter(hw as never);

    await expect(adapter.connectDevice('')).resolves.toMatchObject({
      success: true,
      payload: {
        operationId: 'hwk-ledger-interaction',
        connectId: '',
        deviceId: '',
      },
    });
    expect(hw.connectDevice).toHaveBeenCalledWith('');
    expect(hw.getDeviceInfo).toHaveBeenCalledWith('hwk-ledger-interaction', '');
  });

  it('forwards operation connection context to SDK acquire instead of explicit connect', async () => {
    const hw = {
      activeTransport: 'ble',
      on: jest.fn(),
      connectDevice: jest.fn(),
      acquireOperation: jest
        .fn()
        .mockResolvedValue({ success: true, payload: 'hwk-ledger-operation' }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: true,
        payload: { connectId: 'selected-ble', deviceId: '' },
      }),
    };
    const adapter = new LedgerAdapter(hw as unknown as IHardwareWallet);
    const context = {
      knownConnections: [{ transport: 'ble' as const, connectId: 'old-ble' }],
      extra: { dbDeviceId: 'ledger-db' },
    };
    await expect(adapter.connectDevice('', context)).resolves.toMatchObject({
      success: true,
      payload: {
        operationId: 'hwk-ledger-operation',
        connectId: 'selected-ble',
      },
    });
    expect(hw.acquireOperation).toHaveBeenCalledWith('', context);
    expect(hw.connectDevice).not.toHaveBeenCalled();
    expect(hw.getDeviceInfo).toHaveBeenCalledWith('hwk-ledger-operation', '');
  });

  it('releases the interaction when connected device info cannot be loaded', async () => {
    const hw = {
      activeTransport: 'hid',
      on: jest.fn(),
      connectDevice: jest.fn().mockResolvedValue({
        success: true,
        payload: 'hwk-ledger-interaction',
      }),
      getDeviceInfo: jest.fn().mockResolvedValue({
        success: false,
        payload: { code: 10_113 },
      }),
      releaseOperation: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new LedgerAdapter(hw as never);

    await expect(adapter.connectDevice('ledger-target')).resolves.toEqual({
      success: false,
      payload: { code: 10_113 },
    });
    expect(hw.releaseOperation).toHaveBeenCalledWith('hwk-ledger-interaction');
  });

  it('only clears Ledger UI for the interaction that currently owns it', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
      }),
    };
    const setUiState = jest
      .spyOn(thirdPartyHardwareUiStateAtom, 'set')
      .mockResolvedValue(undefined);
    const setInstallState = jest
      .spyOn(thirdPartyAppInstallAtom, 'set')
      .mockResolvedValue(undefined);
    const adapter = new LedgerAdapter(hw as never) as unknown as {
      activeOperationId?: string;
    };
    adapter.activeOperationId = 'hwk-ledger-current';

    listeners.get('operation-ended')?.({
      payload: { operationId: 'hwk-ledger-stale' },
    });
    expect(setUiState).not.toHaveBeenCalled();
    expect(setInstallState).not.toHaveBeenCalled();

    listeners.get('operation-ended')?.({
      payload: { operationId: 'hwk-ledger-current' },
    });
    expect(setUiState).toHaveBeenCalledWith(expect.any(Function));
    expect(setInstallState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('forwards operation-first Ledger candidates to the app picker', () => {
    const listeners = new Map<string, (event: never) => void>();
    const hw = {
      on: jest.fn((type: string, listener: (event: never) => void) => {
        listeners.set(type, listener);
      }),
    };
    const setUiState = jest
      .spyOn(thirdPartyHardwareUiStateAtom, 'set')
      .mockResolvedValue(undefined);
    const adapter = new LedgerAdapter(hw as never);
    expect(adapter.vendor).toBe('ledger');

    listeners.get(UI_REQUEST.REQUEST_SELECT_DEVICE)?.({
      type: UI_REQUEST.REQUEST_SELECT_DEVICE,
      payload: {
        requestId: 'usb-selection',
        context: {
          kind: 'select-device',
          transport: 'usb',
          reason: 'multiple-candidates',
        },
        devices: [
          {
            connectId: 'ledger-a',
            deviceId: '',
            connectionType: 'usb',
            model: 'nanoX',
            modelName: 'Ledger Nano X',
            firmwareVersion: '',
          },
          {
            connectId: 'ledger-b',
            deviceId: '',
            connectionType: 'usb',
            model: 'nanoS',
            modelName: 'Ledger Nano S',
            firmwareVersion: '',
          },
        ],
      },
    } as never);

    expect(setUiState).toHaveBeenCalledWith({
      uiRequestId: expect.any(String),
      action: EThirdPartyHardwareUiAction.requestDeviceSelection,
      vendor: 'ledger',
      payload: {
        reason: undefined,
        message: undefined,
        path: undefined,
        accountIndex: undefined,
        deviceSelection: {
          requestId: 'usb-selection',
          context: {
            kind: 'select-device',
            transport: 'usb',
            reason: 'multiple-candidates',
          },
          extra: undefined,
        },
        deviceSearchTargets: [
          expect.objectContaining({
            searchTargetId: 'ledger-a',
            vendor: 'ledger',
            model: 'nanoX',
          }),
          expect.objectContaining({
            searchTargetId: 'ledger-b',
            vendor: 'ledger',
            model: 'nanoS',
          }),
        ],
      },
    });
  });

  it('names the app to open only while checking this wallet', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const hw = {
      on: jest.fn((type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
      }),
    };
    const setUiState = jest
      .spyOn(thirdPartyHardwareUiStateAtom, 'set')
      .mockResolvedValue(undefined);
    setUiState.mockClear();
    const adapter = new LedgerAdapter(hw as never);
    const askToOpenApp = () =>
      listeners.get('ui-event')?.({
        type: EConnectorInteraction.ConfirmOpenApp,
        payload: { sessionId: 'session-1', appName: 'Bitcoin' },
      });

    askToOpenApp();
    await adapter.runWalletMatchCheck(async () => {
      askToOpenApp();
    });
    await expect(
      adapter.runWalletMatchCheck(async () => {
        throw new OneKeyLocalError({ message: 'rejected on device' });
      }),
    ).rejects.toThrow('rejected on device');
    askToOpenApp();

    expect(
      setUiState.mock.calls.map(
        ([state]) => (state as IThirdPartyHardwareUiState).payload,
      ),
    ).toEqual([
      undefined,
      { appName: 'Bitcoin', openAppReason: 'walletMatch' },
      undefined,
    ]);
    setUiState.mockRestore();
  });

  it('does not repeatedly log completed install progress', () => {
    const hw = {
      searchDevices: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
    };
    const adapter = new LedgerAdapter(hw as never) as unknown as {
      shouldLogAppInstallProgress: (params: {
        connectId: string;
        appName: string;
        progress: number;
      }) => boolean;
    };

    expect(
      adapter.shouldLogAppInstallProgress({
        connectId: '',
        appName: 'Solana',
        progress: 1,
      }),
    ).toBe(true);
    expect(
      adapter.shouldLogAppInstallProgress({
        connectId: '',
        appName: 'Solana',
        progress: 1,
      }),
    ).toBe(false);
  });
});
