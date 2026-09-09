/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { UniversalSearchAddressItem } from './UniversalSearchAddressItem';

let capturedOnPress: (() => Promise<void>) | undefined;
// One entry per ListItem render; used to compare render-prop identity across
// re-renders.
let capturedRenderItemTexts: unknown[] = [];

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockAddIntoRecentSearchList = jest.fn((_params: unknown) => undefined);
const mockToastError = jest.fn((_params: unknown) => undefined);
const mockNavigationPop = jest.fn();
const mockIsOthersAccount = jest.fn((_params: unknown) => false);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    SizableText: () => null,
    Toast: {
      error: (params: unknown) => {
        mockToastError(params);
      },
    },
    XStack: Passthrough,
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersAccount: (params: unknown) => mockIsOthersAccount(params),
    shortenAddress: ({ address }: { address?: string }) => address ?? '',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: () => false,
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItemMock = ({
    onPress,
    renderItemText,
  }: {
    onPress?: () => Promise<void>;
    renderItemText?: unknown;
  }) => {
    capturedOnPress = onPress;
    capturedRenderItemTexts.push(renderItemText);
    return null;
  };
  ListItemMock.Text = () => null;
  return { ListItem: ListItemMock };
});

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: () => ({ vaultSettings: undefined }),
}));

// Identity-stable result, matching the real hook which memoizes what it
// returns; a fresh object per render would defeat the render-prop identity
// assertions below through the renderAccountValue dependency chain.
const mockEnabledNetworksResult = {
  enabledNetworksCompatibleWithWalletId: [],
  networkInfoMap: {},
};

jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => ({
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks: () =>
    mockEnabledNetworksResult,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: mockNavigationPop,
    pushModal: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (
      _factory: unknown,
      _deps: unknown,
      options?: { initResult?: unknown },
    ) => {
      // Mirror the real hook: the result lives in state, so its identity does
      // not change just because the caller passes a fresh inline `initResult`
      // array on every render.
      const resultRef = useRef(options?.initResult);
      return {
        result: resultRef.current,
        isLoading: false,
      };
    },
  };
});

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: {
        confirmAccountSelect: async (params: unknown) =>
          mockConfirmAccountSelect(params),
      },
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/universalSearch', () => ({
  useUniversalSearchActions: () => ({
    current: {
      addIntoRecentSearchList: (params: unknown) =>
        mockAddIntoRecentSearchList(params),
    },
  }),
}));

jest.mock(
  '../../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/AccountAddress',
  () => ({
    AccountAddress: () => null,
  }),
);

jest.mock(
  '../../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/AccountValue',
  () => ({
    AccountValueWithSpotlight: () => null,
  }),
);

jest.mock('../../../Home/pages/urlAccount/urlAccountUtils', () => ({
  urlAccountNavigation: {
    pushOrReplaceUrlAccountPage: jest.fn(async () => undefined),
  },
}));

const item = {
  type: 'address',
  payload: {
    account: { id: 'hd-1--account-1' },
    indexedAccount: { id: 'hd-1--0' },
    wallet: { id: 'hd-1' },
    network: { id: 'evm--1' },
    addressInfo: { displayAddress: '0xabc' },
    accountInfo: { formattedName: 'Wallet / Account #1' },
    isSearchedByAccountName: false,
  },
} as unknown as Parameters<typeof UniversalSearchAddressItem>[0]['item'];

async function pressAccountItem() {
  render(
    <UniversalSearchAddressItem
      item={item}
      contextNetworkId="evm--1"
      getSearchInput={() => '0xabc'}
      source={'searchPage' as never}
    />,
  );
  expect(capturedOnPress).toBeDefined();
  await act(async () => {
    await capturedOnPress?.();
  });
  // The recent-search recording is deferred through a 10ms setTimeout.
  act(() => {
    jest.advanceTimersByTime(10);
  });
}

describe('UniversalSearchAddressItem account select', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    capturedOnPress = undefined;
    capturedRenderItemTexts = [];
    mockConfirmAccountSelect.mockImplementation(async () => true);
    mockIsOthersAccount.mockImplementation(() => false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the renderItemText identity stable across unrelated re-renders', () => {
    // ListItem renders renderItemText as a component type
    // (`<Render {...props} />`), so a new function identity per render means
    // React unmounts and remounts the whole text subtree. This guards the
    // useCallback memoization: reverting it to an inline arrow would hand
    // ListItem a fresh function on the second render and fail this test.
    const getSearchInput = () => '0xabc';
    const view = render(
      <UniversalSearchAddressItem
        item={item}
        contextNetworkId="evm--1"
        getSearchInput={getSearchInput}
        source={'searchPage' as never}
      />,
    );
    view.rerender(
      <UniversalSearchAddressItem
        item={item}
        contextNetworkId="evm--1"
        getSearchInput={getSearchInput}
        source={'searchPage' as never}
      />,
    );

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(typeof capturedRenderItemTexts[0]).toBe('function');
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
  });

  it('toasts on a rejected confirmAccountSelect and still records the recent search', async () => {
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await pressAccountItem();

    expect(mockNavigationPop).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    // The failure must fall through: the click still belongs in recents.
    expect(mockAddIntoRecentSearchList).toHaveBeenCalledTimes(1);
  });

  it('silently records the recent search when confirmAccountSelect returns false', async () => {
    mockConfirmAccountSelect.mockResolvedValue(false);

    await pressAccountItem();

    expect(mockNavigationPop).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockAddIntoRecentSearchList).toHaveBeenCalledTimes(1);
  });

  it('records the recent search without a toast when the selection is persisted', async () => {
    await pressAccountItem();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect.mock.calls[0][0]).toMatchObject({
      entry: 'universalSearch:indexedAccount',
      throwOnError: true,
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockAddIntoRecentSearchList).toHaveBeenCalledTimes(1);
  });

  it('selects through the others-wallet entry for others accounts', async () => {
    mockIsOthersAccount.mockImplementation(() => true);

    await pressAccountItem();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect.mock.calls[0][0]).toMatchObject({
      entry: 'universalSearch:othersWallet',
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
