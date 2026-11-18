/**
 * @jest-environment jsdom
 */
import type { ComponentProps, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { act, render } from '@testing-library/react';

import { resetChainSelectorModal } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ChainSelectorTestIDs } from '../../testIDs';

import {
  clearMoneroPortfolioDraft,
  readMoneroPortfolioDraft,
  saveMoneroPortfolioDraft,
} from './moneroPortfolioDraft';
import UnifiedNetworkSelectorPageV2 from './UnifiedNetworkSelectorV2';

import type { NetworkContentV2 } from './NetworkContentV2';
import type PortfolioContentV2 from './PortfolioContentV2';
import type { useMoneroPortfolioGate } from './useMoneroPortfolioGate';
import type { IServerNetworkMatch } from '../../types';

type IPortfolioProps = ComponentProps<typeof PortfolioContentV2>;
type INetworkProps = ComponentProps<typeof NetworkContentV2>;
type INetworksState = IPortfolioProps['networksState'];
type IMeta = {
  allNetworksState: INetworksState;
  allNetworks: IServerNetworkMatch[];
  compatibleNetworks: {
    mainnetItems: IServerNetworkMatch[];
    frequentlyUsedItems: IServerNetworkMatch[];
  };
};
type IEnvironment = {
  networkMeta: IMeta;
  walletId: string;
  emptyWallet?: boolean;
};

const mockNetworks = ['a', 'b'].map(
  (id) => ({ id, name: id, isTestnet: false }) as IServerNetworkMatch,
);
function mockMeta(allNetworksState: INetworksState): IMeta {
  return {
    allNetworksState,
    allNetworks: mockNetworks,
    compatibleNetworks: {
      mainnetItems: mockNetworks,
      frequentlyUsedItems: [],
    },
  };
}

const mockCachedMeta = mockMeta({
  enabledNetworks: { a: true },
  disabledNetworks: { b: true },
});
const mockEnvironmentContext = createContext<IEnvironment>({
  networkMeta: mockCachedMeta,
  walletId: 'wallet-1',
});
const mockPortfolio = jest.fn((_props: IPortfolioProps) => null);
const mockNetwork = jest.fn((_props: INetworkProps) => null);
const mockRefresh = jest.fn();
const mockNavigation = { push: jest.fn() };
type ISelectedOwner = {
  walletId?: string;
  indexedAccountId?: string;
  networkId?: string;
};
const mockUpdateSelection = jest.fn<
  Promise<void>,
  [
    {
      num: number;
      reason: string;
      shouldCommit?: () => boolean;
      builder: (previous: ISelectedOwner) => ISelectedOwner;
    },
  ]
>();
const mockActions = {
  current: {
    updateSelectedAccountNetwork: jest.fn(),
    updateSelectedAccount: mockUpdateSelection,
  },
};
const mockCreateAddress = jest.fn();
const mockFindNetworks = jest.fn();
const mockPortfolioGate = jest.fn();
const mockUsePortfolioGate = jest.fn(
  (_props: Parameters<typeof useMoneroPortfolioGate>[0]) => mockPortfolioGate,
);
const mockUpdateAllNetworksState = jest
  .fn<Promise<void>, [INetworksState]>()
  .mockResolvedValue(undefined);
const mockButton = jest.fn(
  (_props: {
    children?: ReactNode;
    onPress?: () => Promise<void>;
    testID?: string;
  }) => null,
);
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockRoute = { params: { num: 0, sceneName: 'home' } };
function mockContainer({ children }: { children?: ReactNode }) {
  return children;
}

jest.mock('@onekeyhq/components', () => ({
  Button: (props: Parameters<typeof mockButton>[0]) => {
    mockButton(props);
    return mockContainer(props);
  },
  HeaderIconButton: () => null,
  Page: Object.assign(mockContainer, {
    Header: () => null,
    Body: mockContainer,
    Footer: mockContainer,
  }),
  SizableText: mockContainer,
  Stack: mockContainer,
  YStack: mockContainer,
  PagerView: mockContainer,
  resetChainSelectorModal: jest.fn(),
  useMedia: () => ({ gtMd: true }),
}));
jest.mock('@react-navigation/core', () => ({ useRoute: () => mockRoute }));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      updateAllNetworksState: (params: INetworksState) =>
        mockUpdateAllNetworksState(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ xmr: 'xmr--0', onekeyall: 'all' }),
}));
jest.mock('./useMoneroPortfolioGate', () => ({
  useMoneroPortfolioGate: (
    props: Parameters<typeof useMoneroPortfolioGate>[0],
  ) => mockUsePortfolioGate(props),
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: mockContainer,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _callback: unknown,
    _deps: unknown,
    options: { swrKey: string },
  ) => {
    const { networkMeta } = useContext(mockEnvironmentContext);
    return {
      result: options.swrKey.startsWith('meta:') ? networkMeta : undefined,
      run: mockRefresh,
    };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => {
    const { walletId, emptyWallet } = useContext(mockEnvironmentContext);
    return {
      activeAccount: {
        network: { id: 'all' },
        account: emptyWallet ? undefined : { id: `${walletId}-account` },
        indexedAccount: emptyWallet ? undefined : { id: `${walletId}--0` },
        wallet: { id: walletId },
      },
    };
  },
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({ useAccountSelectorActions: () => mockActions }),
);
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({
      createAddress: mockCreateAddress,
    }),
  }),
);
jest.mock('../../hooks/useFindNetworksWithoutAccount', () => ({
  useFindNetworksWithoutAccount: () => ({
    findNetworksWithoutAccount: mockFindNetworks,
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AddedCustomNetwork: 'AddedCustomNetwork' },
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isOthersWallet: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => true },
  isEnabledNetworksInAllNetworks: ({
    networkId,
    enabledNetworks,
    disabledNetworks,
  }: INetworksState & { networkId: string }) =>
    enabledNetworks[networkId] && !disabledNetworks[networkId],
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { get: () => mockCachedMeta, set: jest.fn() },
  swrKeys: {
    unifiedNetworkSelectorMeta: ({ walletId }: { walletId: string }) =>
      `meta:${walletId}`,
    unifiedNetworkSelectorValues: () => 'values',
    recentNetworks: ({ walletId }: { walletId?: string }) =>
      `recent:${walletId ?? ''}`,
  },
}));
jest.mock('./PortfolioContentV2', () => ({
  __esModule: true,
  default: (props: IPortfolioProps) => mockPortfolio(props),
}));
jest.mock('./NetworkContentV2', () => ({
  NetworkContentV2: (props: INetworkProps) => mockNetwork(props),
}));
jest.mock('../UnifiedNetworkSelector/TabSwitcher', () => ({
  TabSwitcher: () => null,
}));
jest.mock('./useNetworkListPresentationV2', () => ({
  preloadNetworkImagesV2: jest.fn(),
}));

function selectorElement(value: IEnvironment) {
  return (
    <mockEnvironmentContext.Provider value={value}>
      <UnifiedNetworkSelectorPageV2 />
    </mockEnvironmentContext.Provider>
  );
}

function portfolioProps() {
  const props = mockPortfolio.mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('Portfolio did not render');
  return props;
}

describe('network selector selection revalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPortfolioGate.mockResolvedValue(false);
    mockFindNetworks.mockResolvedValue([]);
  });
  afterEach(() => {
    clearMoneroPortfolioDraft({
      walletId: 'wallet-1',
      accountId: 'wallet-1-account',
      indexedAccountId: 'wallet-1--0',
    });
  });

  it('refreshes cached selection before any local edits', () => {
    const view = render(
      selectorElement({ networkMeta: mockCachedMeta, walletId: 'wallet-1' }),
    );
    const refreshed = mockMeta({
      enabledNetworks: { b: true },
      disabledNetworks: { a: true },
    });
    view.rerender(
      selectorElement({ networkMeta: refreshed, walletId: 'wallet-1' }),
    );
    expect(portfolioProps().networksState).toEqual(refreshed.allNetworksState);
  });

  it('uses separate section index hosts for the two tabs', () => {
    render(
      selectorElement({ networkMeta: mockCachedMeta, walletId: 'wallet-1' }),
    );
    expect(mockPortfolio).toHaveBeenCalled();
    expect(mockNetwork).toHaveBeenCalled();
    expect(
      mockPortfolio.mock.calls.at(-1)?.[0].webSectionIndexContainerRef,
    ).not.toBe(mockNetwork.mock.calls.at(-1)?.[0].webSectionIndexContainerRef);
  });

  it.each(['functional', 'replacement'] as const)(
    'preserves %s selection edits when an in-flight refresh finishes',
    (updateType) => {
      const view = render(
        selectorElement({ networkMeta: mockCachedMeta, walletId: 'wallet-1' }),
      );
      const selected: INetworksState = {
        enabledNetworks: { a: true, b: true },
        disabledNetworks: { b: false },
      };
      act(() => {
        portfolioProps().setNetworksState(
          updateType === 'functional' ? () => selected : selected,
        );
      });
      view.rerender(
        selectorElement({
          networkMeta: mockMeta(mockCachedMeta.allNetworksState),
          walletId: 'wallet-1',
        }),
      );
      expect(portfolioProps().networksState).toEqual(selected);
      expect(portfolioProps().enabledNetworks.map(({ id }) => id)).toEqual([
        'a',
        'b',
      ]);
    },
  );

  it('does not retain the edit guard for a different account', () => {
    const view = render(
      selectorElement({ networkMeta: mockCachedMeta, walletId: 'wallet-1' }),
    );
    act(() => {
      portfolioProps().setNetworksState({
        enabledNetworks: { a: true, b: true },
        disabledNetworks: {},
      });
    });
    const refreshed = mockMeta({
      enabledNetworks: { b: true },
      disabledNetworks: { a: true },
    });
    view.rerender(
      selectorElement({ networkMeta: refreshed, walletId: 'wallet-2' }),
    );
    expect(portfolioProps().networksState).toEqual(refreshed.allNetworksState);
  });

  it('gates Monero before creating addresses, saving choices, or leaving the selector', async () => {
    const monero = {
      id: 'xmr--0',
      name: 'Monero',
      isTestnet: false,
    } as IServerNetworkMatch;
    const meta = mockMeta(mockCachedMeta.allNetworksState);
    meta.allNetworks = [...mockNetworks, monero];
    meta.compatibleNetworks.mainnetItems = meta.allNetworks;
    mockPortfolioGate.mockResolvedValue(true);
    render(selectorElement({ networkMeta: meta, walletId: 'wallet-1' }));
    const selection = {
      enabledNetworks: { a: true, 'xmr--0': true },
      disabledNetworks: { b: true },
    };
    act(() => portfolioProps().setNetworksState(selection));
    const confirm = mockButton.mock.calls
      .filter(
        ([props]) =>
          props.testID === ChainSelectorTestIDs.unifiedPortfolioConfirmBtn,
      )
      .at(-1)?.[0];
    await act(async () => {
      await confirm?.onPress?.();
    });
    expect(mockPortfolioGate).toHaveBeenCalledWith(monero);
    expect(mockFindNetworks).not.toHaveBeenCalled();
    expect(mockCreateAddress).not.toHaveBeenCalled();
    expect(mockUpdateAllNetworksState).not.toHaveBeenCalled();
    expect(
      mockActions.current.updateSelectedAccountNetwork,
    ).not.toHaveBeenCalled();
    expect(portfolioProps().networksState).toEqual(selection);
  });

  it('Skip saves all other selected networks and creates only their missing addresses', async () => {
    const monero = {
      id: 'xmr--0',
      name: 'Monero',
      isTestnet: false,
    } as IServerNetworkMatch;
    const meta = mockMeta(mockCachedMeta.allNetworksState);
    meta.allNetworks = [...mockNetworks, monero];
    meta.compatibleNetworks.mainnetItems = meta.allNetworks;
    render(selectorElement({ networkMeta: meta, walletId: 'wallet-1' }));
    act(() =>
      portfolioProps().setNetworksState({
        enabledNetworks: { a: true, b: true, 'xmr--0': true },
        disabledNetworks: { b: false, other: true },
      }),
    );
    const missing = [{ networkId: 'b', deriveType: 'default' }];
    mockFindNetworks.mockResolvedValue(missing);
    const gate = mockUsePortfolioGate.mock.calls.at(-1)?.[0];
    await act(async () => {
      await gate?.onSkipNetwork(monero, () => true);
    });
    expect(mockFindNetworks).toHaveBeenCalledWith(
      expect.objectContaining({ enabledNetworks: mockNetworks }),
    );
    expect(mockCreateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ customNetworks: missing }),
    );
    expect(mockUpdateAllNetworksState).toHaveBeenCalledWith({
      enabledNetworks: { a: true, b: true, 'xmr--0': false },
      disabledNetworks: { b: false, other: true, 'xmr--0': true },
    });
    expect(resetChainSelectorModal).toHaveBeenCalledTimes(1);
    expect(mockPortfolioGate).not.toHaveBeenCalled();
  });

  it('Skip stops before account creation or saving when its owner becomes stale', async () => {
    const monero = {
      id: 'xmr--0',
      name: 'Monero',
      isTestnet: false,
    } as IServerNetworkMatch;
    const meta = mockMeta(mockCachedMeta.allNetworksState);
    meta.allNetworks = [...mockNetworks, monero];
    meta.compatibleNetworks.mainnetItems = meta.allNetworks;
    render(selectorElement({ networkMeta: meta, walletId: 'wallet-1' }));
    act(() =>
      portfolioProps().setNetworksState({
        enabledNetworks: { a: true, 'xmr--0': true },
        disabledNetworks: {},
      }),
    );
    let currentOwner = true;
    let finishRead:
      | ((networks: { networkId: string; deriveType: string }[]) => void)
      | undefined;
    mockFindNetworks.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    const gate = mockUsePortfolioGate.mock.calls.at(-1)?.[0];
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = gate?.onSkipNetwork(monero, () => currentOwner);
    });
    currentOwner = false;
    await act(async () => {
      finishRead?.([{ networkId: 'a', deriveType: 'default' }]);
      await pending;
    });
    expect(mockCreateAddress).not.toHaveBeenCalled();
    expect(mockUpdateAllNetworksState).not.toHaveBeenCalled();
    expect(resetChainSelectorModal).not.toHaveBeenCalled();
  });

  it('Skip with only Monero selected keeps the existing empty-selection rule', async () => {
    const monero = {
      id: 'xmr--0',
      name: 'Monero',
      isTestnet: false,
    } as IServerNetworkMatch;
    const meta = mockMeta(mockCachedMeta.allNetworksState);
    meta.allNetworks = [...mockNetworks, monero];
    meta.compatibleNetworks.mainnetItems = meta.allNetworks;
    render(selectorElement({ networkMeta: meta, walletId: 'wallet-1' }));
    act(() =>
      portfolioProps().setNetworksState({
        enabledNetworks: { 'xmr--0': true },
        disabledNetworks: { a: true, b: true },
      }),
    );
    const gate = mockUsePortfolioGate.mock.calls.at(-1)?.[0];
    await act(async () => {
      await gate?.onSkipNetwork(monero, () => true);
    });
    expect(portfolioProps().enabledNetworks).toEqual([]);
    expect(portfolioProps().networksState).toEqual({
      enabledNetworks: { 'xmr--0': false },
      disabledNetworks: { a: true, b: true, 'xmr--0': true },
    });
    expect(mockFindNetworks).not.toHaveBeenCalled();
    expect(mockCreateAddress).not.toHaveBeenCalled();
    expect(mockUpdateAllNetworksState).not.toHaveBeenCalled();
    expect(resetChainSelectorModal).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'Skip creates the first index and conditionally selects it without overwriting another wallet (%s)',
    async (walletChangedBeforeSelection) => {
      const monero = {
        id: 'xmr--0',
        name: 'Monero',
        isTestnet: false,
      } as IServerNetworkMatch;
      const meta = mockMeta(mockCachedMeta.allNetworksState);
      meta.allNetworks = [...mockNetworks, monero];
      meta.compatibleNetworks.mainnetItems = meta.allNetworks;
      render(
        selectorElement({
          networkMeta: meta,
          walletId: 'wallet-1',
          emptyWallet: true,
        }),
      );
      act(() =>
        portfolioProps().setNetworksState({
          enabledNetworks: { a: true, 'xmr--0': true },
          disabledNetworks: { b: true },
        }),
      );
      mockFindNetworks.mockResolvedValue([
        { networkId: 'a', deriveType: 'default' },
      ]);
      const created = {
        walletId: 'wallet-1',
        indexedAccountId: 'wallet-1--0',
        accounts: [],
      };
      mockCreateAddress.mockResolvedValue(created);
      let selected: ISelectedOwner = {
        walletId: walletChangedBeforeSelection ? 'wallet-2' : 'wallet-1',
        networkId: 'all',
      };
      mockUpdateSelection.mockImplementation(
        async ({ builder, shouldCommit }) => {
          if (!shouldCommit || shouldCommit()) selected = builder(selected);
        },
      );
      const guard = jest.fn(() => true);
      const gate = mockUsePortfolioGate.mock.calls.at(-1)?.[0];
      await act(async () => {
        await gate?.onSkipNetwork(monero, guard);
      });
      expect(mockCreateAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          num: 0,
          customNetworks: [{ networkId: 'a', deriveType: 'default' }],
        }),
      );
      expect(
        mockCreateAddress.mock.calls[0][0].selectAfterCreate,
      ).toBeUndefined();
      expect(guard).toHaveBeenCalledWith(created);
      if (walletChangedBeforeSelection) {
        expect(selected).toEqual({ walletId: 'wallet-2', networkId: 'all' });
        expect(mockUpdateAllNetworksState).not.toHaveBeenCalled();
        expect(resetChainSelectorModal).not.toHaveBeenCalled();
      } else {
        expect(selected).toEqual({
          walletId: 'wallet-1',
          networkId: 'all',
          indexedAccountId: created.indexedAccountId,
        });
        expect(mockUpdateAllNetworksState).toHaveBeenCalledWith({
          enabledNetworks: { a: true, 'xmr--0': false },
          disabledNetworks: { b: true, 'xmr--0': true },
        });
        expect(resetChainSelectorModal).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('saves a restored draft against the persisted selection and clears it after Done', async () => {
    const owner = {
      walletId: 'wallet-1',
      accountId: 'wallet-1-account',
      indexedAccountId: 'wallet-1--0',
    };
    const selection = {
      enabledNetworks: { a: true, 'xmr--0': true },
      disabledNetworks: { b: true },
    };
    saveMoneroPortfolioDraft(owner, selection);
    const meta = mockMeta(mockCachedMeta.allNetworksState);
    meta.allNetworks = [
      ...mockNetworks,
      { id: 'xmr--0', name: 'Monero', isTestnet: false } as IServerNetworkMatch,
    ];
    meta.compatibleNetworks.mainnetItems = meta.allNetworks;
    render(selectorElement({ networkMeta: meta, walletId: 'wallet-1' }));
    expect(portfolioProps().networksState).toEqual(selection);
    const confirm = mockButton.mock.calls
      .filter(
        ([props]) =>
          props.testID === ChainSelectorTestIDs.unifiedPortfolioConfirmBtn,
      )
      .at(-1)?.[0];
    await act(async () => {
      await confirm?.onPress?.();
    });
    expect(mockUpdateAllNetworksState).toHaveBeenCalledWith(selection);
    expect(readMoneroPortfolioDraft(owner)).toBeUndefined();
  });
});
