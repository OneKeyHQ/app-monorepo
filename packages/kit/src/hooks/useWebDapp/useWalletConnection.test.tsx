/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import { useWalletConnection } from './useWalletConnection';

const mockAbortConnectPairing = jest.fn();
const mockConnectToWallet = jest.fn();
const mockDialogClose = jest.fn(async () => undefined);
const mockSetLoading = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: () => 'Connect to wallet',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
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
    wait: jest.fn(async () => undefined),
  },
}));

jest.mock('../../components/WebDapp/ConnectToWalletDialogContent', () => ({
  ConnectToWalletDialogContent: () => null,
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceWalletConnect: {
      abortConnectPairing: async (...args: unknown[]) => {
        mockAbortConnectPairing(...args);
      },
    },
  },
}));

jest.mock('./useConnectExternalWallet', () => ({
  useConnectExternalWallet: () => ({
    connectToWallet: mockConnectToWallet,
    loading: false,
    localLoading: false,
    hideLoading: jest.fn(),
    showLoading: jest.fn(),
    setLoadingRef: { current: mockSetLoading },
  }),
}));

describe('useWalletConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogClose.mockResolvedValue(undefined);
    mockConnectToWallet.mockReturnValue(new Promise(() => undefined));
  });

  it('cancels a native WalletConnect attempt when loading is closed', async () => {
    let onClose: (() => void) | undefined;
    jest.mocked(Dialog.show).mockImplementation((options) => {
      onClose = options.onClose;
      return {
        close: mockDialogClose,
        getForm: () => undefined,
        isExist: () => true,
      };
    });
    const closeModalSpy = jest.spyOn(appEventBus, 'emit');
    const connectionInfo = {
      walletConnect: {
        isNewConnection: true,
      },
    } as IExternalConnectionInfo;

    const { result, unmount } = renderHook(() =>
      useWalletConnection({
        name: 'WalletConnect',
        connectionInfo,
      }),
    );

    act(() => {
      void result.current.connectToWalletWithDialogShow();
    });

    await waitFor(() => {
      expect(Dialog.show).toHaveBeenCalledTimes(1);
    });
    expect(Dialog.show).toHaveBeenCalledWith(
      expect.objectContaining({
        useInitialSafeAreaBottomInsetFallback: true,
      }),
    );

    act(() => {
      onClose?.();
    });

    expect(closeModalSpy).toHaveBeenCalledWith(
      EAppEventBusNames.WalletConnectCloseModal,
      undefined,
    );
    expect(mockAbortConnectPairing).toHaveBeenCalledWith({ uri: '' });
    expect(mockSetLoading).toHaveBeenCalledWith(false);

    closeModalSpy.mockRestore();
    unmount();
  });

  it('keeps the initial inset fallback disabled for other native wallets', async () => {
    const connectionInfo = {} as IExternalConnectionInfo;
    const { result, unmount } = renderHook(() =>
      useWalletConnection({
        name: 'External wallet',
        connectionInfo,
      }),
    );

    act(() => {
      void result.current.connectToWalletWithDialogShow();
    });

    await waitFor(() => {
      expect(Dialog.show).toHaveBeenCalledWith(
        expect.objectContaining({
          useInitialSafeAreaBottomInsetFallback: false,
        }),
      );
    });

    unmount();
  });
});
