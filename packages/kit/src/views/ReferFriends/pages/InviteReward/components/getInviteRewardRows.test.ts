import {
  getInviteRewardRows,
  getInviteRewardScopeItems,
} from './getInviteRewardRows';

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

  it('maps server scope copy onto the matching product', () => {
    const rows = getInviteRewardRows({}, undefined, [
      { subject: 'Swap', description: '  Swap providers  ' },
      { subject: 'Unknown', description: 'ignored' },
      { subject: 'Onchain', description: '  first defi  ' },
      { subject: 'Earn', description: 'second defi' },
      { subject: 'Perp', description: '   ' },
      { subject: 'HardwareSales', description: 'Hardware stores' },
    ]);
    const scopeOf = (subject: IInviteRewardRow['subject']) =>
      rows.find((row) => row.subject === subject)?.scopeDescription;

    expect(scopeOf('swap')).toBe('Swap providers');
    // Earn and Onchain both mean DeFi; the first non-empty copy wins.
    expect(scopeOf('defi')).toBe('first defi');
    expect(scopeOf('hardware')).toBe('Hardware stores');
    expect(scopeOf('perps')).toBeNull();

    const blankThenEarn = getInviteRewardRows({}, undefined, [
      { subject: 'Onchain', description: ' ' },
      { subject: 'Earn', description: 'DeFi venues' },
    ]);
    expect(
      blankThenEarn.find((row) => row.subject === 'defi')?.scopeDescription,
    ).toBe('DeFi venues');
  });

  it('leaves scope empty when the server omits it', () => {
    expect(
      getInviteRewardRows(undefined).every(
        (row) => row.scopeDescription === null,
      ),
    ).toBe(true);
    expect(
      getInviteRewardRows({ Perp: { available: [] } }).every(
        (row) => row.scopeDescription === null,
      ),
    ).toBe(true);
    expect(getInviteRewardScopeItems(getInviteRewardRows(null))).toEqual([]);
  });

  it('lists scope copy only for products still on the breakdown', () => {
    const configs = {
      Swap: { enabled: false },
      Earn: { enabled: false },
      Onchain: { enabled: false },
    };
    const items = getInviteRewardScopeItems(
      getInviteRewardRows({ Onchain: { swap: [reward('3')] } }, configs, [
        { subject: 'Swap', description: 'Swap providers' },
        { subject: 'Earn', description: 'DeFi venues' },
        { subject: 'HardwareSales', description: 'Hardware stores' },
      ]),
    );

    // Swap is off but has earnings, so its scope stays. DeFi is off and empty.
    expect(items).toEqual([
      { subject: 'swap', description: 'Swap providers' },
      { subject: 'hardware', description: 'Hardware stores' },
    ]);
  });
});
