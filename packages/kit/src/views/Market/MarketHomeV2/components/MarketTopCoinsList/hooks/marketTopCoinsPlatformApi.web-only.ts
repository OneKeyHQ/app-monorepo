import { fetchMarketAssetListLight } from '@onekeyhq/kit/src/views/Market/utils/marketLightApi';

const fetchMarketTopCoinsForPlatform = (type: string) =>
  fetchMarketAssetListLight({
    currency: 'usd',
    limit: 100,
    page: 1,
    type,
  });

export { fetchMarketTopCoinsForPlatform };
