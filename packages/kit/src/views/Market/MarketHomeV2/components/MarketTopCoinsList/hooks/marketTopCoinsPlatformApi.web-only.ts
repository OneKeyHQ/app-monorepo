import { fetchMarketAssetListLight } from '@onekeyhq/kit/src/views/Market/utils/marketLightApi';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

const fetchMarketTopCoinsForPlatform = () =>
  fetchMarketAssetListLight({
    currency: 'usd',
    limit: 100,
    page: 1,
    type: MARKET_TOP_COINS_CATEGORY_ID,
  });

export { fetchMarketTopCoinsForPlatform };
