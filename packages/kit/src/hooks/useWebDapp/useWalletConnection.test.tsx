/** @jest-environment jsdom */

import type { ComponentProps, ReactElement } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import { useWalletConnection } from './useWalletConnection';

import type { ConnectToWalletDialogContent } from '../../components/WebDapp/ConnectToWalletDialogContent';

const mockAbortConnectPairing = jest.fn();
const mockConnectToWallet = jest.fn();
const mockDialogClose = jest.fn(async () => undefined);
const mockSetLoading = jest.fn();
const mockHideLoading = jest.fn();
let mockLoading = false;

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
    isNativeIOS: true,
    isDesktop: false,
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
    loading: mockLoading,
    localLoading: false,
    hideLoading: mockHideLoading,
    showLoading: jest.fn(),
    setLoadingRef: { current: mockSetLoading },
  }),
}));

describe('useWalletConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading = false;
    platformEnv.isNative = true;
    platformEnv.isDesktop = false;
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

  it.each(['socket progress exhausted', 'wallet picker opened'])(
    'closes without aborting the pairing when %s',
    async (reason) => {
      let onExhausted: (() => Promise<void>) | undefined;
      jest.mocked(Dialog.show).mockImplementation((options) => {
        const content = options.renderContent as ReactElement<
          ComponentProps<typeof ConnectToWalletDialogContent>
        >;
        onExhausted = content.props.onSocketProgressExhausted;
        mockDialogClose.mockImplementation(async () => {
          await options.onClose?.();
        });
        return {
          close: mockDialogClose,
          getForm: () => undefined,
          isExist: () => true,
        };
      });
      const connectionInfo = {
        walletConnect: { isNewConnection: true },
      } as IExternalConnectionInfo;
      const { result, unmount } = renderHook(() =>
        useWalletConnection({ name: 'WalletConnect', connectionInfo }),
      );
      act(() => {
        void result.current.connectToWalletWithDialogShow();
      });
      await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
      await act(async () => {
        if (reason === 'socket progress exhausted') {
          await onExhausted?.();
        } else {
          appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
            open: true,
          });
        }
      });
      expect(mockDialogClose).toHaveBeenCalledTimes(1);
      expect(mockAbortConnectPairing).not.toHaveBeenCalled();
      unmount();
    },
  );

  it('ignores SDK close state while a WalletConnect retry is preparing', () => {
    mockLoading = true;
    const connectionInfo = {
      walletConnect: { isNewConnection: true },
    } as IExternalConnectionInfo;
    const { unmount } = renderHook(() =>
      useWalletConnection({ name: 'WalletConnect', connectionInfo }),
    );
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: false,
        attemptId: 1,
      });
    });
    expect(mockHideLoading).not.toHaveBeenCalled();
    unmount();
  });

  it('closes desktop preparation when the SDK wallet picker opens', async () => {
    platformEnv.isNative = false;
    platformEnv.isDesktop = true;
    jest.mocked(Dialog.show).mockImplementation((options) => ({
      close: async () => {
        await mockDialogClose();
        await options.onClose?.();
      },
      getForm: () => undefined,
      isExist: () => true,
    }));
    const connectionInfo = {
      walletConnect: { isNewConnection: true },
    } as IExternalConnectionInfo;
    const { result, unmount } = renderHook(() =>
      useWalletConnection({ name: 'WalletConnect', connectionInfo }),
    );
    act(() => {
      void result.current.connectToWalletWithDialogShow();
    });
    await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.WalletConnectModalState, {
        open: true,
        attemptId: 1,
      });
    });
    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(mockAbortConnectPairing).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps a retry dialog owned when the old request and callbacks settle', async () => {
    let resolveFirst = () => {};
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    mockConnectToWallet.mockReturnValueOnce(first);
    const dialogs: {
      close: jest.Mock;
      onClose?: () => void;
      content: ReactElement<
        ComponentProps<typeof ConnectToWalletDialogContent>
      >;
    }[] = [];
    jest.mocked(Dialog.show).mockImplementation((options) => {
      const dialog = {
        close: jest.fn(async () => {
          await options.onClose?.();
        }),
        onClose: options.onClose,
        content: options.renderContent as ReactElement<
          ComponentProps<typeof ConnectToWalletDialogContent>
        >,
      };
      dialogs.push(dialog);
      return {
        close: dialog.close,
        getForm: () => undefined,
        isExist: () => true,
      };
    });
    const connectionInfo = {
      walletConnect: { isNewConnection: true },
    } as IExternalConnectionInfo;
    const { result, unmount } = renderHook(() =>
      useWalletConnection({ name: 'WalletConnect', connectionInfo }),
    );
    let firstCall: Promise<void> | undefined;
    act(() => {
      firstCall = result.current.connectToWalletWithDialogShow();
    });
    await waitFor(() => expect(dialogs).toHaveLength(1));
    await act(async () => {
      await dialogs[0].content.props.onSocketProgressExhausted();
    });
    act(() => {
      void result.current.connectToWalletWithDialogShow();
    });
    await waitFor(() => expect(dialogs).toHaveLength(2));
    mockSetLoading.mockClear();
    await act(async () => {
      dialogs[0].onClose?.();
      await dialogs[0].content.props.onSocketProgressExhausted();
      resolveFirst();
      await firstCall;
    });
    expect(dialogs[1].close).not.toHaveBeenCalled();
    expect(mockSetLoading).not.toHaveBeenCalled();
    expect(mockAbortConnectPairing).not.toHaveBeenCalled();
    unmount();
  });
});
