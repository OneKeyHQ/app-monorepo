/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAutoSelectNetwork } from './useAutoSelectNetwork';

const mockUpdateSelectedAccountNetwork = jest.fn<Promise<void>, [unknown]>();
const mockAccountSelectorActions = {
  current: {
    updateSelectedAccountNetwork: mockUpdateSelectedAccountNetwork,
  },
};
let mockNetworkId: string | undefined;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({
    sceneName: EAccountSelectorSceneName.home,
    sceneUrl: undefined,
  }),
  useAccountSelectorStorageReadyAtom: () => [true],
  useSelectedAccount: () => ({
    selectedAccount: { networkId: mockNetworkId },
    isSelectedAccountDefaultValue: false,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => mockAccountSelectorActions,
  }),
);

jest.mock('./useAccountSelectorAvailableNetworks', () => ({
  useAccountSelectorAvailableNetworks: () => ({
    networkIds: ['onekeyall--0', 'evm--1'],
    defaultNetworkId: undefined,
  }),
}));

jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({
  useDebugComponentRemountLog: () => undefined,
}));

describe('useAutoSelectNetwork', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockNetworkId = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries the network auto-select when the first attempt rejects (OK-62137)', async () => {
    mockUpdateSelectedAccountNetwork
      .mockRejectedValueOnce(new Error('background not ready'))
      .mockResolvedValue(undefined);

    const { unmount } = renderHook(() => useAutoSelectNetwork({ num: 0 }));

    expect(mockUpdateSelectedAccountNetwork).toHaveBeenCalledTimes(1);
    expect(mockUpdateSelectedAccountNetwork).toHaveBeenCalledWith({
      num: 0,
      networkId: 'onekeyall--0',
    });

    // Let the rejection settle, then fire the retry timer.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() => {
      expect(mockUpdateSelectedAccountNetwork).toHaveBeenCalledTimes(2);
    });
    expect(mockUpdateSelectedAccountNetwork).toHaveBeenLastCalledWith({
      num: 0,
      networkId: 'onekeyall--0',
    });

    unmount();
  });

  it('does not retry once the network is selected', async () => {
    mockNetworkId = 'onekeyall--0';

    const { unmount } = renderHook(() => useAutoSelectNetwork({ num: 0 }));

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockUpdateSelectedAccountNetwork).not.toHaveBeenCalled();
    unmount();
  });
});
