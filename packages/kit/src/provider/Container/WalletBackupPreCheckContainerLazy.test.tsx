/* eslint-disable import/first */

import { act, render, waitFor } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockResolveCallback = jest
  .fn<Promise<void>, [{ id: number; data: boolean }]>()
  .mockResolvedValue(undefined);
const mockRejectCallback = jest
  .fn<Promise<void>, [{ id: number; error: Error }]>()
  .mockResolvedValue(undefined);
const mockIsHdWallet = jest.fn<boolean, [{ walletId: string }]>(() => true);
const mockErrorLog = jest.fn<void, [string]>();
let mockCheckWalletBackupStatusHandler:
  | ((payload: { promiseId: number; walletId: string }) => void)
  | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePromise: {
      resolveCallback: (params: { id: number; data: boolean }) =>
        mockResolveCallback(params),
      rejectCallback: (params: { id: number; error: Error }) =>
        mockRejectCallback(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHdWallet: (params: { walletId: string }) => mockIsHdWallet(params),
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    CheckWalletBackupStatus: 'CheckWalletBackupStatus',
  },
  appEventBus: {
    on: (
      _eventName: string,
      handler: (payload: { promiseId: number; walletId: string }) => void,
    ) => {
      mockCheckWalletBackupStatusHandler = handler;
    },
    off: jest.fn(),
    emitToSelf: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (message: string) => mockErrorLog(message),
      },
    },
  },
}));

jest.mock('../../components/WalletBackup/WalletBackupPreCheckContainer', () => {
  throw new OneKeyLocalError('mock chunk load failure');
});

import { WalletBackupPreCheckContainerLazy } from './WalletBackupPreCheckContainerLazy';

describe('WalletBackupPreCheckContainerLazy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsHdWallet.mockReturnValue(true);
    mockCheckWalletBackupStatusHandler = undefined;
  });

  it('fails closed for queued HD-wallet checks when the lazy import fails', async () => {
    render(<WalletBackupPreCheckContainerLazy />);

    act(() => {
      mockCheckWalletBackupStatusHandler?.({
        promiseId: 42,
        walletId: 'hd-1',
      });
    });

    await waitFor(() => {
      expect(mockRejectCallback).toHaveBeenCalledWith({
        id: 42,
        error: expect.objectContaining({
          message: 'mock chunk load failure',
        }),
      });
    });
    expect(mockResolveCallback).not.toHaveBeenCalled();
    expect(mockErrorLog).toHaveBeenCalledWith(
      expect.stringContaining('mock chunk load failure'),
    );
  });

  it('allows a non-HD wallet through when the lazy import fails', async () => {
    mockIsHdWallet.mockReturnValue(false);
    render(<WalletBackupPreCheckContainerLazy />);

    act(() => {
      mockCheckWalletBackupStatusHandler?.({
        promiseId: 43,
        walletId: 'external-1',
      });
    });

    await waitFor(() => {
      expect(mockResolveCallback).toHaveBeenCalledWith({
        id: 43,
        data: true,
      });
    });
    expect(mockRejectCallback).not.toHaveBeenCalled();
  });

  it('settles queued HD-wallet checks when the wrapper unmounts', async () => {
    const view = render(<WalletBackupPreCheckContainerLazy />);

    act(() => {
      mockCheckWalletBackupStatusHandler?.({
        promiseId: 44,
        walletId: 'hd-2',
      });
      view.unmount();
    });

    await waitFor(() => {
      expect(mockRejectCallback).toHaveBeenCalledWith({
        id: 44,
        error: expect.any(Error),
      });
    });
  });
});
