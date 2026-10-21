import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ICachedAccountTokens,
  ITokenData,
} from '@onekeyhq/shared/types/token';

import { AccountTokensSnapshotCache } from './accountTokensSnapshotCache';

function snapshot(accountId = 'account', count = 1): ICachedAccountTokens {
  const data: ITokenData['data'] = Array.from(
    { length: count },
    (_, index) => ({
      $key: `token-${index}`,
      address: `0x${index}`,
      name: 'Token',
      symbol: 'TOKEN',
      decimals: 18,
      isNative: false,
    }),
  );
  return {
    accountId,
    networkId: 'evm--1',
    accountAddress: '0xaccount',
    xpub: 'xpub',
    source: 'home-token-list',
    coverage: 'partial',
    tokens: {
      data,
      keys: data.map((token) => token.$key).join(','),
      currency: 'usd',
      map: Object.fromEntries(
        data.map((token) => [
          token.$key,
          {
            balance: '1',
            balanceParsed: '1',
            fiatValue: '1',
            price: 1,
          },
        ]),
      ),
    },
    smallBalanceTokens: { data: [], keys: '', map: {}, currency: 'usd' },
    riskTokens: { data: [], keys: '', map: {}, currency: 'usd' },
  };
}

function put(cache: AccountTokensSnapshotCache, data: ICachedAccountTokens) {
  const request = cache.begin(data);
  cache.set(request, data);
  cache.finish(request);
}

describe('AccountTokensSnapshotCache', () => {
  it('copies writes and reads across the desktop single heap and drops redundant fields', () => {
    const cache = new AccountTokensSnapshotCache();
    const input = snapshot();
    const extra = { ...input, allTokens: input.tokens };
    put(cache, extra);
    input.tokens.data[0].symbol = 'MUTATED';
    input.tokens.map['token-0'].balanceParsed = '100';
    const first = cache.get(input);
    expect(first?.tokens.data[0].symbol).toBe('TOKEN');
    expect(first?.tokens.map['token-0'].balanceParsed).toBe('1');
    expect(first).not.toHaveProperty('allTokens');
    if (!first) throw new OneKeyLocalError('Missing fixture cache');
    first.tokens.data[0].symbol = 'MUTATED_AGAIN';
    first.tokens.map['token-0'].fiatValue = '100';
    expect(cache.get(input)?.tokens.map['token-0'].fiatValue).toBe('1');
    expect(cache.get(input)?.tokens.data[0].symbol).toBe('TOKEN');
  });

  it('isolates account, network, address, and xpub identity', () => {
    const cache = new AccountTokensSnapshotCache();
    const input = snapshot();
    put(cache, input);
    for (const mismatch of [
      { accountId: 'other' },
      { networkId: 'evm--10' },
      { accountAddress: 'other' },
      { xpub: 'other' },
    ])
      expect(cache.get({ ...input, ...mismatch })).toBeUndefined();
    expect(
      cache.get({ accountId: input.accountId, networkId: input.networkId }),
    ).toBeDefined();
  });

  it('keeps newer responses when an older request resolves last', () => {
    const cache = new AccountTokensSnapshotCache();
    const input = snapshot();
    const older = cache.begin(input);
    const newer = cache.begin(input);
    cache.set(newer, { ...input, source: 'dust-sweep' });
    cache.finish(newer);
    cache.set(older, input);
    cache.finish(older);
    expect(cache.get(input)?.source).toBe('dust-sweep');
  });

  it('invalidates manual refresh immediately and rejects pre-refresh work even if refresh fails', () => {
    const cache = new AccountTokensSnapshotCache();
    const input = snapshot();
    put(cache, input);
    const older = cache.begin(input);
    const refresh = cache.begin(input, true);
    expect(cache.get(input)).toBeUndefined();
    cache.finish(refresh);
    cache.set(older, input);
    cache.finish(older);
    expect(cache.get(input)).toBeUndefined();
    put(cache, input);
    expect(cache.get(input)).toBeDefined();
  });

  it('retains a previous snapshot on an ordinary refresh failure', () => {
    const cache = new AccountTokensSnapshotCache();
    const input = snapshot();
    put(cache, input);
    const refresh = cache.begin(input);
    cache.finish(refresh);
    expect(cache.get(input)?.coverage).toBe('partial');
  });

  it('does not resurrect cleared snapshots from in-flight requests', () => {
    const cache = new AccountTokensSnapshotCache();
    const input = snapshot();
    const request = cache.begin(input);
    cache.clear();
    cache.set(request, input);
    cache.finish(request);
    expect(cache.get(input)).toBeUndefined();
    put(cache, input);
    expect(cache.get(input)).toBeDefined();
  });

  it('expires by capture time, not by repeated reads', () => {
    let now = 100;
    const cache = new AccountTokensSnapshotCache({
      maxEntries: 2,
      maxTokens: 3,
      ttlMs: 100,
      now: () => now,
    });
    const input = snapshot();
    put(cache, input);
    expect(cache.get(input)?.capturedAt).toBe(100);
    now = 199;
    expect(cache.get(input)).toBeDefined();
    now = 200;
    expect(cache.get(input)).toBeUndefined();
  });

  it('evicts least recently read accounts by both entry and token budgets', () => {
    const cache = new AccountTokensSnapshotCache({
      maxEntries: 2,
      maxTokens: 3,
      ttlMs: 100,
      now: () => 1,
    });
    put(cache, snapshot('A'));
    put(cache, snapshot('B'));
    cache.get(snapshot('A'));
    put(cache, snapshot('C'));
    expect(cache.get(snapshot('B'))).toBeUndefined();
    put(cache, snapshot('D', 3));
    expect(cache.get(snapshot('A'))).toBeUndefined();
    expect(cache.get(snapshot('C'))).toBeUndefined();
    expect(cache.get(snapshot('D'))?.tokens.data).toHaveLength(3);
    put(cache, snapshot('oversize', 4));
    expect(cache.get(snapshot('oversize'))).toBeUndefined();
    expect(cache.get(snapshot('D'))).toBeDefined();
  });
});
