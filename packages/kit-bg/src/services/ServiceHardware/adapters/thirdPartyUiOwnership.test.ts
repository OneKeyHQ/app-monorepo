import { EConnectorInteraction, UI_REQUEST } from '@onekeyfe/hwk-adapter-core';

import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { KeystoneAdapter } from './KeystoneAdapter';
import { LedgerAdapter } from './LedgerAdapter';
import { TrezorAdapter } from './TrezorAdapter';

import type { IHardwareWallet } from './types';

jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { sdkLog: { log: jest.fn(), uiEvent: jest.fn() } },
  },
}));

function createAdapter(
  Adapter: typeof KeystoneAdapter | typeof LedgerAdapter | typeof TrezorAdapter,
  methods: Partial<IHardwareWallet> = {},
) {
  const listeners = new Map<string, (event: unknown) => void>();
  const hw = {
    ...methods,
    on: jest.fn((name: string, listener: (event: unknown) => void) => {
      listeners.set(name, listener);
    }),
    cancel: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
  } as unknown as IHardwareWallet;
  const adapter = new Adapter(hw);
  const emit = (
    type: EConnectorInteraction,
    sessionId: string,
    operationId?: string,
  ) => {
    listeners.get('ui-event')?.({ type, operationId, payload: { sessionId } });
  };
  return { adapter, emit, listeners };
}

describe('third-party UI ownership', () => {
  let state: IThirdPartyHardwareUiState | undefined;

  beforeEach(() => {
    state = undefined;
    jest
      .spyOn(thirdPartyHardwareUiStateAtom, 'set')
      .mockImplementation(async (value) => {
        state = typeof value === 'function' ? value(state) : value;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the current Trezor request owned after ignoring another operation close', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const { adapter, listeners } = createAdapter(TrezorAdapter, {
      evmGetAddress: jest.fn().mockReturnValue(pending),
    });
    const result = adapter.hw.evmGetAddress('usb', 'device', {
      path: "m/44'/60'/0'/0/0",
      operationId: 'operation-new',
    });
    listeners.get(UI_REQUEST.REQUEST_PIN)?.({
      payload: { operationId: 'operation-new' },
    });
    const expected = state;
    listeners.get(UI_REQUEST.CLOSE_UI_WINDOW)?.({
      payload: { operationId: 'operation-old' },
    });
    expect(state).toBe(expected);
    listeners.get(UI_REQUEST.CLOSE_UI_WINDOW)?.({
      payload: { operationId: 'operation-new' },
    });
    expect(state).toMatchObject({
      action: EThirdPartyHardwareUiAction.processing,
      operationId: 'operation-new',
    });
    finish({ success: true, payload: { address: 'synthetic-address' } });
    await result;
    expect(state).toBeUndefined();
  });

  it.each([
    [LedgerAdapter, UI_REQUEST.REQUEST_BTC_HIGH_INDEX_CONFIRM],
    [TrezorAdapter, UI_REQUEST.REQUEST_PIN],
  ] as const)(
    '%p ignores a close event from another operation',
    (Adapter, requestType) => {
      const { listeners } = createAdapter(Adapter);
      listeners.get(requestType)?.({
        payload: { operationId: 'operation-new' },
      });
      const expected = state;
      listeners.get(UI_REQUEST.CLOSE_UI_WINDOW)?.({
        payload: { operationId: 'operation-old' },
      });
      expect(state).toBe(expected);
      listeners.get(UI_REQUEST.CLOSE_UI_WINDOW)?.({
        payload: { operationId: 'operation-new' },
      });
      expect(state).toBeUndefined();
    },
  );

  it.each([
    [LedgerAdapter, UI_REQUEST.REQUEST_BTC_HIGH_INDEX_CONFIRM],
    [TrezorAdapter, UI_REQUEST.REQUEST_PIN],
    [KeystoneAdapter, UI_REQUEST.REQUEST_QR_SCAN],
  ] as const)(
    '%p ends only UI requests explicitly owned by the ended operation',
    async (Adapter, requestType) => {
      for (const requestOperationId of [
        undefined,
        'operation-new',
        'operation-old',
      ]) {
        const { adapter, listeners } = createAdapter(Adapter);
        const connected = adapter as unknown as { activeOperationId?: string };
        connected.activeOperationId = 'operation-old';
        listeners.get(requestType)?.({
          payload: {
            ...(requestOperationId ? { operationId: requestOperationId } : {}),
            path: "m/84'/0'/100'",
            accountIndex: 100,
          },
        });
        const expected = state;
        expect(expected).toBeDefined();
        if (requestOperationId) {
          expect(expected).toMatchObject({ operationId: requestOperationId });
        }

        listeners.get('operation-ended')?.({
          payload: { operationId: 'operation-old', reason: 'timeout' },
        });
        await Promise.resolve();
        if (requestOperationId === 'operation-old')
          expect(state).toBeUndefined();
        else expect(state).toBe(expected);
      }
    },
  );

  it.each([LedgerAdapter, TrezorAdapter, KeystoneAdapter])(
    '%p completion, cancellation and reset preserve another vendor prompt',
    async (Adapter) => {
      const old = createAdapter(Adapter);
      const next = createAdapter(
        Adapter === KeystoneAdapter ? LedgerAdapter : KeystoneAdapter,
      );
      old.emit(EConnectorInteraction.ConfirmOnDevice, 'old');
      next.emit(EConnectorInteraction.ConfirmOnDevice, 'next');
      const expected = state;

      old.emit(EConnectorInteraction.InteractionComplete, 'old');
      expect(state).toBe(expected);
      old.adapter.cancel();
      expect(state).toBe(expected);
      await old.adapter.reset();
      expect(state).toBe(expected);

      next.emit(EConnectorInteraction.InteractionComplete, 'next');
      expect(state).toBeUndefined();
    },
  );

  it.each([LedgerAdapter, TrezorAdapter, KeystoneAdapter])(
    '%p ignores completion from a previous SDK session',
    (Adapter) => {
      const { emit } = createAdapter(Adapter);
      emit(EConnectorInteraction.ConfirmOnDevice, 'old');
      emit(EConnectorInteraction.ConfirmOnDevice, 'new');
      const expected = state;
      emit(EConnectorInteraction.InteractionComplete, 'old');
      expect(state).toBe(expected);
      emit(EConnectorInteraction.InteractionComplete, 'new');
      expect(state).toBeUndefined();
    },
  );

  it.each([LedgerAdapter, TrezorAdapter, KeystoneAdapter])(
    '%p ignores an older operation completion on the same session',
    (Adapter) => {
      const { emit } = createAdapter(Adapter);
      emit(
        EConnectorInteraction.ConfirmOnDevice,
        'same-session',
        'operation-new',
      );
      const expected = state;
      emit(
        EConnectorInteraction.InteractionComplete,
        'same-session',
        'operation-old',
      );
      expect(state).toBe(expected);
      emit(
        EConnectorInteraction.InteractionComplete,
        'same-session',
        'operation-new',
      );
      expect(state).toBeUndefined();
    },
  );

  it.each([TrezorAdapter, KeystoneAdapter])(
    '%p restores processing only for the current operation on the same session',
    async (Adapter) => {
      let finish: (value: unknown) => void = () => undefined;
      const pending = new Promise<unknown>((resolve) => {
        finish = resolve;
      });
      const { adapter, emit } = createAdapter(Adapter, {
        evmGetAddress: jest.fn().mockReturnValue(pending),
      });
      const call = adapter.hw.evmGetAddress(
        'synthetic-wallet',
        'synthetic-device',
        {
          path: "m/44'/60'/0'/0/0",
          operationId: 'operation-new',
        },
      );
      try {
        emit(
          EConnectorInteraction.ConfirmOnDevice,
          'same-session',
          'operation-new',
        );
        const expected = state;
        emit(
          EConnectorInteraction.InteractionComplete,
          'same-session',
          'operation-old',
        );
        expect(state).toBe(expected);
        emit(
          EConnectorInteraction.InteractionComplete,
          'same-session',
          'operation-new',
        );
        expect(state).toMatchObject({
          action: EThirdPartyHardwareUiAction.processing,
          operationId: 'operation-new',
        });
      } finally {
        finish({ success: true, payload: { address: 'synthetic-address' } });
        await call;
      }
    },
  );

  it.each([LedgerAdapter, TrezorAdapter, KeystoneAdapter])(
    '%p reset cannot clear a replacement adapter publication',
    async (Adapter) => {
      const old = createAdapter(Adapter);
      const next = createAdapter(Adapter);
      old.emit(EConnectorInteraction.ConfirmOnDevice, 'old');
      next.emit(EConnectorInteraction.ConfirmOnDevice, 'next');
      const expected = state;
      await old.adapter.reset();
      expect(state).toBe(expected);
    },
  );

  it.each([LedgerAdapter, TrezorAdapter, KeystoneAdapter])(
    '%p targeted cancellation preserves the prompt until its own completion',
    (Adapter) => {
      const { adapter, emit, listeners } = createAdapter(Adapter);
      emit(EConnectorInteraction.ConfirmOnDevice, 'current-session');
      const expected = state;
      adapter.cancel('hwk:runtime:operation:trezor:old');
      listeners.get('operation-ended')?.({
        payload: { operationId: 'hwk:runtime:operation:trezor:old' },
      });
      expect(state).toBe(expected);
      adapter.cancel('');
      expect(state).toBe(expected);
      adapter.cancel('current-connect-id');
      expect(state).toBe(expected);
      emit(EConnectorInteraction.InteractionComplete, 'old-session');
      expect(state).toBe(expected);
      emit(EConnectorInteraction.InteractionComplete, 'current-session');
      expect(state).toBeUndefined();
    },
  );

  it.each([LedgerAdapter, TrezorAdapter, KeystoneAdapter])(
    '%p untargeted cancellation still clears its current prompt',
    (Adapter) => {
      const { adapter, emit } = createAdapter(Adapter);
      emit(EConnectorInteraction.ConfirmOnDevice, 'current-session');
      adapter.cancel();
      expect(state).toBeUndefined();
    },
  );

  it('Keystone QR cancellation clears only its own request', () => {
    const keystone = createAdapter(KeystoneAdapter);
    keystone.emit(EConnectorInteraction.ConfirmOnDevice, 'previous-usb');
    keystone.listeners.get(UI_REQUEST.REQUEST_QR_SCAN)?.({});
    expect(state?.vendor).toBe('keystone');
    const qrState = state;
    keystone.emit(EConnectorInteraction.InteractionComplete, 'previous-usb');
    expect(state).toBe(qrState);
    keystone.adapter.cancel();
    expect(state).toBeUndefined();
  });

  it('Trezor processing restoration and SDK completion preserve a newer vendor prompt', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const operation = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const trezor = createAdapter(TrezorAdapter, {
      evmGetAddress: jest.fn().mockReturnValue(operation),
    });
    const keystone = createAdapter(KeystoneAdapter);
    const result = trezor.adapter.hw.evmGetAddress('usb', 'device', {
      path: "m/44'/60'/0'/0/0",
      showOnDevice: true,
    });
    trezor.emit(EConnectorInteraction.ConfirmOnDevice, 'trezor');
    keystone.emit(EConnectorInteraction.ConfirmOnDevice, 'keystone');
    const expected = state;
    trezor.emit(EConnectorInteraction.InteractionComplete, 'trezor');
    expect(state).toBe(expected);
    finish({ success: true, payload: { address: '0x1' } });
    await result;
    expect(state).toBe(expected);
  });
});
