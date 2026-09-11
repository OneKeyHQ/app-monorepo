import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  EThirdPartyHardwareUiAction,
  thirdPartyAppInstallAtom,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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
        interactionId: 'hwk-ledger-interaction',
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
      acquireInteraction: jest
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
        interactionId: 'hwk-ledger-operation',
        connectId: 'selected-ble',
      },
    });
    expect(hw.acquireInteraction).toHaveBeenCalledWith('', context);
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
      releaseInteraction: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = new LedgerAdapter(hw as never);

    await expect(adapter.connectDevice('ledger-target')).resolves.toEqual({
      success: false,
      payload: { code: 10_113 },
    });
    expect(hw.releaseInteraction).toHaveBeenCalledWith(
      'hwk-ledger-interaction',
    );
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
      activeInteractionId?: string;
    };
    adapter.activeInteractionId = 'hwk-ledger-current';

    listeners.get('interaction-ended')?.({
      payload: { interactionId: 'hwk-ledger-stale' },
    });
    expect(setUiState).not.toHaveBeenCalled();
    expect(setInstallState).not.toHaveBeenCalled();

    listeners.get('interaction-ended')?.({
      payload: { interactionId: 'hwk-ledger-current' },
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
