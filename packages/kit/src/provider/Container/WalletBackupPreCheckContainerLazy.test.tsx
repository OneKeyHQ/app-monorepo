/* eslint-disable import/first */

import { act, render, waitFor } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockResolveCallback = jest
  .fn<Promise<void>, [{ id: number; data: boolean }]>()
  .mockResolvedValue(undefined);
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
    },
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
    mockCheckWalletBackupStatusHandler = undefined;
  });

  it('settles queued backup checks when the lazy import fails', async () => {
    render(<WalletBackupPreCheckContainerLazy />);

    act(() => {
      mockCheckWalletBackupStatusHandler?.({
        promiseId: 42,
        walletId: 'hd-1',
      });
    });

    await waitFor(() => {
      expect(mockResolveCallback).toHaveBeenCalledWith({
        id: 42,
        data: true,
      });
    });
    expect(mockErrorLog).toHaveBeenCalledWith(
      expect.stringContaining('mock chunk load failure'),
    );
  });
});
