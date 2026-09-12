/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { PopularTrading } from './PopularTrading';

import type { IFavoriteTokenDisplay } from './types';

const mockRecord: IFavoriteTokenDisplay = {
  assetId: 'bitcoin',
  chainId: '',
  contractAddress: '',
  isNative: false,
  symbol: 'BTC',
  name: 'Bitcoin',
  logoUrl: '',
  price: 1,
  priceChange24h: 0,
  marketCap: 1,
  volume24h: 1,
};
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Button: Stack,
    Icon: () => null,
    IconButton: () => null,
    useMedia: () => ({ md: false }),
    Toast: { error: jest.fn() },
    rootNavigationRef: { current: { navigate: jest.fn() } },
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtensionUiPopup: true },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getNetworkShortCode: () => 'btc' },
}));
jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  getTokenSubtitle: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: { openExtensionMarketTokenDetail: jest.fn() },
    serviceMarket: { fetchMarketAssetDetail: jest.fn() },
  },
}));
jest.mock('@onekeyhq/kit/src/components/Loading', () => ({
  ListLoading: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ switchTab: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ isLoading: false, run: jest.fn() }),
}));
jest.mock('../../../Market/hooks', () => ({
  useMarketBasicConfig: () => ({
    isLoading: false,
    homeTab: [],
    perpsCategories: [],
    spotCategories: [],
  }),
  useNavigateToMarketTab: () => jest.fn(),
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));
jest.mock('../../../Market/MarketHomeV2/components/CategorySelector', () => ({
  CategorySelector: () => null,
}));
jest.mock(
  '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers',
  () => ({ getNativeTokenInfo: jest.fn() }),
);
jest.mock(
  '../../../Market/MarketHomeV2/components/MarketTopCoinsList/hooks/useMarketTopCoins',
  () => ({ useMarketTopCoinResolver: () => jest.fn() }),
);
jest.mock('../RichBlock/RichBlock', () => ({
  RichBlock: ({ content }: { content: ReactNode }) => <div>{content}</div>,
}));
jest.mock('../RichTable', () => ({ RichTable: () => null }));
jest.mock('./metricColumns', () => ({ getPopularTradingColumns: () => [] }));
jest.mock('./useHomeMarketCategoryTokens', () => ({
  useHomeMarketCategoryTokens: () => ({
    categoryTokens: [mockRecord],
    isCategoryLoading: false,
  }),
}));
jest.mock('./utils', () => ({
  buildHomeMarketCategories: () => [{ id: 'top_coins', name: 'Top Coins' }],
}));
jest.mock('./MarketCategoryTokenList', () => ({
  MarketCategoryTokenList: ({
    onTokenPress,
  }: {
    onTokenPress: (record: IFavoriteTokenDisplay) => void;
  }) => (
    <button type="button" onClick={() => onTokenPress(mockRecord)}>
      Open token
    </button>
  ),
}));

const openDetail = jest.spyOn(
  backgroundApiProxy.serviceApp,
  'openExtensionMarketTokenDetail',
);
const fetchAsset = jest.spyOn(
  backgroundApiProxy.serviceMarket,
  'fetchMarketAssetDetail',
);
beforeEach(() => {
  jest.clearAllMocks();
  openDetail.mockReset().mockResolvedValue(undefined);
  fetchAsset.mockReset().mockResolvedValue({
    selectedVariant: {
      networkId: 'btc--0',
      tokenAddress: '',
      isNative: true,
      variantId: 'bitcoin-native',
    },
  } as Awaited<
    ReturnType<typeof backgroundApiProxy.serviceMarket.fetchMarketAssetDetail>
  >);
});

it('resolves the asset before opening and reports an async extension open failure once', async () => {
  openDetail.mockRejectedValueOnce(new Error('open failed'));
  render(<PopularTrading tableLayout />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  expect(openDetail).toHaveBeenCalledWith(
    expect.objectContaining({
      network: 'btc',
      tokenAddress: '',
      isNative: true,
      marketTokenId: 'bitcoin',
    }),
  );
  expect(Toast.error).toHaveBeenCalledTimes(1);
});

it('does not show an error for an older click after a newer selection succeeds', async () => {
  let rejectFirst: (error: Error) => void = () => undefined;
  openDetail.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectFirst = reject;
      }),
  );
  render(<PopularTrading tableLayout />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  await act(async () => {
    rejectFirst(new Error('late failure'));
  });
  expect(openDetail).toHaveBeenCalledTimes(2);
  expect(Toast.error).not.toHaveBeenCalled();
});

it('does not display an error when the extension detail opens successfully', async () => {
  render(<PopularTrading tableLayout />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open token'));
  });
  expect(openDetail).toHaveBeenCalledTimes(1);
  expect(Toast.error).not.toHaveBeenCalled();
});
