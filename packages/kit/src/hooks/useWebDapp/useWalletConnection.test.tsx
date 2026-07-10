/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { useWalletConnection } from './useWalletConnection';

const mockConnectToWallet = jest.fn();
const mockHideLoading = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: () => 'Connect wallet',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(() => ({
      close: jest.fn().mockResolvedValue(undefined),
    })),
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
});
