import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  runStockPayTokenDetailsRequest,
  shouldRefreshStockPayTokensForHistoryEvent,
  shouldSyncStockPayTokenDetail,
} from './swapStockPayTokenUtils';

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock',
  symbol: 'STRCon',
  decimals: 18,
  isStock: true,
};

describe('swapStockPayTokenUtils', () => {
  it('reuses an in-flight pay-token detail request for the same scope', async () => {
    let resolveRequest: ((value: string) => void) | undefined;
    const request = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const firstRequest = runStockPayTokenDetailsRequest({
      request,
      scope: 'account-1:usdc|usdt',
    });
    const duplicateRequest = runStockPayTokenDetailsRequest({
      request,
      scope: 'account-1:usdc|usdt',
    });

    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest?.('loaded');
    await expect(
      Promise.all([firstRequest, duplicateRequest]),
    ).resolves.toEqual(['loaded', 'loaded']);
  });

  it('reuses a settled pay-token detail request inside the deduping interval', async () => {
    const request = jest.fn(async () => 'loaded');

    await runStockPayTokenDetailsRequest({
      request,
      scope: 'account-2:usdc|usdt',
    });
    await runStockPayTokenDetailsRequest({
      request,
      scope: 'account-2:usdc|usdt',
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh pay-token detail request outside the deduping interval', async () => {
    const request = jest.fn(async () => 'loaded');

    await runStockPayTokenDetailsRequest({
      dedupingInterval: 0,
      request,
      scope: 'account-3:usdc|usdt',
    });
    await runStockPayTokenDetailsRequest({
      dedupingInterval: 0,
      request,
      scope: 'account-3:usdc|usdt',
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps a slow in-flight request deduped after the settled-result TTL duration', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
    let resolveRequest: ((value: string) => void) | undefined;
    const request = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    try {
      const firstRequest = runStockPayTokenDetailsRequest({
        request,
        scope: 'slow-request',
      });
      nowSpy.mockReturnValue(2000);
      const duplicateRequest = runStockPayTokenDetailsRequest({
        request,
        scope: 'slow-request',
      });

      await Promise.resolve();
      expect(request).toHaveBeenCalledTimes(1);
      resolveRequest?.('loaded');
      await expect(
        Promise.all([firstRequest, duplicateRequest]),
      ).resolves.toEqual(['loaded', 'loaded']);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('starts the settled-result TTL when the request resolves', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
    let resolveRequest: ((value: string) => void) | undefined;
    const request = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveRequest = resolve;
          }),
      )
      .mockResolvedValue('fresh');

    try {
      const firstRequest = runStockPayTokenDetailsRequest({
        request,
        scope: 'settled-ttl',
      });
      await Promise.resolve();
      nowSpy.mockReturnValue(5000);
      resolveRequest?.('loaded');
      await expect(firstRequest).resolves.toBe('loaded');

      nowSpy.mockReturnValue(5999);
      await expect(
        runStockPayTokenDetailsRequest({
          request,
          scope: 'settled-ttl',
        }),
      ).resolves.toBe('loaded');
      expect(request).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(6000);
      await expect(
        runStockPayTokenDetailsRequest({
          request,
          scope: 'settled-ttl',
        }),
      ).resolves.toBe('fresh');
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('bypasses a settled result when revalidation is requested', async () => {
    const request = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('before-refresh')
      .mockResolvedValueOnce('after-refresh');

    await expect(
      runStockPayTokenDetailsRequest({
        request,
        scope: 'settled-revalidation',
      }),
    ).resolves.toBe('before-refresh');
    await expect(
      runStockPayTokenDetailsRequest({
        mode: 'revalidate',
        request,
        scope: 'settled-revalidation',
      }),
    ).resolves.toBe('after-refresh');

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('coalesces revalidation behind an in-flight request', async () => {
    const resolvers: ((value: string) => void)[] = [];
    const request = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const firstRequest = runStockPayTokenDetailsRequest({
      request,
      scope: 'pending-revalidation',
    });
    const firstRevalidation = runStockPayTokenDetailsRequest({
      mode: 'revalidate',
      request,
      scope: 'pending-revalidation',
    });
    const duplicateRevalidation = runStockPayTokenDetailsRequest({
      mode: 'revalidate',
      request,
      scope: 'pending-revalidation',
    });
    const dedupedAfterRevalidation = runStockPayTokenDetailsRequest({
      request,
      scope: 'pending-revalidation',
    });

    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    resolvers[0]?.('before-refresh');
    await expect(firstRequest).resolves.toBe('before-refresh');
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    resolvers[1]?.('after-refresh');
    await expect(
      Promise.all([
        firstRevalidation,
        duplicateRevalidation,
        dedupedAfterRevalidation,
      ]),
    ).resolves.toEqual(['after-refresh', 'after-refresh', 'after-refresh']);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('runs a queued revalidation after the in-flight request rejects', async () => {
    let rejectRequest: ((error: Error) => void) | undefined;
    const request = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectRequest = reject;
          }),
      )
      .mockResolvedValueOnce('recovered');

    const firstRequest = runStockPayTokenDetailsRequest({
      request,
      scope: 'revalidation-after-rejection',
    });
    const revalidation = runStockPayTokenDetailsRequest({
      mode: 'revalidate',
      request,
      scope: 'revalidation-after-rejection',
    });
    await Promise.resolve();
    rejectRequest?.(new OneKeyLocalError('request failed'));

    await expect(firstRequest).rejects.toThrow('request failed');
    await expect(revalidation).resolves.toBe('recovered');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('never evicts in-flight requests when the settled cache reaches capacity', async () => {
    const resolvers: ((value: string) => void)[] = [];
    const request = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const requests = Array.from({ length: 21 }, (_, index) =>
      runStockPayTokenDetailsRequest({
        request,
        scope: `pending-capacity-${index}`,
      }),
    );
    const duplicateRequest = runStockPayTokenDetailsRequest({
      request,
      scope: 'pending-capacity-0',
    });

    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(21);
    resolvers.forEach((resolve, index) => resolve(`loaded-${index}`));
    await Promise.all([...requests, duplicateRequest]);
    expect(request).toHaveBeenCalledTimes(21);
  });

  it('recovers after a queued revalidation factory throws synchronously', async () => {
    let resolveRequest: ((value: string) => void) | undefined;
    const request = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveRequest = resolve;
          }),
      )
      .mockImplementationOnce(() => {
        throw new OneKeyLocalError('sync failure');
      })
      .mockResolvedValueOnce('recovered');

    const firstRequest = runStockPayTokenDetailsRequest({
      request,
      scope: 'sync-revalidation-failure',
    });
    const revalidation = runStockPayTokenDetailsRequest({
      mode: 'revalidate',
      request,
      scope: 'sync-revalidation-failure',
    });
    await Promise.resolve();
    resolveRequest?.('before-refresh');

    await expect(firstRequest).resolves.toBe('before-refresh');
    await expect(revalidation).rejects.toThrow('sync failure');
    await expect(
      runStockPayTokenDetailsRequest({
        request,
        scope: 'sync-revalidation-failure',
      }),
    ).resolves.toBe('recovered');
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('evicts only the least-recently-used settled result at capacity', async () => {
    const request = jest.fn(async () => 'loaded');
    for (let index = 0; index < 20; index += 1) {
      await runStockPayTokenDetailsRequest({
        request,
        scope: `settled-capacity-${index}`,
      });
    }
    await runStockPayTokenDetailsRequest({
      request,
      scope: 'settled-capacity-0',
    });
    await runStockPayTokenDetailsRequest({
      request,
      scope: 'settled-capacity-20',
    });
    await runStockPayTokenDetailsRequest({
      request,
      scope: 'settled-capacity-0',
    });
    await runStockPayTokenDetailsRequest({
      request,
      scope: 'settled-capacity-1',
    });

    expect(request).toHaveBeenCalledTimes(22);
  });

  it('refreshes pay tokens when a history event contains a pay token', () => {
    expect(
      shouldRefreshStockPayTokensForHistoryEvent({
        fromToken: stockToken,
        rawPayTokens: [usdcToken, usdtToken],
        toToken: usdtToken,
      }),
    ).toBe(true);
  });

  it('does not refresh pay tokens for unrelated history events', () => {
    expect(
      shouldRefreshStockPayTokensForHistoryEvent({
        fromToken: stockToken,
        rawPayTokens: [usdcToken, usdtToken],
        toToken: ethToken,
      }),
    ).toBe(false);
  });

  it('syncs selected pay token detail when the balance changes', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balance: '0',
          balanceParsed: '0',
          fiatValue: '0',
          price: '1',
        },
        nextToken: {
          ...usdcToken,
          balance: '1.25',
          balanceParsed: '1.25',
          fiatValue: '1.25',
          price: '1',
        },
      }),
    ).toBe(true);
  });

  it('does not sync selected pay token detail when token identity differs', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balanceParsed: '0',
        },
        nextToken: {
          ...usdtToken,
          balanceParsed: '1',
        },
      }),
    ).toBe(false);
  });

  it('does not sync selected pay token detail when detail fields are unchanged', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          fiatValue: '2',
          price: '1',
        },
        nextToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          fiatValue: '2',
          price: '1',
        },
      }),
    ).toBe(false);
  });

  it('syncs selected pay token detail when the price currency is added', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          fiatValue: '2',
          price: '1',
        },
        nextToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          currency: 'usd',
          fiatValue: '2',
          price: '1',
        },
      }),
    ).toBe(true);
  });
});
