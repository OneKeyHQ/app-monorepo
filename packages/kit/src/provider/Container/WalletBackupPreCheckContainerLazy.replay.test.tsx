/* eslint-disable import/first */

import { act, render } from '@testing-library/react-native';

const mockRejectCallback = jest
  .fn<Promise<void>, [{ id: number; error: Error }]>()
  .mockResolvedValue(undefined);
const mockContainerRendered = jest.fn();
const mockEmitToSelf = jest.fn();
let mockCheckWalletBackupStatusHandler:
  | ((payload: { promiseId: number; walletId: string }) => void)
  | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePromise: {
      resolveCallback: jest.fn().mockResolvedValue(undefined),
      rejectCallback: (params: { id: number; error: Error }) =>
        mockRejectCallback(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHdWallet: () => true,
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
    emitToSelf: (event: unknown) => {
      mockEmitToSelf(event);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock(
  '../../components/WalletBackup/WalletBackupPreCheckContainer',
  () => ({
    WalletBackupPreCheckContainer: () => {
      mockContainerRendered();
      return null;
    },
  }),
);

import { WalletBackupPreCheckContainerLazy } from './WalletBackupPreCheckContainerLazy';

describe('WalletBackupPreCheckContainerLazy replay cleanup', () => {
  it('settles queued checks when unmounted before the replay timer fires', async () => {
    jest.useFakeTimers();
    const view = render(<WalletBackupPreCheckContainerLazy />);

    act(() => {
      mockCheckWalletBackupStatusHandler?.({
        promiseId: 45,
        walletId: 'hd-3',
      });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockContainerRendered).toHaveBeenCalled();

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRejectCallback).toHaveBeenCalledWith({
      id: 45,
      error: expect.any(Error),
    });
    expect(mockEmitToSelf).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
