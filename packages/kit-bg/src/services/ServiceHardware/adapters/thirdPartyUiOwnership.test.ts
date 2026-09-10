import { EConnectorInteraction, UI_REQUEST } from '@onekeyfe/hwk-adapter-core';

import {
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
  const emit = (type: EConnectorInteraction, sessionId: string) => {
    listeners.get('ui-event')?.({ type, payload: { sessionId } });
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
