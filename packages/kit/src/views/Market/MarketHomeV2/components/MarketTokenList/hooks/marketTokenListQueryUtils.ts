import { MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID } from '@onekeyhq/shared/src/consts/marketConsts';

export function getMarketTokenListApiNetworkId({
  networkId,
  isAllNetworks,
  type,
}: {
  networkId: string;
  isAllNetworks: boolean;
  type?: string;
}) {
  return isAllNetworks ||
    type === 'stocks' ||
    type === MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID
    ? ''
    : networkId;
}
