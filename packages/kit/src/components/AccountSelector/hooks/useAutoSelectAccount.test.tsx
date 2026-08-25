/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAccountSelectorAutoSelectTriggerBy,
  EAccountSelectorSceneName,
} from '@onekeyhq/shared/types';

import { useAutoSelectAccount } from './useAutoSelectAccount';

const mockAutoSelectNextAccount = jest.fn<Promise<void>, [unknown]>();
const mockAccountSelectorActions = {
  current: {
    autoSelectNextAccount: mockAutoSelectNextAccount,
  },
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({
    sceneName: EAccountSelectorSceneName.home,
    sceneUrl: undefined,
  }),
  useAccountSelectorStorageReadyAtom: () => [false],
  useActiveAccount: () => ({
    activeAccount: {
      ready: true,
      account: { id: 'hd-keyless-1--evm-account' },
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => mockAccountSelectorActions,
  }),
);

jest.mock('@onekeyhq/kit/src/utils/deferHeavyWork', () => ({
  deferHeavyWorkUntilUIIdle: jest.fn(async () => undefined),
}));

describe('useAutoSelectAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoSelectNextAccount.mockResolvedValue(undefined);
  });

  it('forwards an actual wallet removal to account selection', async () => {
    renderHook(() => useAutoSelectAccount({ num: 0 }));

    act(() => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.WalletRemove,
        payload: { walletId: 'hd-keyless-1' },
        isRemote: false,
      });
    });

    await waitFor(() => {
      expect(mockAutoSelectNextAccount).toHaveBeenCalledWith({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        removedWalletId: 'hd-keyless-1',
      });
    });
  });
});
