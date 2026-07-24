import { getPerpsL2BookSnapshotCacheKeys, swrKeys } from './swrCacheUtils';

describe('SWR cache keys', () => {
  it('uses a stable key for cached order book tick options', () => {
    expect(swrKeys.perpsOrderBookTickOptions()).toBe('perpsOrderBookTicks:v1');
  });

  it('uses stable keys for cached market bootstrap requests', () => {
    expect(
      swrKeys.marketHomeTokenList({
        networkId: '',
        sortBy: 'v24hUSD',
        sortType: 'desc',
        pageSize: 20,
        minLiquidity: 5000,
        type: 'trending',
        timeFrame: '2',
      }),
    ).toBe('marketHomeTokenList:v1::v24hUSD:desc:20:5000:trending:2');
    expect(
      swrKeys.marketHomeTokenList({
        networkId: '',
        sortBy: 'v24hUSD',
        sortType: 'desc',
        pageSize: 20,
        minLiquidity: 5000,
        type: 'stocks',
        category: 'tech',
        timeFrame: '2',
      }),
    ).toBe('marketHomeTokenList:v1::v24hUSD:desc:20:5000:stocks:2:tech');
    expect(
      swrKeys.swapStockTokenDetail({
        tokenScope: 'evm--1:0xstock',
      }),
    ).toBe('swapStockTokenDetail:v1:evm--1:0xstock');
    expect(swrKeys.swapHistoryPreviewList()).toBe('swapHistoryPreviewList');
    expect(
      swrKeys.swapStockChart({
        networkId: 'evm--1',
        tokenAddress: '0xstock',
        range: '1W',
        requestCurrency: 'usd',
      }),
    ).toBe('swapStockChart:v1:evm--1:0xstock:token:1W:usd');
    expect(
      swrKeys.swapStockSpeedConfig({
        networkId: 'evm--1',
      }),
    ).toBe('swapStockSpeedConfig:v1:evm--1');
    expect(
      swrKeys.swapStockPayTokenDetails({
        scope: '1:usdc|usdt:idx:acc',
      }),
    ).toBe('swapStockPayTokenDetails:v1:1:usdc|usdt:idx:acc');
  });

  it('scopes specified token balances by owner, network, and token set', () => {
    expect(
      swrKeys.specifiedTokenSelectorView({
        accountId: 'account-1',
        networkId: 'evm--1',
        indexedAccountId: 'wallet-1--1',
        targetsKey: 'evm--1:0xusdc:usdc',
      }),
    ).toBe(
      'specifiedTokenSelectorView:v1:account-1:evm--1:wallet-1--1:evm--1:0xusdc:usdc',
    );
  });

  it('uses the default and latest keys when no tick option is requested', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
      }),
      swrKeys.perpsL2BookSnapshotLatest({
        coin: 'BTC',
      }),
    ]);
  });

  it('falls back option-specific snapshots only to the coin latest key', () => {
    expect(
      getPerpsL2BookSnapshotCacheKeys({
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: 2,
      }),
    ).toEqual([
      swrKeys.perpsL2BookSnapshot({
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: 2,
      }),
      swrKeys.perpsL2BookSnapshotLatest({
        coin: 'BTC',
      }),
    ]);
  });
});
