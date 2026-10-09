import { getInviteRewardRows } from './getInviteRewardRows';

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

describe('getInviteRewardRows', () => {
  it('folds every subject when summary is missing or zero', () => {
    expect(getInviteRewardRows(undefined).visibleRows).toEqual([]);
    expect(
      getInviteRewardRows(null).foldedRows.map((row) => row.subject),
    ).toEqual(['hardware', 'perps', 'swap', 'defi']);

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
    expect(zero.visibleRows).toEqual([]);
    expect(zero.foldedRows).toHaveLength(4);
  });

  it('keeps hardware visible when sales, available, or pending has data', () => {
    const salesOnly = getInviteRewardRows({
      HardwareSales: { monthlySalesFiatValue: '891.00' },
    });
    expect(salesOnly.visibleRows.map((row) => row.subject)).toEqual([
      'hardware',
    ]);
    expect(salesOnly.visibleRows[0]?.monthlySalesFiatValue).toBe('891.00');
    expect(salesOnly.foldedRows.map((row) => row.subject)).toEqual([
      'perps',
      'swap',
      'defi',
    ]);

    const pendingOnly = getInviteRewardRows({
      HardwareSales: { pending: [reward('203.04')] },
    });
    expect(pendingOnly.visibleRows[0]?.pending?.hasReward).toBe(true);

    const availableOnly = getInviteRewardRows({
      HardwareSales: { monthlySales: '2', available: [reward('239.40')] },
    });
    expect(availableOnly.visibleRows[0]?.available.hasReward).toBe(true);
  });

  it('shows only the subjects that have a balance and keeps canonical order', () => {
    const rows = getInviteRewardRows({
      Perp: { available: [reward('1.5')] },
      Onchain: {
        swap: [reward('0')],
        available: [reward('4', '9.25')],
      },
    });

    expect(rows.visibleRows.map((row) => row.subject)).toEqual([
      'perps',
      'defi',
    ]);
    expect(rows.foldedRows.map((row) => row.subject)).toEqual([
      'hardware',
      'swap',
    ]);
    expect(rows.visibleRows[1]?.available.hasReward).toBe(true);
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
    const swap = rows.visibleRows.find((row) => row.subject === 'swap');
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
    const { visibleRows, foldedRows } = getInviteRewardRows(
      { Onchain: { swap: [reward('3')] } },
      configs,
    );

    // Swap is off but has earnings, so it stays; DeFi is off and empty.
    expect(visibleRows.map((row) => row.subject)).toEqual(['swap']);
    expect(foldedRows.map((row) => row.subject)).toEqual(['hardware', 'perps']);
  });
});
