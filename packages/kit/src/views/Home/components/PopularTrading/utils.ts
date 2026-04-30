import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import { getNativeTokenInfo } from '../../../Market/MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import type { IFavoriteTokenDisplay } from './types';

function getTokenKey(token: {
  chainId: string;
  contractAddress: string;
  perpsCoin?: string;
}) {
  if (token.perpsCoin) {
    return `perps:${token.perpsCoin}`;
  }
  return `${token.chainId}:${token.contractAddress}`;
}

const EMPTY_DISPLAY_TOKENS: IFavoriteTokenDisplay[] = [];

function mapMarketTokenToDisplay(
  item: IMarketTokenListItem,
): IFavoriteTokenDisplay | null {
  const chainId = item.networkId ?? item.chainId ?? '';
  if (!chainId) {
    return null;
  }

  const { isNative } = getNativeTokenInfo(item.isNative, item.address);

  return {
    chainId,
    contractAddress: isNative ? '' : (item.address ?? ''),
    isNative,
    symbol: item.symbol,
    name: item.name,
    logoUrl: item.logoUrl ?? '',
    price: parseFloat(item.price ?? '0'),
    priceChange24h: parseFloat(item.priceChange24hPercent ?? '0'),
    marketCap: parseFloat(item.marketCap ?? '0'),
    volume24h: parseFloat(item.volume24h ?? '0'),
  };
}

export { EMPTY_DISPLAY_TOKENS, getTokenKey, mapMarketTokenToDisplay };
