/**
 * @jest-environment jsdom
 */
import type { ComponentProps, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import UnifiedNetworkSelectorPageV2 from './UnifiedNetworkSelectorV2';

import type PortfolioContentV2 from './PortfolioContentV2';
import type { IServerNetworkMatch } from '../../types';

type IPortfolioProps = ComponentProps<typeof PortfolioContentV2>;
type INetworksState = IPortfolioProps['networksState'];
type IMeta = {
  allNetworksState: INetworksState;
  allNetworks: IServerNetworkMatch[];
  compatibleNetworks: {
    mainnetItems: IServerNetworkMatch[];
    frequentlyUsedItems: IServerNetworkMatch[];
  };
};
type IEnvironment = { networkMeta: IMeta; walletId: string };

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
const mockRefresh = jest.fn();
const mockNavigation = { push: jest.fn() };
const mockActions = { current: { updateSelectedAccountNetwork: jest.fn() } };
const mockCreateAddress = jest.fn();
const mockFindNetworks = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockRoute = { params: { num: 0, sceneName: 'home' } };
function mockContainer({ children }: { children?: ReactNode }) {
  return children;
}

jest.mock('@onekeyhq/components', () => ({
  Button: mockContainer,
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
}));
jest.mock('@react-navigation/core', () => ({ useRoute: () => mockRoute }));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
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
    const { walletId } = useContext(mockEnvironmentContext);
    return {
      activeAccount: {
        network: { id: 'all' },
        account: { id: `${walletId}-account` },
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
  swrCacheUtils: { get: () => mockCachedMeta },
  swrKeys: {
    unifiedNetworkSelectorMeta: ({ walletId }: { walletId: string }) =>
      `meta:${walletId}`,
    unifiedNetworkSelectorValues: () => 'values',
  },
}));
jest.mock('./PortfolioContentV2', () => ({
  __esModule: true,
  default: (props: IPortfolioProps) => mockPortfolio(props),
}));
jest.mock('./NetworkContentV2', () => ({ NetworkContentV2: () => null }));
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
  beforeEach(() => jest.clearAllMocks());

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
});
