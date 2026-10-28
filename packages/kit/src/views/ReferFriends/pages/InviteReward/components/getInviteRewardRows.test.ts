import { getInviteRewardRows } from './getInviteRewardRows';

import type { IInviteRewardRow } from './getInviteRewardRows';
import type { IRewardSummaryItem } from './shared/getRewardSummary';

const token = {
  networkId: 'evm--42161',
  address: '0xreward',
  logoURI: 'https://example.com/token.png',
  name: 'USD Coin',
  symbol: 'USDC',
};

function reward(amount: string, fiatValue = amount): IRewardSummaryItem {
  return { amount, fiatValue, token };
}

const subjectsOf = (rows: IInviteRewardRow[], hasData: boolean) =>
  rows.filter((row) => row.hasData === hasData).map((row) => row.subject);

describe('getInviteRewardRows', () => {
  it('lists every subject without data when summary is missing or zero', () => {
    expect(subjectsOf(getInviteRewardRows(undefined), true)).toEqual([]);
    expect(subjectsOf(getInviteRewardRows(null), false)).toEqual([
      'hardware',
      'perps',
      'swap',
      'defi',
    ]);

    const zero = getInviteRewardRows({
      HardwareSales: {
        monthlySales: '0',
        monthlySalesFiatValue: '0.00',
        available: [reward('0', '0')],
        pending: [reward('invalid', '0')],
      },
      Perp: { available: [] },
      Onchain: { swap: [reward('0')], available: undefined },
    });
    expect(subjectsOf(zero, true)).toEqual([]);
    expect(zero).toHaveLength(4);
  });

  it('keeps hardware visible when sales, available, or pending has data', () => {
    const salesOnly = getInviteRewardRows({
      HardwareSales: { monthlySalesFiatValue: '891.00' },
    });
    expect(subjectsOf(salesOnly, true)).toEqual(['hardware']);
    expect(salesOnly[0]?.monthlySalesFiatValue).toBe('891.00');
    expect(subjectsOf(salesOnly, false)).toEqual(['perps', 'swap', 'defi']);

    const pendingOnly = getInviteRewardRows({
      HardwareSales: { pending: [reward('203.04')] },
    });
    expect(pendingOnly[0]?.pending?.hasReward).toBe(true);

    const availableOnly = getInviteRewardRows({
      HardwareSales: { monthlySales: '2', available: [reward('239.40')] },
    });
    expect(availableOnly[0]?.available.hasReward).toBe(true);
  });

  it('lists subjects with a balance first, each group in canonical order', () => {
    const rows = getInviteRewardRows({
      Perp: { available: [reward('1.5')] },
      Onchain: {
        swap: [reward('0')],
        available: [reward('4', '9.25')],
      },
    });

    expect(rows.map((row) => row.subject)).toEqual([
      'perps',
      'defi',
      'hardware',
      'swap',
    ]);
    expect(subjectsOf(rows, true)).toEqual(['perps', 'defi']);
    expect(rows[1]?.available.hasReward).toBe(true);
  });

  it('sums fiat across tokens in one subject', () => {
    const otherToken = { ...token, address: '0xother' };
    const rows = getInviteRewardRows({
      Onchain: {
        swap: [
          reward('10', '10'),
          { amount: '2', fiatValue: '4', token: otherToken },
        ],
      },
    });
    const swap = rows.find((row) => row.subject === 'swap');
    expect(swap?.available).toMatchObject({
      fiatValue: '14',
      hasReward: true,
    });
  });

  it('drops a product the backend turns off unless it still holds earnings', () => {
    const configs = {
      Swap: { enabled: false },
      Earn: { enabled: false },
      Onchain: { enabled: false },
    };
    const rows = getInviteRewardRows(
      { Onchain: { swap: [reward('3')] } },
      configs,
    );

    // Swap is off but has earnings, so it stays; DeFi is off and empty.
    expect(subjectsOf(rows, true)).toEqual(['swap']);
    expect(subjectsOf(rows, false)).toEqual(['hardware', 'perps']);
  });
});
