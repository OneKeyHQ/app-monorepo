import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

// Helper to convert value: returns number if field exists, undefined if field is missing
function toNumberOrUndefined(
  value: number | string | undefined | null,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return Number(value);
}

export function formatTokenActivityData(
  tokenDetail: IMarketTokenDetail | undefined,
  selectedTimeRange: string,
): {
  buys: number | undefined;
  sells: number | undefined;
  buyVolume: number | undefined;
  sellVolume: number | undefined;
  totalVolume: number | undefined;
} {
  let buys: number | undefined;
  let sells: number | undefined;
  let buyVolume: number | undefined;
  let sellVolume: number | undefined;
  let totalVolume: number | undefined;

  if (tokenDetail) {
    switch (selectedTimeRange) {
      case '4h':
        buys = toNumberOrUndefined(tokenDetail.buy4hCount);
        sells = toNumberOrUndefined(tokenDetail.sell4hCount);
        buyVolume = toNumberOrUndefined(tokenDetail.vBuy4h);
        sellVolume = toNumberOrUndefined(tokenDetail.vSell4h);
        totalVolume =
          toNumberOrUndefined(tokenDetail.volume4h) ??
          (buyVolume !== undefined && sellVolume !== undefined
            ? buyVolume + sellVolume
            : undefined);
        break;
      case '8h':
        buys = toNumberOrUndefined(tokenDetail.buy8hCount);
        sells = toNumberOrUndefined(tokenDetail.sell8hCount);
        buyVolume = toNumberOrUndefined(tokenDetail.vBuy8h);
        sellVolume = toNumberOrUndefined(tokenDetail.vSell8h);
        totalVolume =
          toNumberOrUndefined(tokenDetail.volume8h) ??
          (buyVolume !== undefined && sellVolume !== undefined
            ? buyVolume + sellVolume
            : undefined);
        break;
      case '24h':
        buys = toNumberOrUndefined(tokenDetail.buy24hCount);
        sells = toNumberOrUndefined(tokenDetail.sell24hCount);
        buyVolume = toNumberOrUndefined(tokenDetail.vBuy24h);
        sellVolume = toNumberOrUndefined(tokenDetail.vSell24h);
        totalVolume =
          toNumberOrUndefined(tokenDetail.volume24h) ??
          (buyVolume !== undefined && sellVolume !== undefined
            ? buyVolume + sellVolume
            : undefined);
        break;
      case '1h':
      default:
        buys = toNumberOrUndefined(tokenDetail.buy1hCount);
        sells = toNumberOrUndefined(tokenDetail.sell1hCount);
        buyVolume = toNumberOrUndefined(tokenDetail.vBuy1h);
        sellVolume = toNumberOrUndefined(tokenDetail.vSell1h);
        totalVolume =
          toNumberOrUndefined(tokenDetail.volume1h) ??
          (buyVolume !== undefined && sellVolume !== undefined
            ? buyVolume + sellVolume
            : undefined);
        break;
    }
  }
  return { buys, sells, buyVolume, sellVolume, totalVolume };
}
