/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';

import { useSwapFromAccountNetworkSync } from './useSwapAccount';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

type INetworkUpdate = {
  num: number;
  networkId: string;
  reason?: string;
  shouldCommit?: () => boolean;
};

let mockIsFocused = true;
let mockScope = 'store:swap';
let mockNetworkId = 'evm--1';
let mockFocusListener: (focused: boolean, hiddenByModal: boolean) => void;
const mockUpdateNetwork = jest.fn<Promise<void>, [INetworkUpdate]>();
const mockSetSettings = jest.fn();
const mockSetRecipient = jest.fn();
let mockResetRecipient = false;
let mockAccount: IAccountSelectorActiveAccountInfo;
let mockContext: ISwapSelectedTokensColdStartContext | undefined;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms'),
  useSettingsAtom: () => [{}, mockSetSettings],
}));
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused,
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: (
    _tab: string,
    listener: (focused: boolean, hiddenByModal: boolean) => void,
  ) => {
    mockFocusListener = listener;
  },
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockAccount }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: { updateSelectedAccountNetwork: mockUpdateNetwork },
  }),
}));
jest.mock('../../../states/jotai/contexts/swap/atoms', () => ({
  useSwapColdStartScopeKey: () => mockScope,
  useSwapSelectFromTokenAtom: () => [
    { networkId: mockNetworkId, contractAddress: '' },
  ],
  useSwapSelectToTokenAtom: () => [
    { networkId: mockNetworkId, contractAddress: '0xtoken' },
  ],
  useSwapFromTokenAmountAtom: () => [{ value: '', isInput: false }],
  useSwapToTokenAmountAtom: () => [{ value: '', isInput: false }],
  useSwapSelectedTokensColdStartContextAtom: () => [mockContext],
  useSwapToAnotherAccountAddressAtom: () => [{}, mockSetRecipient],
  useSwapProviderSupportReceiveAddressAtom: () => [true],
}));
jest.mock('./useSwapAccount.utils', () => ({
  ...jest.requireActual<typeof import('./useSwapAccount.utils')>(
    './useSwapAccount.utils',
  ),
  shouldResetSwapRecipientOnAccountNetworkSync: () => mockResetRecipient,
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function changeTab(focused: boolean, hiddenByModal = false) {
  act(() => mockFocusListener(focused, hiddenByModal));
}

describe('Swap token-to-account synchronization authority', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsFocused = true;
    mockScope = 'store:swap';
    mockNetworkId = 'evm--1';
    mockResetRecipient = false;
    mockAccount = {
      network: { id: 'evm--56' },
    } as IAccountSelectorActiveAccountInfo;
    mockContext = undefined;
    mockUpdateNetwork.mockReset().mockResolvedValue(undefined);
    mockSetSettings.mockClear();
    mockSetRecipient.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([false, true])(
    'cancels a hidden root tab and ignores token changes (covered by modal=%s)',
    async (hiddenByModal) => {
      const view = renderHook(useSwapFromAccountNetworkSync);
      changeTab(hiddenByModal, hiddenByModal);
      mockNetworkId = 'evm--42161';
      view.rerender();
      await advance(600);
      expect(mockUpdateNetwork).not.toHaveBeenCalled();
      changeTab(true);
      await advance(100);
      expect(
        mockUpdateNetwork.mock.calls.map(([update]) => update.networkId),
      ).toEqual(['evm--42161', 'evm--42161']);
      view.unmount();
    },
  );

  it.each(['store:swapHomeMore', 'store:marketSwap'])(
    'synchronizes the active %s surface while the Swap tab is hidden',
    async (scope) => {
      mockScope = scope;
      const view = renderHook(useSwapFromAccountNetworkSync);
      changeTab(false);
      await advance(100);
      expect(
        mockUpdateNetwork.mock.calls.map(([update]) => update.num),
      ).toEqual([0, 1]);
      view.unmount();
    },
  );

  it('invalidates an awaited write across blur and refocus', async () => {
    let finishFirst: (() => void) | undefined;
    mockUpdateNetwork.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    );
    mockResetRecipient = true;
    const view = renderHook(useSwapFromAccountNetworkSync);
    await advance(100);
    const oldUpdate = mockUpdateNetwork.mock.calls[0][0];
    expect(oldUpdate.shouldCommit?.()).toBe(true);
    changeTab(false);
    expect(oldUpdate.shouldCommit?.()).toBe(false);
    changeTab(true);
    expect(oldUpdate.shouldCommit?.()).toBe(false);
    await act(async () => {
      finishFirst?.();
    });
    expect(mockUpdateNetwork).toHaveBeenCalledTimes(1);
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(mockSetRecipient).not.toHaveBeenCalled();
    await advance(100);
    expect(mockUpdateNetwork).toHaveBeenCalledTimes(3);
    view.unmount();
  });

  it('rejects an awaited write when its token network changes', async () => {
    let finishFirst: (() => void) | undefined;
    mockUpdateNetwork.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    );
    const view = renderHook(useSwapFromAccountNetworkSync);
    await advance(100);
    const oldUpdate = mockUpdateNetwork.mock.calls[0][0];
    mockNetworkId = 'evm--42161';
    view.rerender();
    expect(oldUpdate.shouldCommit?.()).toBe(false);
    await act(async () => {
      finishFirst?.();
    });
    expect(mockUpdateNetwork).toHaveBeenCalledTimes(1);
    await advance(100);
    expect(
      mockUpdateNetwork.mock.calls.slice(1).map(([update]) => update.networkId),
    ).toEqual(['evm--42161', 'evm--42161']);
    view.unmount();
  });

  it.each(['blur', 'unmount'])(
    'cancels the recipient retry after %s',
    async (action) => {
      mockResetRecipient = true;
      const view = renderHook(useSwapFromAccountNetworkSync);
      await advance(100);
      expect(mockUpdateNetwork).toHaveBeenCalledTimes(2);
      expect(mockSetSettings).toHaveBeenCalledTimes(1);
      if (action === 'blur') {
        mockIsFocused = false;
        view.rerender();
      } else {
        view.unmount();
      }
      await advance(500);
      expect(mockUpdateNetwork).toHaveBeenCalledTimes(2);
      view.unmount();
    },
  );

  it('cancels a queued synchronization on unmount', async () => {
    const view = renderHook(useSwapFromAccountNetworkSync);
    view.unmount();
    await advance(100);
    expect(mockUpdateNetwork).not.toHaveBeenCalled();
  });

  it('keeps the automatic All account while synchronizing the concrete recipient network', async () => {
    mockAccount = {
      ready: true,
      wallet: { id: 'review-wallet' },
      indexedAccount: { id: 'review-index' },
      deriveType: 'default',
      network: { id: 'onekeyall--0' },
    } as IAccountSelectorActiveAccountInfo;
    mockContext = {
      accountKey: 'review-wallet|review-index|default',
      networkId: 'onekeyall--0',
      updatedAt: 1,
      defaultTokenSeed: {
        fromToken: { networkId: mockNetworkId, contractAddress: '' },
        toToken: { networkId: mockNetworkId, contractAddress: '0xtoken' },
      },
    };
    const view = renderHook(useSwapFromAccountNetworkSync);
    await advance(100);
    expect(mockUpdateNetwork.mock.calls.map(([update]) => update.num)).toEqual([
      1,
    ]);
    expect(mockUpdateNetwork.mock.calls[0][0].networkId).toBe('evm--1');
    mockContext = { ...mockContext, defaultTokenSeed: undefined };
    view.rerender();
    await advance(100);
    expect(
      mockUpdateNetwork.mock.calls.slice(1).map(([update]) => update.num),
    ).toEqual([0, 1]);
    view.unmount();
  });
});
