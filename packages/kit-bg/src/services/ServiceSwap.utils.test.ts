import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { normalizeSwapTokenListCurrency } from './ServiceSwap.utils';

const baseToken = {
  networkId: 'evm--56',
  contractAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  symbol: 'USDC',
  decimals: 18,
} as ISwapToken;

describe('normalizeSwapTokenListCurrency', () => {
  it('tags priced token list items with the request currency basis', () => {
    expect(
      normalizeSwapTokenListCurrency({
        tokens: [
          {
            ...baseToken,
            price: '6.75',
            fiatValue: '6.75',
          },
        ],
        currency: 'cny',
      }),
    ).toEqual([
      {
        ...baseToken,
        price: '6.75',
        fiatValue: '6.75',
        currency: 'cny',
      },
    ]);
  });

  it('leaves metadata-only tokens untagged', () => {
    const result = normalizeSwapTokenListCurrency({
      tokens: [baseToken],
      currency: 'cny',
    });

    expect(result[0]).toBe(baseToken);
  });
});
