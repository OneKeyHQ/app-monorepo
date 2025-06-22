import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

export function formatTokenActivityData(
  tokenDetail: IMarketTokenDetail | undefined,
  selectedTimeRange: string,
): {
  buys: number;
  sells: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
} {
  let buys = 0;
  let sells = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let totalVolume = 0;

  if (tokenDetail) {
    switch (selectedTimeRange) {
      case '4h':
        buys = Number(tokenDetail.buy4hCount) || 0;
        sells = Number(tokenDetail.sell4hCount) || 0;
        buyVolume = Number(tokenDetail.vBuy4h) || 0;
        sellVolume = Number(tokenDetail.vSell4h) || 0;
        totalVolume = Number(tokenDetail.volume4h) || buyVolume + sellVolume;
        break;
      case '8h':
        buys = Number(tokenDetail.buy8hCount) || 0;
        sells = Number(tokenDetail.sell8hCount) || 0;
        buyVolume = Number(tokenDetail.vBuy8h) || 0;
        sellVolume = Number(tokenDetail.vSell8h) || 0;
        totalVolume = Number(tokenDetail.volume8h) || buyVolume + sellVolume;
        break;
      case '24h':
        buys = Number(tokenDetail.buy24hCount) || 0;
        sells = Number(tokenDetail.sell24hCount) || 0;
        buyVolume = Number(tokenDetail.vBuy24h) || 0;
        sellVolume = Number(tokenDetail.vSell24h) || 0;
        totalVolume = Number(tokenDetail.volume24h) || buyVolume + sellVolume;
        break;
      case '1h':
      default:
        buys = Number(tokenDetail.buy1hCount) || 0;
        sells = Number(tokenDetail.sell1hCount) || 0;
        buyVolume = Number(tokenDetail.vBuy1h) || 0;
        sellVolume = Number(tokenDetail.vSell1h) || 0;
        totalVolume = Number(tokenDetail.volume1h) || buyVolume + sellVolume;
        break;
    }
  }
  return { buys, sells, buyVolume, sellVolume, totalVolume };
}
