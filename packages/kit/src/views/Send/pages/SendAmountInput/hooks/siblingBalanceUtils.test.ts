import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import { resolveSiblingBalanceParsed } from './siblingBalanceUtils';

function makeDetail({
  balance,
  balanceParsed,
  decimals,
}: {
  balance: string;
  balanceParsed?: string | null;
  decimals: number;
}): IFetchTokenDetailItem {
  return {
    info: { decimals } as IFetchTokenDetailItem['info'],
    balance,
    balanceParsed: balanceParsed as unknown as string,
  } as IFetchTokenDetailItem;
}

describe('resolveSiblingBalanceParsed', () => {
  it('uses balanceParsed when present', () => {
    expect(
      resolveSiblingBalanceParsed(
        makeDetail({
          balance: '12345678',
          balanceParsed: '0.12345678',
          decimals: 8,
        }),
      ),
    ).toBe('0.12345678');
  });

  it('keeps an explicit "0" balanceParsed instead of recomputing', () => {
    expect(
      resolveSiblingBalanceParsed(
        makeDetail({ balance: '500', balanceParsed: '0', decimals: 8 }),
      ),
    ).toBe('0');
  });

  // Regression: server returned `balance` but left `balanceParsed` nil. The
  // sibling must not be recorded as 0 (which would get it filtered out of
  // pickBestSibling and misreport "no usable address format").
  it('back-fills from balance + decimals when balanceParsed is undefined', () => {
    expect(
      resolveSiblingBalanceParsed(
        makeDetail({
          balance: '12345678',
          balanceParsed: undefined,
          decimals: 8,
        }),
      ),
    ).toBe('0.12345678');
  });

  it('back-fills from balance + decimals when balanceParsed is null', () => {
    expect(
      resolveSiblingBalanceParsed(
        makeDetail({ balance: '100000000', balanceParsed: null, decimals: 8 }),
      ),
    ).toBe('1');
  });
});
