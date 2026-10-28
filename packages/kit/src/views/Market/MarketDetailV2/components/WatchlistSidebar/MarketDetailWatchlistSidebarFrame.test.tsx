/** @jest-environment jsdom */
import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketDetailWatchlistSidebarFrame } from './MarketDetailWatchlistSidebarFrame';

const DOCKED_TEST_ID = 'market-detail-watchlist-sidebar-docked';

let mockSavedOpen: boolean | undefined;
let mockWatchList: { data: unknown[]; isMounted: boolean };

jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    testID,
    onLayout,
  }: PropsWithChildren<{
    testID?: string;
    onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void;
  }>) => {
    // Wide enough to dock the sidebar.
    useEffect(() => {
      onLayout?.({ nativeEvent: { layout: { width: 1600 } } });
    }, [onLayout]);
    return <div data-testid={testID}>{children}</div>;
  };
  return { Stack: View, XStack: View };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [mockWatchList],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailWatchlistSidebarPersistAtom: () => [
    { open: mockSavedOpen },
    jest.fn(),
  ],
}));
jest.mock('./MarketDetailWatchlistSidebar', () => ({
  MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH: 288,
  MarketDetailWatchlistSidebar: () => null,
}));

function mountFrame() {
  return render(
    <MarketDetailWatchlistSidebarFrame>
      <span>content</span>
    </MarketDetailWatchlistSidebarFrame>,
  );
}

beforeEach(() => {
  mockSavedOpen = undefined;
});

it('re-reads the favorites on each mount while the user has not picked a state', () => {
  mockWatchList = { data: [], isMounted: true };
  mountFrame().unmount();

  // A first favorite added elsewhere opens the sidebar on the next visit.
  mockWatchList = { data: [{}], isMounted: true };
  const second = mountFrame();
  expect(screen.getByTestId(DOCKED_TEST_ID)).toBeTruthy();

  // Removing the last favorite keeps this mount's answer.
  mockWatchList = { data: [], isMounted: true };
  second.rerender(
    <MarketDetailWatchlistSidebarFrame>
      <span>content</span>
    </MarketDetailWatchlistSidebarFrame>,
  );
  expect(screen.getByTestId(DOCKED_TEST_ID)).toBeTruthy();
  second.unmount();

  // The next visit reads the empty watchlist again.
  mountFrame();
  expect(screen.queryByTestId(DOCKED_TEST_ID)).toBeNull();
});

it('keeps the last answer until the watchlist loads on a remount', () => {
  mockWatchList = { data: [{}], isMounted: true };
  mountFrame().unmount();

  mockWatchList = { data: [], isMounted: false };
  mountFrame();
  expect(screen.getByTestId(DOCKED_TEST_ID)).toBeTruthy();
});
