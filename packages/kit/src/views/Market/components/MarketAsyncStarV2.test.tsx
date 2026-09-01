/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketAsyncStarV2 } from './MarketAsyncStarV2';

const mockAddIntoWatchListV2 = jest.fn();
const mockIsInWatchListV2 = jest.fn(() => false);
const mockRemoveFromWatchListV2 = jest.fn();
let mockWatchListData: IMarketWatchListItemV2[] = [];

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  IconButton: ({
    icon,
    loading,
    onPress,
    testID,
  }: {
    icon: string;
    loading?: boolean;
    onPress: () => Promise<void>;
    testID: string;
  }) => (
    <button
      aria-label="star"
      data-icon={icon}
      data-loading={String(Boolean(loading))}
      data-testid={testID}
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
    { data: mockWatchListData, isMounted: true },
  ],
}));

jest.mock('./watchListHooksV2', () => ({
  useWatchListV2Action: () => ({
    addIntoWatchListV2: mockAddIntoWatchListV2,
    isInWatchListV2: mockIsInWatchListV2,
    removeFromWatchListV2: mockRemoveFromWatchListV2,
  }),
}));

describe('MarketAsyncStarV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWatchListData = [];
    mockIsInWatchListV2.mockReturnValue(false);
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
});
