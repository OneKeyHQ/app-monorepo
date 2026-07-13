import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { formatTokenActivityData } from './formatTokenActivityData';

function buildTokenDetail(
  overrides: Partial<IMarketTokenDetail> = {},
): IMarketTokenDetail {
  return {
    address: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT',
    decimals: 9,
    logoUrl: '',
    name: 'Notcoin',
    symbol: 'NOT',
    ...overrides,
  };
}

describe('formatTokenActivityData', () => {
  it('treats backend placeholder values as missing data', () => {
    const volume1h = '1662.14437643546';

    expect(
      formatTokenActivityData(
        buildTokenDetail({
          buy1hCount: '24',
          sell1hCount: '17',
          vBuy1h: '-',
          vSell1h: '-',
          volume1h,
        }),
        '1h',
      ),
    ).toEqual({
      buys: 24,
      sells: 17,
      buyVolume: undefined,
      sellVolume: undefined,
      totalVolume: Number(volume1h),
    });
  });

  it('falls back to buy and sell volume sum when total volume is unavailable', () => {
    expect(
      formatTokenActivityData(
        buildTokenDetail({
          buy24hCount: '-',
          sell24hCount: '856',
          vBuy24h: '120',
          vSell24h: '80',
          volume24h: '-',
        }),
        '24h',
      ),
    ).toEqual({
      buys: undefined,
      sells: 856,
      buyVolume: 120,
      sellVolume: 80,
      totalVolume: 200,
    });
  });
});
