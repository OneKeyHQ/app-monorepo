import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

const fetchMarketTopCoinsForPlatform = (type: string) =>
  backgroundApiProxy.serviceMarket.fetchMarketAssetList({
    currency: 'usd',
    limit: 100,
    page: 1,
    type,
  });

export { fetchMarketTopCoinsForPlatform };
