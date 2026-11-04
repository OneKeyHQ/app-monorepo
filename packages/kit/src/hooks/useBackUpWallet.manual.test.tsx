/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useBackUpWallet } from './useBackUpWallet';

import type { IDialogShowProps } from '../../../components/src/composite/Dialog/type';

const mockNavigate = jest.fn();
const mockOriginal = jest.fn<Promise<{ mnemonic: string }>, unknown[]>();
const mockRecover = jest.fn(async () => ({
  mnemonic: 'recovery-encoded-result',
}));
const mockInfo = jest.fn<
  Promise<{ sessionId: string; expiresAt: number } | undefined>,
  unknown[]
>();
const mockListeners = new Set<(state: string) => void>();
let mockDialog: IDialogShowProps | undefined;
const mockForm = {
  trigger: async () => true,
  getValues: () => ({ password: 'test-password' }),
  reset: jest.fn(),
  setError: jest.fn(),
};
const mockClose = jest.fn<Promise<void>, []>(async () => {
  await mockDialog?.onClose?.();
});
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Enter password' }),
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
  Toast: { error: jest.fn() },
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => ({ key: 'wallet-detail' }),
      addListener: () => jest.fn(),
    },
  },
  resetToRoute: (...args: unknown[]) => {
    mockNavigate(...args);
  },
}));
jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getManualMnemonicRecoveryInfo: (...args: unknown[]) => mockInfo(...args),
      getHDAccountMnemonic: (...args: unknown[]) => mockOriginal(...args),
      getManualRecoveryMnemonic: () => mockRecover(),
      cancelManualMnemonicRecovery: async () => undefined,
    },
    servicePassword: {
      encodeSensitiveText: async () => 'encoded-test-password',
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { account: { wallet: { backupWallet: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/utils/sensitiveTextUtils', () => ({
  ensureSensitiveTextEncoded: jest.fn(),
}));
jest.mock('./useAccountData', () => ({
  useAccountData: () => ({ wallet: { id: 'hd-1', backuped: false } }),
}));
jest.mock('./useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../views/LiteCard/hooks/useLiteCard', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../views/Onboardingv2/hooks/useCloudBackup', () => ({
  useCloudBackup: () => ({}),
}));

async function flush() {
  await act(async () => {
    for (let i = 0; i < 15; i += 1) await Promise.resolve();
  });
}
async function confirmRecovery() {
  await mockDialog?.onConfirm?.({
    getForm: () => mockForm,
    close: mockClose,
    preventClose: jest.fn(),
  } as unknown as Parameters<NonNullable<IDialogShowProps['onConfirm']>>[0]);
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockDialog = undefined;
  mockListeners.clear();
  mockInfo.mockResolvedValue(undefined);
  mockOriginal.mockResolvedValue({ mnemonic: 'original-encoded-result' });
});
afterEach(() => jest.useRealTimers());

it.each(['inactive', 'background'])(
  'navigates from the real backup hook after original verification succeeds across %s',
  async (state) => {
    let finish!: (value: { mnemonic: string }) => void;
    mockOriginal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const hook = renderHook(() => useBackUpWallet({ walletId: 'hd-1' }));
    let request!: Promise<void>;
    act(() => {
      request = hook.result.current.handleBackUpByPhrase();
    });
    await flush();
    mockListeners.forEach((listener) => listener(state));
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => {
      finish({ mnemonic: 'original-encoded-result' });
      await request;
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          params: expect.objectContaining({
            walletId: 'hd-1',
            mnemonic: 'original-encoded-result',
          }),
        }),
      }),
    );
  },
);

it('uses recovery first, then the original flow after repair, and waits for dialog closure before navigating', async () => {
  mockInfo.mockResolvedValueOnce({
    sessionId: 'test-session',
    expiresAt: Date.now() + 5 * 60_000,
  });
  let finishClose!: () => void;
  mockClose.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      finishClose = resolve;
    });
    await mockDialog?.onClose?.();
  });
  const hook = renderHook(() => useBackUpWallet({ walletId: 'hd-1' }));
  let request!: Promise<void>;
  act(() => {
    request = hook.result.current.handleBackUpByPhrase();
  });
  await flush();
  const confirmation = confirmRecovery();
  await flush();
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => {
    finishClose();
    await confirmation;
    await request;
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  mockNavigate.mockClear();
  await act(async () => hook.result.current.handleBackUpByPhrase());
  expect(mockOriginal).toHaveBeenCalledTimes(1);
  expect(mockRecover).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('can retry the same healthy backup action after original verification rejects', async () => {
  mockOriginal.mockRejectedValueOnce(
    new Error('Original password prompt cancelled'),
  );
  const hook = renderHook(() => useBackUpWallet({ walletId: 'hd-1' }));
  await expect(hook.result.current.handleBackUpByPhrase()).rejects.toThrow(
    'Original password prompt cancelled',
  );
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => hook.result.current.handleBackUpByPhrase());
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});
