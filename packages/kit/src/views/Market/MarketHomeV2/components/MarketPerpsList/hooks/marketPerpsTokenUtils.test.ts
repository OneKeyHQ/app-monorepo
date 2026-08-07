import type { IMarketPerpsTokenFromServer } from '@onekeyhq/shared/types/marketV2';

import { mapServerToken } from './marketPerpsTokenUtils';

function buildServerToken(name: string): IMarketPerpsTokenFromServer {
  return {
    name,
    displayName: 'UNITREE',
    maxLeverage: 10,
    tokenImageUrl: 'https://example.com/unitree.png',
    markPrice: '90.38',
    prevDayPrice: '72.58',
    change24hPercent: 24.52,
    volume24h: '10940000',
    openInterest: '6660000',
    fundingRate: '0.000008',
  };
}

describe('mapServerToken', () => {
  it.each([
    ['xyz:UNITREE', 'xyz'],
    ['para:UNITREE', 'para'],
  ])('maps the dex prefix from %s for the market badge', (name, dexLabel) => {
    expect(mapServerToken(buildServerToken(name), undefined)).toMatchObject({
      name,
      displayName: 'UNITREE',
      dexLabel,
    });
  });

  it('leaves main-dex tokens without a dex label', () => {
    expect(
      mapServerToken(buildServerToken('BTC'), undefined).dexLabel,
    ).toBeUndefined();
  });
});
