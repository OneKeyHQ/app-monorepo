/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketAsyncStarV2 } from './MarketAsyncStarV2';

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

  it('removes an existing favorite on the first press after resolving it', async () => {
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

    expect(mockRemoveFromWatchListV2).toHaveBeenCalledWith('evm--1', '0xbtc');
    expect(mockAddIntoWatchListV2).not.toHaveBeenCalled();
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
