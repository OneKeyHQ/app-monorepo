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
  it('matches EVM vaults with different casing without changing request addresses', () => {
    const requests = [
      buildRequest({
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'sUSDe',
        vault: '0xAbCd000000000000000000000000000000000001',
      }),
      buildRequest({
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'sUSDe',
        vault: '0xAbCd000000000000000000000000000000000002',
      }),
    ];
    const { batchGroups } = buildEarnPortfolioBatchGroups({ requests });

    for (const request of requests.toReversed()) {
      const lowerCaseVault = request.vault?.toLowerCase();
      expect(createEarnPortfolioRequestKey(request)).toBe(
        createEarnPortfolioRequestKey({ ...request, vault: lowerCaseVault }),
      );
      expect(
        matchEarnPortfolioBatchRequest({
          group: batchGroups[0],
          symbol: request.symbol,
          vault: lowerCaseVault,
        }),
      ).toBe(request);
    }
    expect(batchGroups[0].requestsByKey.size).toBe(2);
    expect(requests[0].vault).toBe(
      '0xAbCd000000000000000000000000000000000001',
    );
  });

  it('deduplicates aliases of the same EVM vault', () => {
    const request = buildRequest({
      networkId: 'evm--1',
      vault: '0xAbCd000000000000000000000000000000000001',
    });
    const lowerCaseRequest = {
      ...request,
      vault: request.vault?.toLowerCase(),
    };
    const { batchGroups } = buildEarnPortfolioBatchGroups({
      requests: [request, lowerCaseRequest],
    });

    expect(batchGroups[0].requestsByKey.size).toBe(1);
    expect(batchGroups[0].requestKeysBySymbol.get(request.symbol)?.size).toBe(
      1,
    );
  });

  it.each(['sol--101', 'tron--0x2b6653dc', 'cosmos--cosmoshub-4'])(
    'keeps non-EVM vault casing significant on %s',
    (networkId) => {
      const request = buildRequest({ networkId, vault: 'VaultAbC' });
      const differentCaseRequest = { ...request, vault: 'vaultabc' };
      const { batchGroups } = buildEarnPortfolioBatchGroups({
        requests: [request],
      });

      expect(createEarnPortfolioRequestKey(request)).not.toBe(
        createEarnPortfolioRequestKey(differentCaseRequest),
      );
      expect(
        matchEarnPortfolioBatchRequest({
          group: batchGroups[0],
          symbol: request.symbol,
          vault: differentCaseRequest.vault,
        }),
      ).toBeUndefined();
    },
  );

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

  it('batches same-symbol vaults and matches each result to its own request', () => {
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

    const { batchGroups } = buildEarnPortfolioBatchGroups({
      requests: [requestA, requestB],
    });

    expect(batchGroups).toHaveLength(1);
    expect(Array.from(batchGroups[0].requestsByKey.values())).toEqual([
      requestA,
      requestB,
    ]);
    for (const request of [requestB, requestA]) {
      expect(
        matchEarnPortfolioBatchRequest({
          group: batchGroups[0],
          symbol: request.symbol,
          vault: request.vault,
        }),
      ).toEqual(request);
    }
    for (const vault of [undefined, '', 'unknown-market']) {
      expect(
        matchEarnPortfolioBatchRequest({
          group: batchGroups[0],
          symbol: requestA.symbol,
          vault,
        }),
      ).toBeUndefined();
    }
  });

  it('keeps a large Pendle market list in one batch', () => {
    const requests = Array.from({ length: 120 }, (_, index) =>
      buildRequest({
        provider: 'pendle',
        symbol: 'sUSDe',
        vault: `market-${index}`,
      }),
    );
    const { batchGroups } = buildEarnPortfolioBatchGroups({ requests });
    expect(batchGroups).toHaveLength(1);
    expect(batchGroups[0].requestsByKey.size).toBe(120);
  });

  it.each([
    { provider: 'other-provider' },
    { networkId: 'evm--1' },
    { accountAddress: 'other-account' },
    { publicKey: 'other-public-key' },
  ])('isolates batch request scope: %j', (overrides) => {
    const { batchGroups } = buildEarnPortfolioBatchGroups({
      requests: [buildRequest(), buildRequest(overrides)],
    });
    expect(batchGroups).toHaveLength(2);
  });

  it('rejects another vault even when only one request has that symbol', () => {
    const request = buildRequest({ vault: 'requested-vault' });
    const { batchGroups } = buildEarnPortfolioBatchGroups({
      requests: [request],
    });
    expect(
      matchEarnPortfolioBatchRequest({
        group: batchGroups[0],
        symbol: request.symbol,
        vault: 'another-vault',
      }),
    ).toBeUndefined();
  });

  it.each([false, undefined])(
    'respects disabled batch configuration: %s',
    (enableBatch) => {
      expect(shouldUseEarnPortfolioBatchFetch({ enableBatch })).toBe(false);
    },
  );

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
