/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// PR #13695 review: `Tabs.Container` no longer remounts on an account switch,
// and the new owner's All Networks run queues behind the previous owner's
// fan-out. A request or cache read of that fan-out resolving after the switch
// must not put the previous account's NFTs on the list cleared for the new
// one.

import type { ReactNode } from 'react';

type IOwner = {
  account: { id: string };
  network: { id: string; isAllNetworks: boolean };
  wallet: { id: string };
};
type IHookParams = {
  allNetworkRequests: (args: {
    accountId: string;
    networkId: string;
    allNetworkDataInit?: boolean;
    isRunCurrent?: () => boolean;
  }) => Promise<unknown>;
  allNetworkCacheData: (args: {
    data: unknown;
    accountId: string;
    networkId: string;
    generation: number;
  }) => Promise<void>;
};

const mockOwnerStore = (() => {
  let owner: IOwner | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => owner,
    set: (next: IOwner) => {
      owner = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();
const mockHookParams: IHookParams[] = [];
const mockFetchAccountNFTs = jest.fn<Promise<unknown>, [unknown]>();

jest.mock('@onekeyhq/components', () => ({
  useTabIsRefreshingFocused: () => ({
    isFocused: true,
    isHeaderRefreshing: false,
    setIsHeaderRefreshing: () => {},
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNFT: {
      fetchAccountNFTs: (params: unknown) => mockFetchAccountNFTs(params),
      getAccountLocalNFTs: async () => [],
      updateCurrentAccount: async () => {},
      abortFetchAccountNFTs: async () => {},
    },
  },
}));
jest.mock('../../../hooks/useAllNetwork', () => ({
  useAllNetworkRequests: (params: IHookParams) => {
    mockHookParams.push(params);
    return { run: () => {}, result: undefined, isEmptyAccount: false };
  },
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ run: () => {} }),
}));
jest.mock('../../../states/jotai/contexts/accountOverview', () => ({
  useAccountOverviewActions: () => ({
    current: { updateAllNetworksState: () => {} },
  }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSyncExternalStore } = require('react') as typeof import('react');
    return {
      activeAccount: useSyncExternalStore(
        mockOwnerStore.subscribe,
        mockOwnerStore.get,
      ),
    };
  },
}));
jest.mock('../../../states/jotai/contexts/nftList', () => ({
  useNFTListActions: () => ({ current: { updateSearchKey: () => {} } }),
  withNFTListProvider: (Component: () => ReactNode) => Component,
}));
jest.mock('../components/NFTListView', () => ({
  NFTListView: ({ data }: { data: Array<{ itemId: string }> }) => (
    <div data-testid="nfts">{data.map((item) => item.itemId).join(',')}</div>
  ),
}));
jest.mock('../components/PullToRefresh', () => ({
  onHomePageRefresh: () => {},
}));

import { act, render, screen } from '@testing-library/react';

import { NFTListContainerWithProvider } from './NFTListContainer';

/*
yarn jest packages/kit/src/views/Home/pages/NFTListContainer.ownerSwitch.test.tsx
*/

const ALL_NETWORKS_ID = 'onekeyall--0';

function allNetworksOwner(index: number): IOwner {
  return {
    account: { id: `hd-1--${index}--allnet` },
    network: { id: ALL_NETWORKS_ID, isAllNetworks: true },
    wallet: { id: 'hd-1' },
  };
}

function nft(itemId: string) {
  return { collectionAddress: '0xc', itemId };
}

function nftsResp(itemIds: string[]) {
  return {
    data: itemIds.map(nft),
    networkId: ALL_NETWORKS_ID,
    isSameAllNetworksAccountData: true,
  };
}

function renderedItemIds() {
  return screen.getByTestId('nfts').textContent;
}

describe('NFTListContainer: All Networks account switch', () => {
  beforeEach(() => {
    mockHookParams.length = 0;
    mockFetchAccountNFTs.mockReset();
    mockOwnerStore.set(allNetworksOwner(0));
  });

  it('drops a previous-owner request that resolves after the switch', async () => {
    render(<NFTListContainerWithProvider />);
    const previousOwnerParams = mockHookParams.at(-1);

    let resolvePrevious: (value: unknown) => void = () => {};
    mockFetchAccountNFTs.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrevious = resolve;
      }),
    );
    const previousRequest = previousOwnerParams?.allNetworkRequests({
      accountId: 'hd-1--0--eth',
      networkId: 'evm--1',
      allNetworkDataInit: false,
      isRunCurrent: () => true,
    });

    act(() => {
      mockOwnerStore.set(allNetworksOwner(1));
    });
    await act(async () => {
      resolvePrevious(nftsResp(['previous-owner']));
      await previousRequest;
    });
    expect(renderedItemIds()).toBe('');

    // The new owner's own request still lands.
    mockFetchAccountNFTs.mockResolvedValueOnce(nftsResp(['current-owner']));
    await act(async () => {
      await mockHookParams.at(-1)?.allNetworkRequests({
        accountId: 'hd-1--1--eth',
        networkId: 'evm--1',
        allNetworkDataInit: false,
        isRunCurrent: () => true,
      });
    });
    expect(renderedItemIds()).toBe('current-owner');
  });

  it('drops a previous-owner cache read that lands after the switch', async () => {
    render(<NFTListContainerWithProvider />);
    const previousOwnerParams = mockHookParams.at(-1);

    act(() => {
      mockOwnerStore.set(allNetworksOwner(1));
    });
    await act(async () => {
      await previousOwnerParams?.allNetworkCacheData({
        data: [[nft('previous-owner')]],
        accountId: allNetworksOwner(0).account.id,
        networkId: ALL_NETWORKS_ID,
        generation: 1,
      });
    });
    expect(renderedItemIds()).toBe('');

    await act(async () => {
      await mockHookParams.at(-1)?.allNetworkCacheData({
        data: [[nft('current-owner')]],
        accountId: allNetworksOwner(1).account.id,
        networkId: ALL_NETWORKS_ID,
        generation: 2,
      });
    });
    expect(renderedItemIds()).toBe('current-owner');
  });
});
