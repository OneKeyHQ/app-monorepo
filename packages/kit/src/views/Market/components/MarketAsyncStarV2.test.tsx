/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  MarketAsyncStarV2,
  createCachedMarketIdentityResolver,
} from './MarketAsyncStarV2';
import { MarketStarV2 } from './MarketStarV2';

const mockAddIntoWatchListV2 = jest.fn();
const mockIsInWatchListV2 = jest.fn(() => false);
const mockRemoveFromWatchListV2 = jest.fn();
let mockWatchListData: IMarketWatchListItemV2[] = [];
let mockIsMounted = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  IconButton: ({
    icon,
    disabled,
    loading,
    onPress,
    testID,
  }: {
    icon: string;
    disabled?: boolean;
    loading?: boolean;
    onPress: () => Promise<void>;
    testID: string;
  }) => (
    <button
      aria-label="star"
      data-icon={icon}
      data-loading={String(Boolean(loading))}
      data-testid={testID}
      disabled={disabled}
      onClick={() => void onPress()}
      type="button"
    />
  ),
  Toast: { error: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      watchlist: {
        dexAddToWatchlist: jest.fn(),
        dexRemoveFromWatchlist: jest.fn(),
      },
    },
  },
}));

jest.mock('../../../states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [
    { data: mockWatchListData, isMounted: mockIsMounted },
  ],
}));

jest.mock('./watchListHooksV2', () => ({
  useWatchListV2Action: () => ({
    addIntoWatchListV2: mockAddIntoWatchListV2,
    isInWatchListV2: mockIsInWatchListV2,
    removeFromWatchListV2: mockRemoveFromWatchListV2,
  }),
}));

const mockWatchlistLogger = jest.mocked(defaultLogger.dex.watchlist);

describe('createCachedMarketIdentityResolver', () => {
  it('starts the next queued request whenever any worker becomes free', async () => {
    const requestResolvers = new Map<
      string,
      (value: string | undefined) => void
    >();
    const load = jest.fn(
      (key: string) =>
        new Promise<string | undefined>((resolve) => {
          requestResolvers.set(key, resolve);
        }),
    );
    const resolveIdentity = createCachedMarketIdentityResolver({
      failureCacheTtlMs: 30_000,
      load,
    });

    const first = resolveIdentity('first');
    const second = resolveIdentity('second');
    const third = resolveIdentity('third');
    const fourth = resolveIdentity('fourth');

    expect(load.mock.calls.map(([key]) => key)).toEqual([
      'first',
      'second',
      'third',
    ]);
    requestResolvers.get('second')?.('second');
    await second;
    await Promise.resolve();
    expect(load.mock.calls.map(([key]) => key)).toEqual([
      'first',
      'second',
      'third',
      'fourth',
    ]);

    requestResolvers.get('first')?.('first');
    requestResolvers.get('third')?.('third');
    requestResolvers.get('fourth')?.('fourth');
    await Promise.all([first, third, fourth]);
  });

  it('deduplicates prefetches and refreshes the cache for interaction', async () => {
    const load = jest.fn(() => Promise.resolve('identity'));
    const resolveIdentity = createCachedMarketIdentityResolver({
      failureCacheTtlMs: 30_000,
      load,
    });

    await Promise.all([
      resolveIdentity('btc', { intent: 'prefetch' }),
      resolveIdentity('btc', { intent: 'prefetch' }),
    ]);
    await resolveIdentity('btc', { intent: 'prefetch' });
    expect(load).toHaveBeenCalledTimes(1);

    await resolveIdentity('btc', { intent: 'interaction' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('starts a new interaction ahead of queued prefetches', async () => {
    const activeResolvers: Array<(value: string) => void> = [];
    const blockingResolver = createCachedMarketIdentityResolver({
      failureCacheTtlMs: 30_000,
      load: () =>
        new Promise<string>((resolve) => {
          activeResolvers.push(resolve);
        }),
    });
    const queuedResolvers = new Map<string, (value: string) => void>();
    const queuedLoad = jest.fn(
      (key: string) =>
        new Promise<string>((resolve) => {
          queuedResolvers.set(key, resolve);
        }),
    );
    const queuedResolver = createCachedMarketIdentityResolver({
      failureCacheTtlMs: 30_000,
      load: queuedLoad,
    });
    const activeRequests = [
      blockingResolver('one'),
      blockingResolver('two'),
      blockingResolver('three'),
    ];
    const prefetch = queuedResolver('prefetch', { intent: 'prefetch' });
    const interaction = queuedResolver('interaction', {
      intent: 'interaction',
    });

    activeResolvers[0]('one');
    await activeRequests[0];
    await Promise.resolve();
    expect(queuedLoad.mock.calls.map(([key]) => key)).toEqual(['interaction']);

    queuedResolvers.get('interaction')?.('interaction');
    await interaction;
    await Promise.resolve();
    expect(queuedLoad.mock.calls.map(([key]) => key)).toEqual([
      'interaction',
      'prefetch',
    ]);

    queuedResolvers.get('prefetch')?.('prefetch');
    activeResolvers[1]('two');
    activeResolvers[2]('three');
    await Promise.all([prefetch, ...activeRequests.slice(1)]);
  });

  it('skips a queued prefetch after its consumer is canceled', async () => {
    const activeResolvers: Array<(value: string) => void> = [];
    const blockingResolver = createCachedMarketIdentityResolver({
      failureCacheTtlMs: 30_000,
      load: () =>
        new Promise<string>((resolve) => {
          activeResolvers.push(resolve);
        }),
    });
    const queuedLoad = jest.fn(() => Promise.resolve('queued'));
    const queuedResolver = createCachedMarketIdentityResolver({
      failureCacheTtlMs: 30_000,
      load: queuedLoad,
    });
    const activeRequests = [
      blockingResolver('one'),
      blockingResolver('two'),
      blockingResolver('three'),
    ];
    let canceled = false;
    const queuedRequest = queuedResolver('queued', {
      intent: 'prefetch',
      isCanceled: () => canceled,
    });

    canceled = true;
    activeResolvers[0]('one');
    expect(await queuedRequest).toBeUndefined();
    expect(queuedLoad).not.toHaveBeenCalled();

    activeResolvers[1]('two');
    activeResolvers[2]('three');
    await Promise.all(activeRequests);
  });
});

describe('MarketStarV2', () => {
  it('disables repeated presses while a favorite mutation is pending', async () => {
    let resolveAdd: (value: boolean) => void = () => undefined;
    mockWatchListData = [];
    mockIsMounted = true;
    mockAddIntoWatchListV2.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAdd = resolve;
        }),
    );
    render(
      <MarketStarV2
        chainId="evm--1"
        contractAddress="0xbtc"
        from={EWatchlistFrom.Homepage}
        tokenSymbol="BTC"
      />,
    );
    const button = screen.getByRole('button');

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockAddIntoWatchListV2).toHaveBeenCalledTimes(1);
    expect(mockRemoveFromWatchListV2).not.toHaveBeenCalled();
    expect(button.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      resolveAdd(true);
      await Promise.resolve();
    });
    expect(button.hasAttribute('disabled')).toBe(false);
  });
});

describe('MarketAsyncStarV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWatchListData = [];
    mockIsMounted = true;
    mockIsInWatchListV2.mockReturnValue(false);
    mockAddIntoWatchListV2.mockResolvedValue(true);
    mockRemoveFromWatchListV2.mockResolvedValue(true);
  });

  it('fills immediately without showing a loading spinner', async () => {
    let resolveRequest: (value: {
      chainId: string;
      contractAddress: string;
    }) => void = () => undefined;
    const resolveIdentity = jest.fn(
      () =>
        new Promise<{ chainId: string; contractAddress: string }>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={resolveIdentity}
        identityKey="btc"
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    fireEvent.click(screen.getByTestId('async-star'));

    expect(screen.getByTestId('async-star').getAttribute('data-icon')).toBe(
      'StarSolid',
    );
    expect(screen.getByTestId('async-star').getAttribute('data-loading')).toBe(
      'false',
    );

    await act(async () => {
      resolveRequest({ chainId: 'btc--0', contractAddress: '' });
      await Promise.resolve();
    });
    expect(mockAddIntoWatchListV2).toHaveBeenCalledWith([
      { chainId: 'btc--0', contractAddress: '' },
    ]);
  });

  it('rolls back the optimistic icon when identity resolution fails', async () => {
    const resolveIdentity = jest.fn(() =>
      Promise.reject(new OneKeyLocalError('lookup failed')),
    );
    render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={resolveIdentity}
        identityKey="btc"
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('async-star'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('async-star').getAttribute('data-icon')).toBe(
      'StarOutline',
    );
    expect(Toast.error).toHaveBeenCalledTimes(1);
  });

  it('does not resolve or mutate favorites before the watchlist is mounted', () => {
    mockIsMounted = false;
    const resolveIdentity = jest.fn(() =>
      Promise.resolve({ chainId: 'btc--0', contractAddress: '' }),
    );
    render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={resolveIdentity}
        identityKey="btc"
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    fireEvent.click(screen.getByTestId('async-star'));

    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(mockAddIntoWatchListV2).not.toHaveBeenCalled();
    expect(mockWatchlistLogger.dexAddToWatchlist.mock.calls).toHaveLength(0);
    expect(screen.getByTestId('async-star').hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('reveals an existing favorite before allowing it to be removed', async () => {
    mockWatchListData = [{ chainId: 'evm--1', contractAddress: '0xbtc' }];
    mockIsInWatchListV2.mockReturnValue(true);
    const resolveIdentity = jest.fn(() =>
      Promise.resolve({ chainId: 'evm--1', contractAddress: '0xbtc' }),
    );
    render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={resolveIdentity}
        identityKey="btc"
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('async-star'));
      await Promise.resolve();
    });

    expect(mockRemoveFromWatchListV2).not.toHaveBeenCalled();
    expect(screen.getByTestId('async-star').getAttribute('data-icon')).toBe(
      'StarSolid',
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('async-star'));
      await Promise.resolve();
    });

    expect(mockRemoveFromWatchListV2).toHaveBeenCalledWith('evm--1', '0xbtc');
    expect(mockWatchlistLogger.dexRemoveFromWatchlist.mock.calls).toHaveLength(
      1,
    );
  });

  it('rolls back the optimistic icon when persistence fails', async () => {
    mockAddIntoWatchListV2.mockResolvedValue(false);
    const resolveIdentity = jest.fn(() =>
      Promise.resolve({ chainId: 'evm--1', contractAddress: '0xbtc' }),
    );
    render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={resolveIdentity}
        identityKey="btc"
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('async-star'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('async-star').getAttribute('data-icon')).toBe(
      'StarOutline',
    );
    expect(mockWatchlistLogger.dexAddToWatchlist.mock.calls).toHaveLength(0);
  });

  it('resolves the initial identity so an existing favorite is visible', async () => {
    mockWatchListData = [
      {
        chainId: 'evm--1',
        contractAddress: '0xbtc',
      },
    ];
    const resolveIdentity = jest.fn(() =>
      Promise.resolve({ chainId: 'evm--1', contractAddress: '0xbtc' }),
    );
    render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={resolveIdentity}
        identityKey="btc"
        resolveOnMount
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('async-star').getAttribute('data-icon')).toBe(
      'StarSolid',
    );
  });

  it('ignores an identity resolved for a previous row', async () => {
    let resolveFirst: (
      value: IMarketWatchListItemV2 | undefined,
    ) => void = () => undefined;
    const firstResolver = jest.fn(
      () =>
        new Promise<IMarketWatchListItemV2 | undefined>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const secondResolver = jest.fn(() =>
      Promise.resolve({ chainId: 'evm--1', contractAddress: '0xeth' }),
    );
    mockWatchListData = [{ chainId: 'evm--1', contractAddress: '0xbtc' }];
    const { rerender } = render(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={firstResolver}
        identityKey="btc"
        resolveOnMount
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );

    rerender(
      <MarketAsyncStarV2
        identities={[]}
        resolveIdentity={secondResolver}
        identityKey="eth"
        from={EWatchlistFrom.Homepage}
        testID="async-star"
      />,
    );
    await act(async () => {
      resolveFirst({ chainId: 'evm--1', contractAddress: '0xbtc' });
      await Promise.resolve();
    });

    expect(screen.getByTestId('async-star').getAttribute('data-icon')).toBe(
      'StarOutline',
    );
  });
});
