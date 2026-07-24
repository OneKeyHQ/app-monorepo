import {
  EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
  SWAP_BALANCE_DISPLAY_CACHE_MAX_ENTRIES,
  resolveSwapBalanceDisplayAccountKey,
  resolveSwapBalanceDisplayCacheEntry,
  resolveSwapInputDisplayBalance,
  updateSwapBalanceDisplayCache,
} from './swapBalanceDisplayCacheUtils';

const ethToken = {
  networkId: 'evm--1',
  contractAddress: '',
  isNative: true,
};

const usdcToken = {
  networkId: 'evm--1',
  contractAddress: '0xA0B8',
  isNative: false,
};

describe('swapBalanceDisplayCacheUtils', () => {
  it('uses validated cold-start owner context until the live account is ready', () => {
    expect(
      resolveSwapBalanceDisplayAccountKey({
        cachedAccountKey: 'wallet|account|default',
        cachedNetworkId: 'evm--1',
        tokenNetworkId: 'evm--1',
      }),
    ).toBe('wallet|account|default');
    expect(
      resolveSwapBalanceDisplayAccountKey({
        cachedAccountKey: 'wallet|account|default',
        cachedNetworkId: 'evm--56',
        tokenNetworkId: 'evm--1',
      }),
    ).toBeUndefined();
    expect(
      resolveSwapBalanceDisplayAccountKey({
        currentAccountKey: 'wallet|live-account|default',
        cachedAccountKey: 'wallet|cached-account|default',
        cachedNetworkId: 'evm--1',
        tokenNetworkId: 'evm--1',
      }),
    ).toBe('wallet|live-account|default');
  });

  it('restores a checksum-insensitive EVM address balance', () => {
    const cache = updateSwapBalanceDisplayCache({
      accountAddress: '0xAbC',
      accountKey: 'wallet|account|default',
      balance: '1.25',
      cache: EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
      now: 100,
      token: ethToken,
    });

    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountAddress: '0xabc',
        cache,
        token: ethToken,
      })?.balance,
    ).toBe('1.25');
  });

  it('uses the logical account before address resolution and rejects a later mismatch', () => {
    const cache = updateSwapBalanceDisplayCache({
      accountAddress: '0xAccountA',
      accountKey: 'wallet|account|default',
      balance: '0.24',
      cache: EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
      token: usdcToken,
    });

    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountKey: 'wallet|account|default',
        cache,
        token: usdcToken,
      })?.balance,
    ).toBe('0.24');
    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountAddress: '0xAccountB',
        accountKey: 'wallet|account|default',
        cache,
        token: usdcToken,
      }),
    ).toBeUndefined();
  });

  it('treats a missing derive type as the default owner during startup', () => {
    const cache = updateSwapBalanceDisplayCache({
      accountAddress: '0xAccountA',
      accountKey: 'watching|account|default',
      balance: '0.24',
      cache: EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
      token: ethToken,
    });

    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountKey: 'watching|account|',
        cache,
        token: ethToken,
      })?.balance,
    ).toBe('0.24');
    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountKey: 'watching|account|ledger-live',
        cache,
        token: ethToken,
      }),
    ).toBeUndefined();
  });

  it('does not let an unscoped channel balance replace the current token display', () => {
    expect(
      resolveSwapInputDisplayBalance({
        accountAddress: '0xAccountA',
        cachedBalance: '0.24',
        selectedBalance: '0',
        tokenAccountAddress: '0xaccounta',
        tokenBalance: '0.25',
        tokenNetworkId: 'evm--1',
      }),
    ).toBe('0.25');

    expect(
      resolveSwapInputDisplayBalance({
        accountAddress: '0xAccountA',
        cachedBalance: '0.24',
        selectedBalance: '0',
        tokenNetworkId: 'evm--1',
      }),
    ).toBe('0.24');

    expect(
      resolveSwapInputDisplayBalance({
        accountAddress: '0xAccountA',
        selectedBalance: '0',
        tokenNetworkId: 'evm--1',
      }),
    ).toBe('0');
  });

  it('keeps zero balances and isolates token identity', () => {
    const cache = updateSwapBalanceDisplayCache({
      accountAddress: '0xabc',
      balance: '0',
      cache: EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
      token: usdcToken,
    });

    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountAddress: '0xabc',
        cache,
        token: usdcToken,
      })?.balance,
    ).toBe('0');
    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountAddress: '0xabc',
        cache,
        token: ethToken,
      }),
    ).toBeUndefined();
  });

  it('does not cache invalid balances', () => {
    const cache = updateSwapBalanceDisplayCache({
      accountAddress: '0xabc',
      balance: 'not-a-number',
      cache: EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
      token: ethToken,
    });

    expect(cache).toBe(EMPTY_SWAP_BALANCE_DISPLAY_CACHE);
  });

  it('rejects entries from an unsupported cache version', () => {
    const cache = updateSwapBalanceDisplayCache({
      accountAddress: '0xabc',
      balance: '1.25',
      cache: EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
      token: ethToken,
    });

    expect(
      resolveSwapBalanceDisplayCacheEntry({
        accountAddress: '0xabc',
        cache: { ...cache, version: 2 } as unknown as typeof cache,
        token: ethToken,
      }),
    ).toBeUndefined();
  });

  it('caps least-recent entries', () => {
    let cache = EMPTY_SWAP_BALANCE_DISPLAY_CACHE;
    for (
      let index = 0;
      index <= SWAP_BALANCE_DISPLAY_CACHE_MAX_ENTRIES;
      index += 1
    ) {
      cache = updateSwapBalanceDisplayCache({
        accountAddress: `0x${index}`,
        balance: `${index}`,
        cache,
        now: index,
        token: ethToken,
      });
    }

    expect(cache.entries).toHaveLength(SWAP_BALANCE_DISPLAY_CACHE_MAX_ENTRIES);
    expect(cache.entries[0]?.accountAddress).toBe(
      `0x${SWAP_BALANCE_DISPLAY_CACHE_MAX_ENTRIES}`,
    );
    expect(cache.entries.at(-1)?.accountAddress).toBe('0x1');
  });
});
