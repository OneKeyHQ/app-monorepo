import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  EThirdPartyHardwareUiAction,
  thirdPartyAppInstallAtom,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { LedgerAdapter } from './LedgerAdapter';

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
      searchDevices: jest.fn().mockResolvedValue([
        {
          vendor: 'ledger',
          connectId: '',
          deviceId: '',
          connectionType: 'usb',
          model: 'nanoX',
          modelName: 'Ledger Nano X',
          firmwareVersion: '',
        },
      ]),
      on: jest.fn(),
    };
    const adapter = new LedgerAdapter(hw as never);

    await expect(adapter.searchDeviceTargets()).resolves.toEqual([
      {
        searchTargetId: '',
        vendor: 'ledger',
        connectionType: 'usb',
        kind: 'physical',
        label: undefined,
        model: 'nanoX',
        modelName: 'Ledger Nano X',
        serialNumber: undefined,
      },
    ]);
    expect(hw.searchDevices).toHaveBeenCalledTimes(1);
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
      action: EThirdPartyHardwareUiAction.requestDeviceSelection,
      vendor: 'ledger',
      payload: {
        reason: undefined,
        message: undefined,
        path: undefined,
        accountIndex: undefined,
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
