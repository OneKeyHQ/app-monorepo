/** @jest-environment jsdom */

import { act, fireEvent, render } from '@testing-library/react';

import {
  EUniversalSearchSource,
  EUniversalSearchType,
  type IUniversalSearchV2MarketToken,
} from '@onekeyhq/shared/types/search';

import { UniversalSearchV2MarketTokenItem } from './UniversalSearchV2MarketTokenItem';

const mockToMarketDetailPage = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    ReactModule.createElement('div', null, children);

  return {
    IconButton: () => null,
    NumberSizeableText: Container,
    SizableText: Container,
    Stack: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      ReactModule.createElement(
        'button',
        { 'data-testid': 'market-search-result', onClick: onPress },
        children,
      ),
    XStack: Container,
    YStack: Container,
    rootNavigationRef: {
      current: {
        goBack: (...args: unknown[]) => {
          mockGoBack(...args);
        },
      },
    },
    useClipboard: () => ({ copyText: jest.fn() }),
    useMedia: () => ({ gtMd: false }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useMarketWatchListV2Atom: () => [{ isMounted: true }],
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/universalSearch', () => ({
  useUniversalSearchActions: () => ({
    current: { addIntoRecentSearchList: jest.fn() },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage',
  () => ({
    useToDetailPage: () => mockToMarketDetailPage,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge',
  () => ({
    CommunityRecognizedBadge: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  StockSourceLogo: () => null,
  SubtitleBadge: () => null,
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/TokenTagsPopover', () => ({
  TokenTagsPopover: () => null,
}));

jest.mock('../../../Market/components/MarketStarV2Deferred', () => ({
  MarketStarV2Deferred: () => null,
}));

jest.mock('../../../Market/components/MarketTokenIcon', () => ({
  MarketTokenIcon: () => null,
}));

jest.mock('../../../Market/components/MarketTokenPrice', () => ({
  BaseMarketTokenPrice: () => null,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    universalSearch: {
      search: { universalSearchClick: jest.fn() },
    },
    market: {
      token: { searchToken: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  formatTokenSymbolForDisplay: (symbol: string) => symbol,
  getTokenPriceChangeStyle: () => ({
    changeColor: '$text',
    showPlusMinusSigns: false,
  }),
}));

describe('UniversalSearchV2MarketTokenItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('preserves stock identity when opening a market search result', () => {
    const item: IUniversalSearchV2MarketToken = {
      type: EUniversalSearchType.V2MarketToken,
      payload: {
        name: 'Airbnb (Ondo Tokenized)',
        price: '183.37',
        symbol: 'ABNBon',
        address: '0xabnb',
        network: 'evm--56',
        logoUrl: '',
        isNative: false,
        decimals: 18,
        liquidity: '0',
        volume_24h: '625182693.52',
        stock: {
          stockId: 'ABNB',
          subtitle: 'Airbnb',
          sourceLogoUri: '',
        },
      },
    };

    const { getByTestId } = render(
      <UniversalSearchV2MarketTokenItem
        item={item}
        getSearchInput={() => 'abnb'}
        source={EUniversalSearchSource.Market}
      />,
    );

    fireEvent.click(getByTestId('market-search-result'));
    act(() => {
      jest.advanceTimersByTime(80);
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockToMarketDetailPage).toHaveBeenCalledWith({
      tokenAddress: '0xabnb',
      networkId: 'evm--56',
      name: 'Airbnb (Ondo Tokenized)',
      symbol: 'ABNBon',
      isNative: false,
      stock: item.payload.stock,
    });
  });

  it('preserves xStocks metadata when stock identity is omitted', () => {
    const item: IUniversalSearchV2MarketToken = {
      type: EUniversalSearchType.V2MarketToken,
      payload: {
        name: 'Airbnb xStock',
        price: '182.30',
        symbol: 'ABNBx',
        address: '0xc156',
        network: 'evm--196',
        logoUrl: '',
        isNative: false,
        decimals: 18,
        liquidity: '0',
        volume_24h: '0',
      },
    };

    const { getByTestId } = render(
      <UniversalSearchV2MarketTokenItem
        item={item}
        getSearchInput={() => 'abnb'}
        source={EUniversalSearchSource.Market}
      />,
    );

    fireEvent.click(getByTestId('market-search-result'));
    act(() => {
      jest.advanceTimersByTime(80);
    });

    expect(mockToMarketDetailPage).toHaveBeenCalledWith({
      tokenAddress: '0xc156',
      networkId: 'evm--196',
      name: 'Airbnb xStock',
      symbol: 'ABNBx',
      isNative: false,
      stock: undefined,
    });
  });
});
