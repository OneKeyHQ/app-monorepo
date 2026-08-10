/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAutoSelectAccount } from './useAutoSelectAccount';

const mockAutoSelectNextAccount = jest.fn();
const mockAccountSelectorActions = {
  current: { autoSelectNextAccount: mockAutoSelectNextAccount },
};
let mockActiveAccount = {
  ready: true,
  account: { id: 'hd-1--account' },
  wallet: { id: 'hd-1' },
};

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountRemove: 'AccountRemove',
    WalletUpdate: 'WalletUpdate',
  },
  appEventBus: {
    off: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({
    sceneName: EAccountSelectorSceneName.home,
    sceneUrl: undefined,
  }),
  useAccountSelectorStorageReadyAtom: () => [true],
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => mockAccountSelectorActions,
}));

jest.mock('../../../utils/deferHeavyWork', () => ({
  deferHeavyWorkUntilUIIdle: jest.fn(async () => undefined),
}));

describe('useAutoSelectAccount unavailable active wallet recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoSelectNextAccount.mockResolvedValue(undefined);
    mockActiveAccount = {
      ready: true,
      account: { id: 'hd-1--account' },
      wallet: { id: 'hd-1' },
    };
  });

  it.each([
    { id: 'hw-deprecated', deprecated: true },
    { id: 'hw-mocked', isMocked: true },
  ])(
    'auto-selects again when a ready session switches to unavailable wallet $id',
    async (wallet) => {
      const { rerender } = renderHook(() => useAutoSelectAccount({ num: 0 }));

      await waitFor(() => {
        expect(mockAutoSelectNextAccount).toHaveBeenCalledTimes(1);
      });
      mockAutoSelectNextAccount.mockClear();

      mockActiveAccount = {
        ready: true,
        account: { id: `${wallet.id}--account` },
        wallet,
      };
      rerender();

      await waitFor(() => {
        expect(mockAutoSelectNextAccount).toHaveBeenCalledWith({
          num: 0,
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: undefined,
        });
      });

      rerender();
      await act(async () => Promise.resolve());
      expect(mockAutoSelectNextAccount).toHaveBeenCalledTimes(1);
    },
  );
});
