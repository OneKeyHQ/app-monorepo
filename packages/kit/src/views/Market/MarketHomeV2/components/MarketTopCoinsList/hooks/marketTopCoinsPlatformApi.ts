import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

const fetchMarketTopCoinsForPlatform = () =>
  backgroundApiProxy.serviceMarket.fetchMarketAssetList({
    currency: 'usd',
    limit: 100,
    page: 1,
    type: MARKET_TOP_COINS_CATEGORY_ID,
  });

export { fetchMarketTopCoinsForPlatform };
