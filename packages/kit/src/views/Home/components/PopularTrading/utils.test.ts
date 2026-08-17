import type {
  IMarketPerpsTokenFromServer,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

import {
  getMarketTokenDisplayPrice,
  getMarketTokenDisplayPriceChange24h,
  getMarketTokenDisplayVolume24h,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
} from './utils';

function buildServerPerpsToken(name: string): IMarketPerpsTokenFromServer {
  return {
    name,
    displayName: 'UNITREE',
    maxLeverage: 10,
    tokenImageUrl: 'unitree.png',
    markPrice: '90.38',
    prevDayPrice: '72.58',
    change24hPercent: 24.52,
    volume24h: '10940000',
    openInterest: '6660000',
    fundingRate: '0.000008',
  };
}

describe('PopularTrading market token display utils', () => {
  test('normalizes placeholder market values instead of returning NaN', () => {
    const item: IMarketTokenListItem = {
      networkId: 'evm--56',
      address: '0x44f161ae29361e332dea039dfa2f404e0bc5b5cc',
      name: 'Humanity',
      symbol: 'H',
      logoUrls: ['primary.png', 'fallback.png'],
      decimals: 18,
      price: '0.00137840543892581329',
      priceChange24hPercent: '-',
      volume24h: '-',
      communityRecognized: true,
    };

    expect(getMarketTokenDisplayPrice(item)).toBe(
      parseFloat(item.price ?? '0'),
    );
    expect(getMarketTokenDisplayPriceChange24h(item)).toBe(0);
    expect(getMarketTokenDisplayVolume24h(item)).toBe(0);

    const displayToken = mapMarketTokenToDisplay(item);
    expect(displayToken?.priceChange24h).toBe(0);
    expect(Number.isNaN(displayToken?.priceChange24h)).toBe(false);
    expect(displayToken?.logoUrls).toEqual(item.logoUrls);
    expect(displayToken?.communityRecognized).toBe(true);
  });

  test.each([
    ['xyz:UNITREE', 'xyz'],
    ['para:UNITREE', 'para'],
  ])('preserves the %s perps DEX source label', (name, dexLabel) => {
    expect(
      mapMarketPerpsTokenToDisplay({
        token: buildServerPerpsToken(name),
        subtitle: 'Unitree Robotics',
      }),
    ).toMatchObject({
      symbol: 'UNITREE',
      perpsCoin: name,
      perpsSubtitle: 'Unitree Robotics',
      perpsDexLabel: dexLabel,
    });
  });

  test('does not add a DEX source label to main DEX perps', () => {
    expect(
      mapMarketPerpsTokenToDisplay({
        token: buildServerPerpsToken('BTC'),
      }).perpsDexLabel,
    ).toBeUndefined();
  });
});
