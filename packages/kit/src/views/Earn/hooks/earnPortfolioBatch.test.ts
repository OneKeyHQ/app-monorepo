import {
  type IEarnPortfolioBatchTaskGroup,
  type IPortfolioFetchRequest,
  buildEarnPortfolioBatchGroups,
  createEarnPortfolioRequestKey,
  matchEarnPortfolioBatchRequest,
  shouldUseEarnPortfolioBatchFetch,
} from './earnPortfolioBatch';

const buildRequest = (
  overrides: Partial<IPortfolioFetchRequest> = {},
): IPortfolioFetchRequest => ({
  accountId: 'account-id',
  accountAddress: 'account-address',
  networkId: 'sol--101',
  provider: 'kamino',
  symbol: 'USDC',
  ...overrides,
});

describe('earnPortfolioBatch', () => {
  it('disables batch fetch for ptAddress-backed requests', () => {
    expect(
      shouldUseEarnPortfolioBatchFetch({
        enableBatch: true,
        ptAddress: 'pt-address-1',
      }),
    ).toBe(false);
    expect(
      shouldUseEarnPortfolioBatchFetch({
        enableBatch: true,
      }),
    ).toBe(true);
  });

  it('falls back to single requests when grouped requests share the same symbol', () => {
    const requestA = buildRequest({
      provider: 'pendle',
      symbol: 'sUSDe',
      vault: 'market-1',
    });
    const requestB = buildRequest({
      provider: 'pendle',
      symbol: 'sUSDe',
      vault: 'market-2',
    });

    const { batchGroups, singleRequests } = buildEarnPortfolioBatchGroups({
      requests: [requestA, requestB],
    });

    expect(batchGroups).toHaveLength(0);
    expect(singleRequests).toEqual([requestA, requestB]);
  });

  it('matches a unique request when batch response omits the vault', () => {
    const request = buildRequest({
      vault: 'vault-1',
    });

    const group: IEarnPortfolioBatchTaskGroup = {
      provider: 'kamino',
      networkId: 'sol--101',
      accountAddress: 'account-address',
      publicKey: 'public-key',
      requestsByKey: new Map([
        [createEarnPortfolioRequestKey(request), request],
      ]),
      requestKeysBySymbol: new Map([
        [request.symbol, new Set([createEarnPortfolioRequestKey(request)])],
      ]),
    };

    expect(
      matchEarnPortfolioBatchRequest({
        group,
        symbol: 'USDC',
        vault: undefined,
      }),
    ).toEqual(request);
  });
});
