/* eslint-disable @typescript-eslint/unbound-method */
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { getManualBackupMnemonic } from './getManualBackupMnemonic';

import type { IntlShape } from 'react-intl';

let mockDialog: IDialogShowProps | undefined;
let mockAppStateListener: ((state: string) => void) | undefined;
let mockRouteListener: (() => void) | undefined;
let mockRouteKey = 'manual-backup';
const mockForm = {
  trigger: jest.fn(async () => true),
  getValues: () => ({ password: 'typed-test-password' }),
  reset: jest.fn(),
  setError: jest.fn(),
};
const mockClose = jest.fn(async () => {
  await mockDialog?.onClose?.();
});
const mockInfo = jest.fn<
  Promise<{ sessionId: string; expiresAt: number } | undefined>,
  [unknown]
>();
const mockRecover = jest.fn<Promise<{ mnemonic: string }>, [unknown]>();
const mockCancel = jest.fn<Promise<void>, [unknown]>(async () => undefined);
const mockNormal = jest.fn<Promise<{ mnemonic: string }>, [unknown]>(
  async () => ({
    mnemonic: 'normal-encoded-test-result',
  }),
);
const mockEncode = jest.fn<Promise<string>, [unknown]>(
  async () => 'encoded-test-password',
);
const mockShowError = jest.fn();
const mockRemove = jest.fn(() => {
  mockAppStateListener = undefined;
});
const mockUnsubscribeRoute = jest.fn(() => {
  mockRouteListener = undefined;
});
const intl = { formatMessage: () => 'Enter passcode' } as unknown as IntlShape;

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: mockRemove };
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: Object.assign(
    {
      show: (props: IDialogShowProps) => {
        mockDialog = props;
        return { close: mockClose, getForm: () => mockForm };
      },
    },
    { Form: () => null, FormField: () => null },
  ),
  Input: () => null,
  Toast: {
    error: (...args: unknown[]) => {
      mockShowError(...args);
    },
  },
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => ({ key: mockRouteKey }),
      addListener: (_event: string, listener: () => void) => {
        mockRouteListener = listener;
        return mockUnsubscribeRoute;
      },
    },
  },
}));
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getManualMnemonicRecoveryInfo: (params: unknown) => mockInfo(params),
      getManualRecoveryMnemonic: (params: unknown) => mockRecover(params),
      cancelManualMnemonicRecovery: (params: unknown) => mockCancel(params),
      getHDAccountMnemonic: (params: unknown) => mockNormal(params),
    },
    servicePassword: {
      encodeSensitiveText: (params: unknown) => mockEncode(params),
    },
  },
}));
async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}
async function confirm() {
  await mockDialog?.onConfirm?.({
    getForm: () => mockForm,
    close: mockClose,
    preventClose: jest.fn(),
  } as unknown as Parameters<NonNullable<IDialogShowProps['onConfirm']>>[0]);
}

describe('manual mnemonic backup fallback UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockDialog = undefined;
    mockRouteKey = 'manual-backup';
    mockInfo.mockResolvedValue({
      sessionId: 'request-1',
      expiresAt: Date.now() + 5 * 60_000,
    });
    mockRecover.mockResolvedValue({ mnemonic: 'recovery-encoded-test-result' });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the original password flow when no storage fault is confirmed', async () => {
    mockInfo.mockResolvedValueOnce(undefined);
    await expect(getManualBackupMnemonic('hd-1', intl)).resolves.toEqual({
      mnemonic: 'normal-encoded-test-result',
    });
    expect(mockNormal).toHaveBeenCalledTimes(1);
    expect(mockDialog).toBeUndefined();
    expect(mockRecover).not.toHaveBeenCalled();
  });

  it.each(['inactive', 'background', 'lock', 'navigate'])(
    'does not override the original password response after %s once storage is healthy',
    async (state) => {
      mockInfo.mockResolvedValueOnce(undefined);
      let finish!: (value: { mnemonic: string }) => void;
      mockNormal.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const result = getManualBackupMnemonic('hd-1', intl);
      await flush();
      expect(mockNormal).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledTimes(1);
      if (state === 'lock')
        appEventBus.emit(EAppEventBusNames.LockApp, undefined);
      else if (state === 'navigate') {
        mockRouteKey = 'other';
        mockRouteListener?.();
      } else mockAppStateListener?.(state);
      finish({ mnemonic: 'normal-encoded-test-result' });
      await expect(result).resolves.toEqual({
        mnemonic: 'normal-encoded-test-result',
      });
      expect(mockRecover).not.toHaveBeenCalled();
    },
  );

  it('preserves original password rejection and allows the same healthy flow to retry', async () => {
    mockInfo.mockResolvedValue(undefined);
    mockNormal.mockRejectedValueOnce(new Error('Original prompt cancelled'));
    await expect(getManualBackupMnemonic('hd-1', intl)).rejects.toThrow(
      'Original prompt cancelled',
    );
    await expect(getManualBackupMnemonic('hd-1', intl)).resolves.toEqual({
      mnemonic: 'normal-encoded-test-result',
    });
  });

  it('waits for the recovery dialog to close before returning the mnemonic', async () => {
    let finishClose!: () => void;
    mockClose.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    const result = getManualBackupMnemonic('hd-1', intl);
    let returned = false;
    void result.then(() => {
      returned = true;
    });
    await flush();
    const request = confirm();
    await flush();
    expect(returned).toBe(false);
    finishClose();
    await request;
    await expect(result).resolves.toEqual({
      mnemonic: 'recovery-encoded-test-result',
    });
  });

  it('requests background admission without passing a UI hydration assertion', async () => {
    const result = getManualBackupMnemonic('hd-1', intl);
    await flush();
    expect(mockInfo).toHaveBeenCalledWith({
      walletId: 'hd-1',
    });
    await mockDialog?.onClose?.();
    await expect(result).resolves.toBeUndefined();
  });

  it('does not open a late dialog after navigation while the fault probe is pending', async () => {
    let release!: (value: { sessionId: string; expiresAt: number }) => void;
    mockInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const result = getManualBackupMnemonic('hd-1', intl);
    mockRouteKey = 'other-page';
    mockRouteListener?.();
    await expect(result).resolves.toBeUndefined();
    release({
      sessionId: 'late-navigation',
      expiresAt: Date.now() + 5 * 60_000,
    });
    await flush();
    expect(mockDialog).toBeUndefined();
    expect(mockCancel).toHaveBeenCalledWith({ sessionId: 'late-navigation' });
  });

  it('uses only the independent input and RPC when a fault is confirmed', async () => {
    const result = getManualBackupMnemonic('hd-1', intl);
    await flush();
    expect(mockDialog).toBeDefined();
    expect(mockNormal).not.toHaveBeenCalled();
    await confirm();
    await expect(result).resolves.toEqual({
      mnemonic: 'recovery-encoded-test-result',
    });
    expect(mockEncode).toHaveBeenCalledWith({ text: 'typed-test-password' });
    expect(mockRecover).toHaveBeenCalledWith({
      sessionId: 'request-1',
      password: 'encoded-test-password',
    });
    expect(mockForm.reset).toHaveBeenCalledWith({ password: '' });
  });

  it.each(['cancel', 'timeout', 'background', 'lock', 'navigate'])(
    'discards late output after %s without opening an old global prompt',
    async (reason) => {
      let release!: (value: { mnemonic: string }) => void;
      mockRecover.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const result = getManualBackupMnemonic('hd-1', intl);
      await flush();
      const attempt = confirm();
      await flush();
      if (reason === 'cancel') await mockDialog?.onClose?.();
      if (reason === 'timeout') jest.advanceTimersByTime(5 * 60_000);
      if (reason === 'background') mockAppStateListener?.('background');
      if (reason === 'lock')
        appEventBus.emit(EAppEventBusNames.LockApp, undefined);
      if (reason === 'navigate') {
        mockRouteKey = 'other-page';
        mockRouteListener?.();
      }
      release({ mnemonic: 'must-be-discarded' });
      await attempt;
      await expect(result).resolves.toBeUndefined();
      expect(mockCancel).toHaveBeenCalledWith({ sessionId: 'request-1' });
      expect(mockNormal).not.toHaveBeenCalled();
    },
  );

  it('prevents duplicate dialogs and submissions', async () => {
    const result = getManualBackupMnemonic('hd-1', intl);
    await flush();
    await expect(
      getManualBackupMnemonic('hd-1', intl),
    ).resolves.toBeUndefined();
    await Promise.all([confirm(), confirm()]);
    await result;
    expect(mockInfo).toHaveBeenCalledTimes(1);
    expect(mockRecover).toHaveBeenCalledTimes(1);
  });

  it('does not turn unknown storage errors into another password request', async () => {
    mockInfo.mockRejectedValueOnce(new Error('Unknown storage failure'));
    await expect(getManualBackupMnemonic('hd-1', intl)).rejects.toThrow(
      'Unknown storage failure',
    );
    expect(mockNormal).not.toHaveBeenCalled();
    expect(mockDialog).toBeUndefined();
  });

  it('cancels a late metadata response instead of showing an expired prompt', async () => {
    let release!: (value: { sessionId: string; expiresAt: number }) => void;
    mockInfo.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const result = getManualBackupMnemonic('hd-1', intl);
    // Attach rejection handling before advancing the timeout clock.
    const rejected = (async () => {
      await expect(result).rejects.toThrow('timed out');
    })();
    jest.advanceTimersByTime(15_000);
    await rejected;
    release({
      sessionId: 'late',
      expiresAt: Date.now() + 5 * 60_000,
    });
    await flush();
    expect(mockDialog).toBeUndefined();
    expect(mockCancel).toHaveBeenCalledWith({ sessionId: 'late' });
    expect(mockNormal).not.toHaveBeenCalled();
  });
});
