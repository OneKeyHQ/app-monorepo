import type {
  IMarketTokenDetail,
  IMarketTokenHolder,
} from '@onekeyhq/shared/types/marketV2';

import { buildMarketHolderPercentages } from './useMarketHolders.utils';

const holders: IMarketTokenHolder[] = [
  {
    accountAddress: '0xholder',
    amount: '10',
    fiatValue: '20',
  },
];

describe('buildMarketHolderPercentages', () => {
  it('derives holder percentages without coupling the network request to token detail updates', () => {
    expect(
      buildMarketHolderPercentages({
        holders,
        tokenDetail: {
          fdv: '2000',
          price: '2',
        } as IMarketTokenDetail,
      }),
    ).toEqual([
      expect.objectContaining({
        percentage: '1.00',
      }),
    ]);
  });

  it('preserves holder data until a valid token price is available', () => {
    expect(
      buildMarketHolderPercentages({
        holders,
        tokenDetail: undefined,
      }),
    ).toBe(holders);
  });
});
