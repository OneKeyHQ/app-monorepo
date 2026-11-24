/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { NativeMarketDetailContent } from '.';

import { act, cleanup, render, screen } from '@testing-library/react';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

let mockCurrencyInfo = { id: 'cny', symbol: '¥' };
const mockCurrencyMap: Record<string, ICurrencyItem> = {
  usd: { id: 'usd', unit: '$', name: 'USD', type: ['fiat'], value: '1' },
  cny: { id: 'cny', unit: '¥', name: 'CNY', type: ['fiat'], value: '6.67' },
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const { numberFormat } = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/numberUtils')
  >('@onekeyhq/shared/src/utils/numberUtils');
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const View = ({ children }: PropsWithChildren) => <div>{children}</div>;
  const Page = Object.assign(View, { Header: () => null, Body: View });

  return {
    Button: View,
    Page,
    ScrollView: View,
    SizableText: View,
    Spinner: () => <span>Loading</span>,
    Stack: View,
    XStack: View,
    YStack: View,
    NumberSizeableText: ({
      children,
      formatter,
      formatterOptions,
    }: INumberSizeableTextProps) => (
      <span>
        {numberFormat(String(children ?? ''), { formatter, formatterOptions })}
      </span>
    ),
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarket: { fetchMarketTokenDetail: jest.fn() } },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: mockCurrencyInfo }],
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
  useSettingsValuePersistAtom: () => [{ hideValue: false }],
}));
jest.mock('../../../Market/components/MarketTokenIcon', () => ({
  MarketTokenIcon: () => null,
}));
jest.mock('../../../Market/components/PriceChangePercentage', () => ({
  PriceChangePercentage: () => null,
}));
jest.mock('../../../Market/components/TokenPriceChart', () => ({
  TokenPriceChart: () => null,
}));

const token: IMarketTokenDetail = {
  name: 'BNB',
  symbol: 'BNB',
  image: '',
  about: '',
  explorers: [],
  links: {
    homePageUrl: '',
    discordUrl: '',
    twitterUrl: '',
    whitepaper: '',
    telegramUrl: '',
  },
  stats: {
    currentPrice: '683.37',
    lastUpdated: '2026-11-11T00:00:00Z',
    performance: {
      priceChangePercentage1h: 0,
      priceChangePercentage24h: -0.89,
      priceChangePercentage7d: 0,
      priceChangePercentage14d: 0,
      priceChangePercentage30d: 0,
      priceChangePercentage1y: 0,
    },
    marketCap: 0,
    marketCapRank: 0,
    volume24h: 0,
    low24h: 0,
    high24h: 0,
    atl: { time: new Date(0), value: 0 },
    ath: { time: new Date(0), value: 0 },
    fdv: 0,
    circulatingSupply: 0,
    totalSupply: 0,
    maxSupply: 0,
  },
  fallbackToChart: true,
  detailPlatforms: {},
  platforms: {},
};

const mockFetchToken = jest.spyOn(
  backgroundApiProxy.serviceMarket,
  'fetchMarketTokenDetail',
);

beforeEach(() => {
  jest.useFakeTimers();
  mockFetchToken.mockReset();
  mockFetchToken.mockImplementation(
    async (_coinGeckoId, _explorerPlatforms, requestCurrency) => ({
      ...token,
      stats: {
        ...token.stats,
        currentPrice:
          (requestCurrency ?? mockCurrencyInfo.id) === 'usd'
            ? '683.37'
            : '4556.86',
      },
    }),
  );
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it.each([
  { id: 'cny', symbol: '¥' },
  { id: 'usd', symbol: '$' },
])(
  'keeps the wallet market price in USD when settings use $id',
  async (currency) => {
    mockCurrencyInfo = currency;
    render(<NativeMarketDetailContent coinGeckoId="binancecoin" />);

    await act(() => jest.advanceTimersByTimeAsync(0));

    expect(screen.getByText('$683.37')).toBeTruthy();
    expect(mockFetchToken).toHaveBeenCalledWith('binancecoin', true, 'usd');
  },
);
