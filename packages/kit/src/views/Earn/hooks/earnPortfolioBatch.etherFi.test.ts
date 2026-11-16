import {
  buildEarnPortfolioBatchGroups,
  createEarnPortfolioRequestKey,
  deduplicateEtherFiPortfolioPairs,
  matchEarnPortfolioBatchRequest,
} from './earnPortfolioBatch';

const base = {
  accountId: 'account-1',
  accountAddress: '0xaccount',
  networkId: 'evm--1',
  provider: 'EtherFi',
  symbol: 'ETH',
  vault: '0xf0bb20865277abd641a307ece5ee04e79073416c',
};

describe('EtherFi portfolio identity', () => {
  it('groups input assets of one vault and keeps different vaults separate', () => {
    const weth = { ...base, provider: 'etherfi', symbol: 'WETH' };
    const usd = {
      ...base,
      symbol: 'USDC',
      vault: '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c',
    };
    expect(createEarnPortfolioRequestKey(base)).toBe(
      createEarnPortfolioRequestKey(weth),
    );
    expect(createEarnPortfolioRequestKey(base)).not.toBe(
      createEarnPortfolioRequestKey(usd),
    );
    const { batchGroups } = buildEarnPortfolioBatchGroups({
      requests: [base, weth, usd],
    });
    expect(batchGroups).toHaveLength(1);
    expect(batchGroups[0].requestsByKey.size).toBe(2);
    expect(
      matchEarnPortfolioBatchRequest({
        group: batchGroups[0],
        symbol: 'liquidETH',
        vault: base.vault,
      })?.vault,
    ).toBe(base.vault);
    expect(
      matchEarnPortfolioBatchRequest({
        group: batchGroups[0],
        symbol: 'liquidETH',
        vault: '0x0000000000000000000000000000000000000001',
      }),
    ).toBeUndefined();
  });

  it('does not combine missing-vault symbols or other providers', () => {
    expect(
      createEarnPortfolioRequestKey({ ...base, vault: undefined }),
    ).not.toBe(
      createEarnPortfolioRequestKey({
        ...base,
        symbol: 'WETH',
        vault: undefined,
      }),
    );
    expect(
      createEarnPortfolioRequestKey({ ...base, provider: 'Native' }),
    ).not.toBe(
      createEarnPortfolioRequestKey({
        ...base,
        provider: 'Native',
        symbol: 'WETH',
      }),
    );
  });

  it('deduplicates across single and batch requests without merging accounts', () => {
    const pairs = [
      { isAirdrop: false, enableBatch: false, params: base },
      {
        isAirdrop: false,
        enableBatch: true,
        params: { ...base, symbol: 'WETH' },
      },
      {
        isAirdrop: false,
        enableBatch: true,
        params: { ...base, accountAddress: '0xother' },
      },
      { isAirdrop: true, enableBatch: false, params: base },
    ];
    expect(deduplicateEtherFiPortfolioPairs(pairs)).toEqual([
      pairs[0],
      pairs[2],
      pairs[3],
    ]);
  });
});
