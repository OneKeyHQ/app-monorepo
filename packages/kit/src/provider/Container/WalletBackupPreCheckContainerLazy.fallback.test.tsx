/* eslint-disable import/first */

import { act, render, waitFor } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockRejectCallback = jest
  .fn<Promise<void>, [{ id: number; error: Error }]>()
  .mockResolvedValue(undefined);
let mockCheckWalletBackupStatusHandler:
  | ((payload: { promiseId: number; walletId: string }) => void)
  | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePromise: {
      rejectCallback: (params: { id: number; error: Error }) =>
        mockRejectCallback(params),
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

jest.mock('./WalletBackupPreCheckContainerLazy.utils', () => {
  throw new OneKeyLocalError('mock settlement chunk load failure');
});

jest.mock('../../components/WalletBackup/WalletBackupPreCheckContainer', () => {
  throw new OneKeyLocalError('mock container chunk load failure');
});

import { WalletBackupPreCheckContainerLazy } from './WalletBackupPreCheckContainerLazy';

describe('WalletBackupPreCheckContainerLazy settlement fallback', () => {
  it('fails closed when both lazy chunks fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<WalletBackupPreCheckContainerLazy />);

    act(() => {
      mockCheckWalletBackupStatusHandler?.({
        promiseId: 46,
        walletId: 'hd-4',
      });
    });

    await waitFor(() => {
      expect(mockRejectCallback).toHaveBeenCalledWith({
        id: 46,
        error: expect.objectContaining({
          message: 'mock container chunk load failure',
        }),
      });
    });
  });
});
