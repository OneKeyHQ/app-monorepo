/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { useWalletConnection } from './useWalletConnection';

const mockConnectToWallet = jest.fn();
const mockHideLoading = jest.fn();
let mockDialogOnClose:
  | ((extra?: { flag?: string }) => void | Promise<void>)
  | undefined;
const mockDialogClose = jest.fn(
  (extra?: { flag?: string }) =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        void Promise.resolve(mockDialogOnClose?.(extra)).then(() => resolve());
      }, 300);
    }),
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: () => 'Connect wallet',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(
      (options: {
        onClose?: (extra?: { flag?: string }) => void | Promise<void>;
      }) => {
        mockDialogOnClose = options.onClose;
        return {
          close: mockDialogClose,
        };
      },
    ),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceWalletConnect: {
      abortConnectPairing: jest.fn(),
    },
  },
}));

const mockAbortConnectPairing = jest.spyOn(
  backgroundApiProxy.serviceWalletConnect,
  'abortConnectPairing',
);

jest.mock('../../components/WebDapp/ConnectToWalletDialogContent', () => ({
  ConnectToWalletDialogContent: () => null,
}));

jest.mock('./useConnectExternalWallet', () => ({
  useConnectExternalWallet: () => ({
    connectToWallet: mockConnectToWallet,
    loading: false,
    localLoading: false,
    hideLoading: mockHideLoading,
    showLoading: jest.fn(),
    setLoadingRef: { current: jest.fn() },
  }),
}));

describe('useWalletConnection', () => {
  beforeEach(() => {
    mockConnectToWallet.mockReset();
    mockHideLoading.mockReset();
    mockAbortConnectPairing.mockReset();
    mockDialogClose.mockClear();
    mockDialogOnClose = undefined;
  });

  it('consumes WalletConnect modal close errors from the press handler', async () => {
    mockConnectToWallet.mockRejectedValueOnce({
      className: EOneKeyErrorClassNames.OneKeyWalletConnectModalCloseError,
    });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() =>
      useWalletConnection({
        name: 'WalletConnect',
        connectionInfo: {
          walletConnect: {
            topic: '',
            peerMeta: undefined,
            isNewConnection: true,
          },
        },
      }),
    );

    await act(async () => {
      await expect(
        result.current.connectToWalletWithDialogShow(),
      ).resolves.toBeUndefined();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    unmount();
  });

  it('preserves a user cancellation queued before the modal opens', async () => {
    jest.useFakeTimers();
    let rejectConnect: ((error: unknown) => void) | undefined;
    mockConnectToWallet.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectConnect = reject;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useWalletConnection({
        name: 'WalletConnect',
        connectionInfo: {
          walletConnect: {
            topic: '',
            peerMeta: undefined,
            isNewConnection: true,
          },
        },
      }),
    );

    let connectPromise: Promise<void> | undefined;
    await act(async () => {
      connectPromise = result.current.connectToWalletWithDialogShow();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockDialogOnClose).toBeDefined();

    setTimeout(() => {
      void mockDialogOnClose?.();
    }, 300);
    act(() => {
      jest.advanceTimersByTime(50);
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: true,
      });
      jest.advanceTimersByTime(250);
    });
    await act(async () => Promise.resolve());

    expect(mockAbortConnectPairing).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(50);
    });
    await act(async () => Promise.resolve());
    expect(mockAbortConnectPairing).toHaveBeenCalledTimes(1);

    rejectConnect?.({
      className: EOneKeyErrorClassNames.OneKeyWalletConnectModalCloseError,
    });
    await act(async () => {
      await connectPromise;
    });

    unmount();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
});
