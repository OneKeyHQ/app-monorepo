/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketListingStar } from './MarketListingStar';

let mockData: IMarketWatchListItemV2[] = [];
let mockMounted = true;
const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockAcquire = jest.fn<unknown, unknown[]>();
jest.mock('../utils/marketListingWatchlistIdentity', () => ({
  acquireMarketListingWatchlistIdentity: (...args: unknown[]) =>
    mockAcquire(...args),
}));
jest.mock('../../../states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: mockData, isMounted: mockMounted }],
}));
jest.mock('./watchListHooksV2', () => ({
  useWatchListV2Action: () => ({
    addIntoWatchListV2: mockAdd,
    removeFromWatchListV2: mockRemove,
  }),
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
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onPress,
  }: PropsWithChildren<{
    onPress: React.MouseEventHandler<HTMLDivElement>;
  }>) => (
    <div role="presentation" onClick={onPress}>
      {children}
    </div>
  ),
  IconButton: ({
    icon,
    disabled,
    onPress,
    testID,
  }: {
    icon: string;
    disabled?: boolean;
    onPress: () => void;
    testID: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {icon}
    </button>
  ),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockData = [];
  mockMounted = true;
});
it.each(['asset', 'stock'] as const)(
  'renders and saves %s without resolving a token variant',
  (kind) => {
    render(
      <MarketListingStar
        kind={kind}
        listingId="BTC"
        from={EWatchlistFrom.Homepage}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('StarOutline');
    fireEvent.click(button);
    expect(mockAdd).toHaveBeenCalledWith([
      expect.objectContaining({
        chainId: '',
        contractAddress: '',
        [kind === 'asset' ? 'assetId' : 'stockId']: 'BTC',
      }),
    ]);
    expect(mockAcquire).not.toHaveBeenCalled();
  },
);
it('uses the persisted listing identity immediately and isolates recycled rows', () => {
  mockData = [{ chainId: '', contractAddress: '', assetId: 'BTC' }];
  const { rerender } = render(
    <MarketListingStar
      kind="asset"
      listingId="BTC"
      from={EWatchlistFrom.Homepage}
    />,
  );
  expect(screen.getByRole('button').textContent).toBe('StarSolid');
  fireEvent.click(screen.getByRole('button'));
  expect(mockRemove).toHaveBeenCalledWith('', '', {
    assetId: 'BTC',
    stockId: undefined,
  });
  rerender(
    <MarketListingStar
      kind="stock"
      listingId="BTC"
      from={EWatchlistFrom.Homepage}
    />,
  );
  expect(screen.getByRole('button').textContent).toBe('StarOutline');
  expect(mockAcquire).not.toHaveBeenCalled();
});
it('does not mutate storage before hydration or navigate the row on a star click', () => {
  mockMounted = false;
  const onRowPress = jest.fn();
  const { rerender } = render(
    <div role="presentation" onClick={onRowPress}>
      <MarketListingStar
        kind="stock"
        listingId="AAPL"
        from={EWatchlistFrom.Homepage}
      />
    </div>,
  );
  fireEvent.click(screen.getByRole('button'));
  expect(mockAdd).not.toHaveBeenCalled();
  mockMounted = true;
  rerender(
    <div role="presentation" onClick={onRowPress}>
      <MarketListingStar
        kind="stock"
        listingId="AAPL"
        from={EWatchlistFrom.Homepage}
      />
    </div>,
  );
  fireEvent.click(screen.getByRole('button'));
  expect(onRowPress).not.toHaveBeenCalled();
});
