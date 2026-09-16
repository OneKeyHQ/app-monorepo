import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import {
  createSwapReviewPreloadWithBuildCache,
  getSwapReviewPreparationKey,
  isSwapPreparedBuildExpired,
  isSwapPreparedFeeExpired,
  shouldPreloadSwapReview,
  supportsSwapReviewPreload,
} from './swapReviewPreload';

const quote = {
  info: { provider: 'provider', providerName: 'Provider' },
  toAmount: '10',
  fromTokenInfo: { networkId: 'evm--1' },
} as IFetchQuoteResult;

describe('swap quote preparation ownership', () => {
  it('waits for stream completion for automatic selection, including a manual fallback', () => {
    expect(
      shouldPreloadSwapReview({ quote, proven: true, completed: false }),
    ).toBe(false);
    expect(
      shouldPreloadSwapReview({ quote, proven: true, completed: true }),
    ).toBe(true);
    expect(
      shouldPreloadSwapReview({
        quote,
        proven: true,
        completed: false,
        manualSelection: {
          type: 'manual-provider',
          info: { provider: 'other', providerName: 'Other' },
        },
      }),
    ).toBe(false);
  });

  it('prepares a matching manual quote immediately but never accepts an old or unusable quote', () => {
    const manualSelection = {
      type: 'manual-provider' as const,
      info: quote.info,
    };
    expect(
      shouldPreloadSwapReview({
        quote,
        proven: true,
        completed: false,
        manualSelection,
      }),
    ).toBe(true);
    expect(
      shouldPreloadSwapReview({
        quote,
        proven: false,
        completed: true,
        manualSelection,
      }),
    ).toBe(false);
    expect(
      shouldPreloadSwapReview({
        quote: { ...quote, toAmount: '0' },
        proven: true,
        completed: true,
        manualSelection,
      }),
    ).toBe(false);
  });

  it('keeps the exact pending Promise when Preview claims it, even after a slow request', async () => {
    jest.useFakeTimers();
    try {
      const cache = createSwapReviewPreloadWithBuildCache<void, number>();
      let resolve: ((value: number) => void) | undefined;
      const prepare = jest.fn(
        () =>
          new Promise<number>((done) => {
            resolve = done;
          }),
      );
      const task = cache.preload(
        'quote',
        'build',
        async () => undefined,
        prepare,
      );
      jest.advanceTimersByTime(45_000);
      const claimed = cache.claim(
        'quote',
        'build',
        async () => undefined,
        prepare,
      );
      expect(claimed.promise).toBe(task.promise);
      cache.clearCandidate();
      cache.preload('quote', 'build', async () => undefined, prepare);
      cache.preload('later-sse-quote', 'build', async () => undefined, prepare);
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(task.isCurrent()).toBe(true);
      resolve?.(1);
      await expect(claimed.promise).resolves.toBe(1);
      cache.clear();
      expect(task.isCurrent()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reuses a completed result across the Preview quote clone', async () => {
    const cache = createSwapReviewPreloadWithBuildCache<void, number>();
    const prepare = jest.fn(async () => 1);
    const key = getSwapReviewPreparationKey(quote, 'account-fee-slippage');
    const first = cache.preload(key, 'build', async () => undefined, prepare);
    await first.promise;
    const second = cache.claim(
      getSwapReviewPreparationKey({ ...quote }, 'account-fee-slippage'),
      'build',
      async () => undefined,
      prepare,
    );
    expect(second.promise).toBe(first.promise);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('invalidates an abandoned selection and claims a failed task without restarting it', async () => {
    const cache = createSwapReviewPreloadWithBuildCache<void, number>();
    const first = cache.preload(
      'old',
      'old-build',
      async () => undefined,
      async () => 1,
    );
    const failure = cache.preload(
      'new',
      'new-build',
      async () => undefined,
      async () => {
        throw new OneKeyError('offline');
      },
    );
    await failure.promise.catch(() => undefined);
    expect(first.isCurrent()).toBe(false);
    const prepare = jest.fn(async () => 2);
    const claimed = cache.claim(
      'new',
      'new-build',
      async () => undefined,
      prepare,
    );
    expect(claimed.promise).toBe(failure.promise);
    await expect(claimed.promise).rejects.toThrow('offline');
    expect(prepare).not.toHaveBeenCalled();
    cache.clear();
    await expect(
      cache.preload(
        'refreshed-quote',
        'new-build',
        async () => undefined,
        prepare,
      ).promise,
    ).resolves.toBe(2);
  });
  it('keeps build age separate from a freshly returned fee', () => {
    expect(
      isSwapPreparedBuildExpired({
        buildResult: {},
        builtAt: Date.now() - 31_000,
      }),
    ).toBe(true);
    expect(isSwapPreparedFeeExpired(undefined, Date.now())).toBe(false);
  });

  it.each(['seconds', 'milliseconds', 'iso'] as const)(
    'accepts Gas Account deadlines encoded as %s',
    (format) => {
      const now = Date.now();
      const future = now + 60_000;
      const expiresAt =
        format === 'iso'
          ? new Date(future).toISOString()
          : String(format === 'seconds' ? Math.floor(future / 1000) : future);
      const fee = {
        gasInfos: [
          {
            encodeTx: {},
            gasInfo: {
              gasAccountQuote: { quoteId: 'quote', maxFee: '1', expiresAt },
            },
          },
        ],
      };
      expect(isSwapPreparedFeeExpired(fee, now)).toBe(false);
      fee.gasInfos[0].gasInfo.gasAccountQuote.expiresAt = new Date(
        now - 1,
      ).toISOString();
      expect(isSwapPreparedFeeExpired(fee, now)).toBe(true);
    },
  );
});

describe('independent build and fee ownership', () => {
  it('keeps a pending build across fee changes and ignores the superseded fee', async () => {
    const cache = createSwapReviewPreloadWithBuildCache<number, string>();
    let resolveBuild: (value: number) => void = () => undefined;
    const build = jest.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveBuild = resolve;
        }),
    );
    const fee = jest.fn(
      async (pending: Promise<number>, isCurrent: () => boolean) => {
        const value = await pending;
        return isCurrent() ? String(value) : 'obsolete';
      },
    );
    const first = cache.preload('normal', 'same-order', build, fee);
    const next = cache.preload('fast', 'same-order', build, fee);
    expect(first.isCurrent()).toBe(false);
    expect(first.build.isCurrent()).toBe(true);
    expect(next.build.promise).toBe(first.build.promise);
    resolveBuild(7);
    await expect(first.promise).resolves.toBe('obsolete');
    await expect(next.promise).resolves.toBe('7');
    expect(build).toHaveBeenCalledTimes(1);
    expect(cache.claim('fast', 'same-order', build, fee).promise).toBe(
      next.promise,
    );
    cache.clearCandidate();
    expect(next.isCurrent()).toBe(true);
    cache.clear();
    expect(next.build.isCurrent()).toBe(false);
  });

  it('excludes recommendation badges but preserves opaque route identity', () => {
    const withBadges = {
      ...quote,
      isBest: true,
      receivedBest: true,
      minGasCost: true,
    };
    expect(getSwapReviewPreparationKey(withBadges, 'account')).toBe(
      getSwapReviewPreparationKey(quote, 'account'),
    );
    expect(
      getSwapReviewPreparationKey(
        { ...quote, quoteResultCtx: { route: 'new' } },
        'account',
      ),
    ).not.toBe(getSwapReviewPreparationKey(quote, 'account'));
  });

  it('waits for automatic slippage even when a manual provider is selected', () => {
    expect(
      shouldPreloadSwapReview({
        quote,
        proven: true,
        completed: false,
        manualSelection: { type: 'manual-provider', info: quote.info },
        isWaitingAutoSlippage: true,
      }),
    ).toBe(false);
  });
});

describe('preparation chain boundary', () => {
  it.each([
    'btc--0',
    'tbtc--0',
    'sol--101',
    'sui--mainnet',
    'xrp--0',
    'tron--0',
    'cfx--1029',
    'aptos--1',
    'unknown--1',
  ])('keeps %s on cold Review even after complete quotes', (networkId) => {
    const candidate = {
      ...quote,
      fromTokenInfo: { ...quote.fromTokenInfo, networkId },
    };
    expect(supportsSwapReviewPreload(candidate)).toBe(false);
    expect(
      shouldPreloadSwapReview({
        quote: candidate,
        proven: true,
        completed: true,
      }),
    ).toBe(false);
  });
  it('uses the source network for a bridge to a non-EVM destination', () => {
    expect(
      supportsSwapReviewPreload({
        ...quote,
        toTokenInfo: { ...quote.toTokenInfo, networkId: 'btc--0' },
      }),
    ).toBe(true);
  });
});
