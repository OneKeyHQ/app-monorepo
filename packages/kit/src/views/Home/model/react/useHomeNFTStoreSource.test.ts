import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useHomeNFTStoreSource } from './useHomeNFTStoreSource';

interface ITestAllNetworkParams {
  allNetworkAccountsData?: (value: {
    accounts: ITestAllNetworkAccount[];
    allAccounts: ITestAllNetworkAccount[];
  }) => void;
  allNetworkCacheRequests?: (value: {
    accountId: string;
    accountAddress: string;
    networkId: string;
  }) => Promise<ITestNFT[]>;
  allNetworkRequests: (value: {
    accountId: string;
    networkId: string;
  }) => Promise<ITestNFTResponse | undefined>;
  onFinished?: () => Promise<void>;
  onRequestSettled?: (value: ITestNFTResponse, generation: number) => void;
  onStarted?: (value: {
    accountId?: string;
    networkId?: string;
  }) => Promise<void> | void;
}

interface ITestAllNetworkAccount {
  accountId: string;
  apiAddress: string;
  networkId: string;
}

interface ITestNFT {
  collectionAddress: string;
  itemId: string;
  networkId: string;
}

interface ITestNFTResponse {
  data: ITestNFT[];
  isSameAllNetworksAccountData: boolean;
  networkId: string;
}

type ITestGlobal = typeof globalThis & {
  __homeNFTActiveState: {
    activeAccount: {
      account: { id: string; indexedAccountId?: string };
      network: { id: string; isAllNetworks: boolean };
      wallet: { id: string };
    };
  };
  __homeNFTAllNetworkControl: {
    params?: ITestAllNetworkParams;
    run: jest.Mock<Promise<void>, [Record<string, unknown>?]>;
  };
  __homeNFTBackgroundControl: {
    fetchAccountNFTs: jest.Mock<Promise<ITestNFTResponse>, [unknown]>;
    getAccountLocalNFTs: jest.Mock<Promise<ITestNFT[]>, [unknown]>;
    updateCurrentAccount: jest.Mock<Promise<void>, [unknown]>;
  };
  __homeNFTPublisherControl: {
    begin: jest.Mock;
    complete: jest.Mock;
    handle: {
      payload: {
        ownerToken: { scopeKey: string; sessionId: string };
        sectionId: 'nft';
      };
      token: {
        clientInstanceId: string;
        producerInstanceId: string;
        protocolVersion: number;
        requestSeq: number;
        sessionId: string;
        sourceKey: {
          dataSchemaVersion: number;
          paramsFingerprint: string;
          scopeKey: string;
          sourceId: 'nft';
        };
      };
    };
    reset: jest.Mock;
  };
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => {
  const state = {
    activeAccount: {
      account: { id: 'account-1', indexedAccountId: 'indexed-1' },
      network: { id: 'btc--0', isAllNetworks: false },
      wallet: { id: 'wallet-1' },
    },
  };
  (globalThis as ITestGlobal).__homeNFTActiveState = state;
  return { useActiveAccount: () => state };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  useAccountOverviewActions: () => ({
    current: { updateAllNetworksState: jest.fn() },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => {
  const control: ITestGlobal['__homeNFTAllNetworkControl'] = {
    run: jest.fn<Promise<void>, [Record<string, unknown>?]>(() =>
      Promise.resolve(),
    ),
  };
  (globalThis as ITestGlobal).__homeNFTAllNetworkControl = control;
  return {
    useAllNetworkRequests: (params: ITestAllNetworkParams) => {
      control.params = params;
      return { isEmptyAccount: false, run: control.run };
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const control = {
    fetchAccountNFTs: jest.fn<Promise<ITestNFTResponse>, [unknown]>(),
    getAccountLocalNFTs: jest.fn<Promise<ITestNFT[]>, [unknown]>(),
    updateCurrentAccount: jest.fn<Promise<void>, [unknown]>(),
  };
  (globalThis as ITestGlobal).__homeNFTBackgroundControl = control;
  return {
    __esModule: true,
    default: { serviceNFT: control },
  };
});

jest.mock('./homeStoreHooks', () => {
  return {
    useHomeFactsSnapshot: () => {
      const activeState = (globalThis as ITestGlobal).__homeNFTActiveState;
      const network = activeState.activeAccount.network;
      return {
        owner: {
          accountId: 'account-1',
          network: network.isAllNetworks
            ? { kind: 'allNetworks' as const }
            : {
                kind: 'singleNetwork' as const,
                networkId: network.id,
              },
          walletId: 'wallet-1',
        },
        ownerToken: { scopeKey: 'scope-1', sessionId: 'session-1' },
      };
    },
  };
});

jest.mock('./useHomeStoreSourcePublisher', () => {
  const handle = {
    payload: {
      ownerToken: { scopeKey: 'scope-1', sessionId: 'session-1' },
      sectionId: 'nft' as const,
    },
    token: {
      clientInstanceId: 'client-1',
      producerInstanceId: 'producer-1',
      protocolVersion: 1,
      requestSeq: 1,
      sessionId: 'session-1',
      sourceKey: {
        dataSchemaVersion: 1,
        paramsFingerprint: 'params-1',
        scopeKey: 'scope-1',
        sourceId: 'nft' as const,
      },
    },
  };
  const control = {
    begin: jest.fn(() => handle),
    complete: jest.fn(),
    handle,
    reset: jest.fn(),
  };
  (globalThis as ITestGlobal).__homeNFTPublisherControl = control;
  return {
    useHomeStoreSourcePublisher: () => ({
      beginHomeSectionRequest: control.begin,
      completeHomeSectionRequest: control.complete,
      resetHomeSectionSource: control.reset,
    }),
  };
});

const nft = {
  collectionAddress: 'collection-1',
  itemId: 'item-1',
  networkId: 'btc--0',
};

describe('useHomeNFTStoreSource', () => {
  const testGlobal = globalThis as ITestGlobal;

  beforeEach(() => {
    testGlobal.__homeNFTPublisherControl.begin.mockClear();
    testGlobal.__homeNFTPublisherControl.complete.mockClear();
    testGlobal.__homeNFTPublisherControl.reset.mockClear();
    testGlobal.__homeNFTAllNetworkControl.run.mockClear();
    testGlobal.__homeNFTBackgroundControl.fetchAccountNFTs.mockReset();
    testGlobal.__homeNFTBackgroundControl.getAccountLocalNFTs.mockReset();
    testGlobal.__homeNFTBackgroundControl.updateCurrentAccount.mockReset();
    testGlobal.__homeNFTBackgroundControl.updateCurrentAccount.mockResolvedValue();
    testGlobal.__homeNFTActiveState.activeAccount.network = {
      id: 'btc--0',
      isAllNetworks: false,
    };
  });

  it('begins one owner-scoped request before cache and live BG work, then completes the same handle', async () => {
    const background = testGlobal.__homeNFTBackgroundControl;
    const publisher = testGlobal.__homeNFTPublisherControl;
    background.getAccountLocalNFTs.mockResolvedValue([nft]);
    background.fetchAccountNFTs.mockResolvedValue({
      data: [nft],
      isSameAllNetworksAccountData: true,
      networkId: 'btc--0',
    });

    const view = renderHook(() =>
      useHomeNFTStoreSource({ enabled: true, visible: true }),
    );

    await waitFor(() => expect(publisher.complete).toHaveBeenCalledTimes(1));

    expect(publisher.begin).toHaveBeenCalledTimes(1);
    expect(publisher.complete).toHaveBeenCalledWith(
      publisher.handle,
      expect.objectContaining({ kind: 'ready' }),
    );
    expect(publisher.begin.mock.invocationCallOrder[0]).toBeLessThan(
      background.updateCurrentAccount.mock.invocationCallOrder[0],
    );
    expect(publisher.begin.mock.invocationCallOrder[0]).toBeLessThan(
      background.getAccountLocalNFTs.mock.invocationCallOrder[0],
    );
    expect(publisher.begin.mock.invocationCallOrder[0]).toBeLessThan(
      background.fetchAccountNFTs.mock.invocationCallOrder[0],
    );
    expect(
      background.fetchAccountNFTs.mock.invocationCallOrder[0],
    ).toBeLessThan(publisher.complete.mock.invocationCallOrder[0]);

    view.unmount();
  });

  it('does not block cache and live NFT loading on account synchronization', async () => {
    const background = testGlobal.__homeNFTBackgroundControl;
    const publisher = testGlobal.__homeNFTPublisherControl;
    background.updateCurrentAccount.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    background.getAccountLocalNFTs.mockResolvedValue([]);
    background.fetchAccountNFTs.mockResolvedValue({
      data: [],
      isSameAllNetworksAccountData: true,
      networkId: 'btc--0',
    });

    const view = renderHook(() =>
      useHomeNFTStoreSource({ enabled: true, visible: true }),
    );

    await waitFor(() => expect(publisher.complete).toHaveBeenCalledTimes(1));
    expect(background.getAccountLocalNFTs).toHaveBeenCalledTimes(1);
    expect(background.fetchAccountNFTs).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('keeps the source applicable without fetching while the NFT tab is inactive', async () => {
    const background = testGlobal.__homeNFTBackgroundControl;
    const publisher = testGlobal.__homeNFTPublisherControl;

    const view = renderHook(() =>
      useHomeNFTStoreSource({ enabled: true, visible: false }),
    );

    await act(async () => Promise.resolve());

    expect(publisher.begin).not.toHaveBeenCalled();
    expect(publisher.complete).not.toHaveBeenCalled();
    expect(background.getAccountLocalNFTs).not.toHaveBeenCalled();
    expect(background.fetchAccountNFTs).not.toHaveBeenCalled();

    view.unmount();
  });

  it('opens the all-network request before account/cache/fan-out work and completes it once', async () => {
    const activeState = testGlobal.__homeNFTActiveState;
    activeState.activeAccount.network = {
      id: 'onekeyall--0',
      isAllNetworks: true,
    };
    const background = testGlobal.__homeNFTBackgroundControl;
    const publisher = testGlobal.__homeNFTPublisherControl;
    background.getAccountLocalNFTs.mockResolvedValue([nft]);
    background.fetchAccountNFTs.mockResolvedValue({
      data: [nft],
      isSameAllNetworksAccountData: true,
      networkId: 'btc--0',
    });

    const view = renderHook(() =>
      useHomeNFTStoreSource({ enabled: true, visible: false }),
    );
    const params = testGlobal.__homeNFTAllNetworkControl.params;
    expect(params).toBeDefined();

    await act(async () => {
      await params?.onStarted?.({
        accountId: 'account-1',
        networkId: 'onekeyall--0',
      });
      params?.allNetworkAccountsData?.({
        accounts: [
          {
            accountId: 'account-1',
            apiAddress: 'address-1',
            networkId: 'btc--0',
          },
        ],
        allAccounts: [
          {
            accountId: 'account-1',
            apiAddress: 'address-1',
            networkId: 'btc--0',
          },
        ],
      });
      await params?.allNetworkCacheRequests?.({
        accountAddress: 'address-1',
        accountId: 'account-1',
        networkId: 'btc--0',
      });
      const response = await params?.allNetworkRequests({
        accountId: 'account-1',
        networkId: 'btc--0',
      });
      if (response) {
        params?.onRequestSettled?.(response, 1);
      }
      await params?.onFinished?.();
    });

    expect(publisher.begin).toHaveBeenCalledTimes(1);
    expect(publisher.complete).toHaveBeenCalledTimes(1);
    expect(publisher.complete).toHaveBeenCalledWith(
      publisher.handle,
      expect.objectContaining({ kind: 'ready' }),
    );
    expect(publisher.begin.mock.invocationCallOrder[0]).toBeLessThan(
      background.updateCurrentAccount.mock.invocationCallOrder[0],
    );
    expect(publisher.begin.mock.invocationCallOrder[0]).toBeLessThan(
      background.getAccountLocalNFTs.mock.invocationCallOrder[0],
    );
    expect(publisher.begin.mock.invocationCallOrder[0]).toBeLessThan(
      background.fetchAccountNFTs.mock.invocationCallOrder[0],
    );
    expect(
      background.fetchAccountNFTs.mock.invocationCallOrder[0],
    ).toBeLessThan(publisher.complete.mock.invocationCallOrder[0]);

    view.unmount();
  });
});
