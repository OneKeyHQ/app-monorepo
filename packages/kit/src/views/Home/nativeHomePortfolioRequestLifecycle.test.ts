import {
  advanceNativeHomePortfolioOwner,
  buildNativeHomePortfolioScopeKey,
  createNativeHomeSingleFlightRunner,
  isNativeHomePortfolioRequestCurrent,
  shouldShowNativeHomeMissingAccount,
} from './nativeHomePortfolioRequestLifecycle';

describe('Native Home portfolio request lifecycle', () => {
  it('advances a monotonic owner epoch when the render scope changes', () => {
    const allScope = buildNativeHomePortfolioScopeKey({
      accountId: 'account-all',
      enabled: true,
      isAllNetworks: true,
      networkId: 'all--0',
      walletId: 'wallet-1',
    });
    const bitcoinScope = buildNativeHomePortfolioScopeKey({
      accountId: 'account-btc',
      enabled: true,
      isAllNetworks: false,
      networkId: 'btc--0',
      walletId: 'wallet-1',
    });
    const initial = { epoch: 0, scopeKey: '' };
    const allA = advanceNativeHomePortfolioOwner(initial, allScope);
    const sameAllA = advanceNativeHomePortfolioOwner(allA, allScope);
    const bitcoin = advanceNativeHomePortfolioOwner(allA, bitcoinScope);
    const allB = advanceNativeHomePortfolioOwner(bitcoin, allScope);

    expect(sameAllA).toBe(allA);
    expect([allA.epoch, bitcoin.epoch, allB.epoch]).toEqual([1, 2, 3]);
    expect(
      isNativeHomePortfolioRequestCurrent({
        currentGeneration: 0,
        currentOwner: bitcoin,
        request: { ...allA, generation: 99 },
      }),
    ).toBe(false);
    expect(
      isNativeHomePortfolioRequestCurrent({
        currentGeneration: 8,
        currentOwner: allB,
        request: { ...allB, generation: 7 },
      }),
    ).toBe(false);
    expect(
      isNativeHomePortfolioRequestCurrent({
        currentGeneration: 8,
        currentOwner: allB,
        request: { ...allB, generation: 8 },
      }),
    ).toBe(true);
  });

  it('coalesces repeated same-owner events without concurrent requests', async () => {
    let currentOwner = { epoch: 1, scopeKey: 'single' };
    const runner = createNativeHomeSingleFlightRunner({
      isOwnerCurrent: (owner) => owner === currentOwner,
    });
    const resolvers: Array<() => void> = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    let started = 0;
    const task = () =>
      new Promise<void>((resolve) => {
        started += 1;
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        resolvers.push(() => {
          concurrent -= 1;
          resolve();
        });
      });

    const first = runner.run(currentOwner, task);
    const event = runner.run(currentOwner, task);
    const poll = runner.run(currentOwner, task);
    expect(event).toBe(first);
    expect(poll).toBe(first);
    expect(started).toBe(1);

    resolvers.shift()?.();
    await Promise.resolve();
    expect(started).toBe(2);
    expect(maxConcurrent).toBe(1);
    resolvers.shift()?.();
    await first;

    currentOwner = { epoch: 2, scopeKey: 'other-single' };
    await runner.run(currentOwner, async () => undefined);
  });

  it('does not run a queued refresh after its owner becomes stale', async () => {
    let currentOwner = { epoch: 1, scopeKey: 'single-a' };
    const runner = createNativeHomeSingleFlightRunner({
      isOwnerCurrent: (owner) => owner === currentOwner,
    });
    let resolveRequest: () => void = () => undefined;
    const request = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const task = jest.fn(() => request);

    const run = runner.run(currentOwner, task);
    void runner.run(currentOwner, task);
    currentOwner = { epoch: 2, scopeKey: 'single-b' };
    resolveRequest();
    await run;

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('keeps a 16-second request single-flight and runs one coalesced refresh', async () => {
    jest.useFakeTimers();
    try {
      const owner = { epoch: 1, scopeKey: 'slow-single' };
      const runner = createNativeHomeSingleFlightRunner({
        isOwnerCurrent: (expected) => expected === owner,
      });
      let concurrent = 0;
      let maxConcurrent = 0;
      let started = 0;
      const task = async () => {
        started += 1;
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 16_000);
        });
        concurrent -= 1;
      };

      const run = runner.run(owner, task);
      await jest.advanceTimersByTimeAsync(15_000);
      void runner.run(owner, task);
      expect(started).toBe(1);
      expect(concurrent).toBe(1);

      await jest.advanceTimersByTimeAsync(1000);
      expect(started).toBe(2);
      expect(maxConcurrent).toBe(1);
      await jest.advanceTimersByTimeAsync(16_000);
      await run;
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the no-address terminal only for a ready single-network owner', () => {
    const base = {
      accountId: undefined,
      isAllNetworks: false,
      networkId: 'ton--mainnet',
      ready: true,
      walletId: 'wallet-1',
    };
    expect(shouldShowNativeHomeMissingAccount(base)).toBe(true);
    expect(
      shouldShowNativeHomeMissingAccount({ ...base, accountId: 'account-1' }),
    ).toBe(false);
    expect(
      shouldShowNativeHomeMissingAccount({ ...base, isAllNetworks: true }),
    ).toBe(false);
    expect(shouldShowNativeHomeMissingAccount({ ...base, ready: false })).toBe(
      false,
    );
  });
});
