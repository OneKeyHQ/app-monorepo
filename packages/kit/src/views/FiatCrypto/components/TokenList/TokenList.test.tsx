import type { ReactNode } from 'react';

import { TokenList } from '.';

import { render } from '@testing-library/react-native';

import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { TokenDataContext } from '../TokenDataContainer';
import { TokenListMetaContainer } from '../TokenListMeta';

type IMockChildrenProps = { children?: ReactNode };
type IMockListViewProps<T> = {
  data: T[];
  renderItem: (info: { item: T; index: number }) => ReactNode;
  ListEmptyComponent?: ReactNode;
};

const mockBadgeChildren: unknown[] = [];
const mockAddressTypeSelectorNetworkIds: string[] = [];
const mockRenderedTokenProps: Array<{ networkImageUri?: string }> = [];
let mockSkeletonCount = 0;
let mockEmptyCount = 0;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React: typeof import('react') = require('react');

  function Stack({ children }: IMockChildrenProps) {
    return <>{children}</>;
  }

  function Badge({ children }: IMockChildrenProps) {
    mockBadgeChildren.push(children);
    return <>{children}</>;
  }

  function Skeleton() {
    mockSkeletonCount += 1;
    return null;
  }
  Skeleton.BodyLg = Skeleton;
  Skeleton.BodyMd = Skeleton;

  function Empty() {
    mockEmptyCount += 1;
    return null;
  }

  function ListView<T>({
    data,
    renderItem,
    ListEmptyComponent,
  }: IMockListViewProps<T>) {
    if (data.length === 0) {
      return <>{ListEmptyComponent}</>;
    }
    return (
      <>
        {data.map((item, index) => (
          <React.Fragment key={index}>
            {renderItem({ item, index })}
          </React.Fragment>
        ))}
      </>
    );
  }

  return {
    Badge,
    Empty,
    ListView,
    NumberSizeableText: Stack,
    SearchBar: () => null,
    SizableText: Stack,
    Skeleton,
    Spinner: () => null,
    Stack,
    XStack: Stack,
    YStack: Stack,
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

// `TokenDataContainer` pulls in the navigation-aware promise hook; the tests
// only consume its context object, so keep the hook out of the module graph.
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({ createAddress: jest.fn() }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector',
  () => ({
    __esModule: true,
    default: (props: {
      networkId: string;
      renderSelectorTrigger: ReactNode;
    }) => {
      mockAddressTypeSelectorNetworkIds.push(props.networkId);
      return <>{props.renderSelectorTrigger}</>;
    },
  }),
);

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  function ListItem({ children }: IMockChildrenProps) {
    return <>{children}</>;
  }
  ListItem.Text = ({
    primary,
    secondary,
  }: {
    primary?: ReactNode;
    secondary?: ReactNode;
  }) => (
    <>
      {primary}
      {secondary}
    </>
  );
  return { ListItem };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: (props: { networkImageUri?: string }) => {
    mockRenderedTokenProps.push(props);
    return null;
  },
}));

// Rows must not depend on this hook any more; keep it inert so a regression
// that re-introduces per-row fetching shows up as missing data in the tests.
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: () => ({ account: undefined, vaultSettings: undefined }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));

const ACCOUNT_ID = 'hd-1--m/44h/0h/0h/0/0';
const TOKEN_DATA_CONTEXT_VALUE = {
  tokensMap: {},
  fiatMap: {},
  networkId: 'onekeyall--0',
  accountId: ACCOUNT_ID,
};

function createToken(
  networkId: string,
  symbol: string,
  popular = false,
): IFiatCryptoToken {
  return {
    address: '',
    name: `${symbol} name`,
    symbol,
    networkId,
    icon: `https://img.test/${symbol}.png`,
    popular,
  };
}

function createNetwork(id: string, name: string): IServerNetwork {
  return {
    id,
    name,
    logoURI: `https://img.test/${id}.png`,
  } as IServerNetwork;
}

function renderList({
  items,
  isLoading,
  networksMap = {},
  mergeDeriveAssetsNetworkIds = [],
  account,
}: {
  items: IFiatCryptoToken[];
  isLoading?: boolean;
  networksMap?: Record<string, IServerNetwork>;
  mergeDeriveAssetsNetworkIds?: string[];
  account?: INetworkAccount;
}) {
  return render(
    <TokenDataContext.Provider value={TOKEN_DATA_CONTEXT_VALUE}>
      <TokenListMetaContainer
        networksMap={networksMap}
        mergeDeriveAssetsNetworkIds={mergeDeriveAssetsNetworkIds}
        account={account}
      >
        <TokenList items={items} type="buy" isLoading={isLoading} />
      </TokenListMetaContainer>
    </TokenDataContext.Provider>,
  );
}

describe('FiatCrypto TokenList', () => {
  beforeEach(() => {
    mockBadgeChildren.length = 0;
    mockAddressTypeSelectorNetworkIds.length = 0;
    mockRenderedTokenProps.length = 0;
    mockSkeletonCount = 0;
    mockEmptyCount = 0;
  });

  it('shows the skeleton before the list request has reported any loading state', () => {
    renderList({ items: [], isLoading: undefined });

    expect(mockSkeletonCount).toBeGreaterThan(0);
    expect(mockEmptyCount).toBe(0);
  });

  it('shows the empty state once loading finished with no items', () => {
    renderList({ items: [], isLoading: false });

    expect(mockSkeletonCount).toBe(0);
    expect(mockEmptyCount).toBe(1);
  });

  it('renders cached items on the first frame instead of the skeleton', () => {
    renderList({
      items: [createToken('btc--0', 'BTC')],
      isLoading: undefined,
    });

    expect(mockSkeletonCount).toBe(0);
    expect(mockRenderedTokenProps).toHaveLength(1);
  });

  it('keeps showing items while a revalidation request is in flight', () => {
    renderList({
      items: [createToken('btc--0', 'BTC')],
      isLoading: true,
    });

    expect(mockSkeletonCount).toBe(0);
    expect(mockRenderedTokenProps).toHaveLength(1);
  });

  it('omits the chain badge while the network name is unknown', () => {
    renderList({
      items: [createToken('btc--0', 'BTC')],
      isLoading: false,
    });

    expect(mockBadgeChildren).toEqual([]);
  });

  it('renders the chain badge and network logo from the synchronous network map', () => {
    renderList({
      items: [createToken('btc--0', 'BTC')],
      isLoading: false,
      networksMap: { 'btc--0': createNetwork('btc--0', 'Bitcoin') },
    });

    expect(mockBadgeChildren).toEqual(['Bitcoin']);
    expect(mockRenderedTokenProps).toEqual([
      expect.objectContaining({
        networkImageUri: 'https://img.test/btc--0.png',
      }),
    ]);
  });

  it('wraps merge-derive network rows in the address type selector on the first render', () => {
    renderList({
      items: [createToken('btc--0', 'BTC'), createToken('evm--1', 'ETH')],
      isLoading: false,
      mergeDeriveAssetsNetworkIds: ['btc--0'],
      account: {
        id: ACCOUNT_ID,
        indexedAccountId: 'hd-1--0',
      } as INetworkAccount,
    });

    expect(mockAddressTypeSelectorNetworkIds).toEqual(['btc--0']);
  });
});
