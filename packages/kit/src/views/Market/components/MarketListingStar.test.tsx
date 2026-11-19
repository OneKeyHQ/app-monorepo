/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketStockStar } from '../MarketHomeV2/components/MarketStockList/MarketStockStar';
import { MarketTopCoinStar } from '../MarketHomeV2/components/MarketTopCoinsList/MarketTopCoinStar';

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
  async (kind) => {
    render(
      <MarketListingStar
        kind={kind}
        listingId="BTC"
        from={EWatchlistFrom.Homepage}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('StarOutline');
    await act(async () => {
      fireEvent.click(button);
    });
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
it('uses the persisted listing identity immediately and isolates recycled rows', async () => {
  mockData = [{ chainId: '', contractAddress: '', assetId: 'BTC' }];
  const { rerender } = render(
    <MarketListingStar
      kind="asset"
      listingId="BTC"
      from={EWatchlistFrom.Homepage}
    />,
  );
  expect(screen.getByRole('button').textContent).toBe('StarSolid');
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
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
it('does not mutate storage before hydration or navigate the row on a star click', async () => {
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
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
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
  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  expect(onRowPress).not.toHaveBeenCalled();
});

it.each(['asset', 'stock'] as const)(
  'keeps the %s list entry on listing favorites with pending-write protection',
  async (kind) => {
    let finishWrite: (value: boolean) => void = () => undefined;
    mockAdd.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishWrite = resolve;
        }),
    );
    render(
      kind === 'asset' ? (
        <MarketTopCoinStar
          token={{
            assetId: 'BTC',
            symbol: 'btc',
            logoUrl: '',
            price: '1',
            priceChange24hPercent: '0',
            priceChange7dPercent: '0',
            marketCap: '1',
            volume24h: '1',
            sparkline24h: [],
          }}
        />
      ) : (
        <MarketStockStar
          stock={{
            stockId: 'BTC',
            symbol: 'BTC',
            name: 'BTC',
            logoUrl: '',
            assetType: 'stock',
            currency: 'USD',
          }}
        />
      ),
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith([
      expect.objectContaining({
        chainId: '',
        contractAddress: '',
        [kind === 'asset' ? 'assetId' : 'stockId']: 'BTC',
      }),
    ]);
    expect(button.hasAttribute('disabled')).toBe(true);
    await act(async () => {
      finishWrite(true);
    });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(mockAcquire).not.toHaveBeenCalled();
  },
);
