import { Toast } from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { handleMarketWidgetLink } from './marketWidgetLink';

jest.mock('@onekeyhq/components', () => ({ Toast: { error: jest.fn() } }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: () => 'An error occurred' } },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkShortCode: ({ networkId }: { networkId: string }) => networkId,
  },
}));
jest.mock('../../../utils/passwordUtils', () => ({
  whenAppUnlocked: async () => undefined,
}));
jest.mock('../../../views/Market/utils/marketDetailNavigation', () => ({
  prepareMarketDetailTabBarTransition: jest.fn(),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarket: { fetchMarketAssetDetail: jest.fn() } },
}));

describe('market widget destination mapping', () => {
  const navigate = jest.fn();
  const fetchAssetDetail = jest.spyOn(
    backgroundApiProxy.serviceMarket,
    'fetchMarketAssetDetail',
  );

  beforeEach(() => {
    jest.clearAllMocks();
    appGlobals.$rootAppNavigation = {
      navigate,
    } as unknown as typeof appGlobals.$rootAppNavigation;
    appGlobals.$navigationRef = {
      current: { isReady: () => true },
    } as typeof appGlobals.$navigationRef;
  });

  it('opens native detail for an empty native-token address', async () => {
    await handleMarketWidgetLink({
      target: {
        kind: 'token',
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
      },
      shouldContinue: () => true,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketNativeDetail,
        params: expect.objectContaining({ network: 'evm--1', isNative: true }),
      },
    });
    expect(fetchAssetDetail).not.toHaveBeenCalled();
  });

  it('preserves the native Move type tag when opening SUI detail', async () => {
    await handleMarketWidgetLink({
      target: {
        kind: 'token',
        chainId: 'sui--mainnet',
        contractAddress: '0x2::sui::SUI',
        isNative: true,
      },
      shouldContinue: () => true,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: expect.objectContaining({
          tokenAddress: '0x2::sui::SUI',
          isNative: true,
        }),
      },
    });
  });

  it('resolves a listing through its selected variant and retains the listing identity', async () => {
    fetchAssetDetail.mockResolvedValue({
      selectedVariant: {
        networkId: 'btc--0',
        tokenAddress: '',
        isNative: true,
        variantId: 'btc-native',
      },
    } as IMarketAssetDetailData);
    await handleMarketWidgetLink({
      target: { kind: 'asset', assetId: 'bitcoin' },
      shouldContinue: () => true,
    });
    expect(fetchAssetDetail).toHaveBeenCalledWith({
      assetId: 'bitcoin',
      currency: 'usd',
      autoHandleError: false,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketNativeDetail,
        params: expect.objectContaining({
          network: 'btc--0',
          marketTokenId: 'bitcoin',
          marketVariantId: 'btc-native',
        }),
      },
    });
  });

  it('shows an error instead of opening a wrong coin when listing resolution fails', async () => {
    fetchAssetDetail.mockRejectedValue(new Error('offline'));
    await handleMarketWidgetLink({
      target: { kind: 'asset', assetId: 'bitcoin' },
      shouldContinue: () => true,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledTimes(1);
  });
});
