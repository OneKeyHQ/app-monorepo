/** @jest-environment jsdom */

import { useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { MarketDetailWatchlistSidebarContext } from './MarketDetailWatchlistSidebarContext';
import { MarketDetailWatchlistSidebarFrame } from './MarketDetailWatchlistSidebarFrame';

import type { LayoutChangeEvent } from 'react-native';

let mockIsFocused = true;
let mockOnLayout: (event: LayoutChangeEvent) => void;

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));
jest.mock('react-intl', () => ({ useIntl: () => ({}) }));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    testID,
    enterStyle,
  }: {
    children?: ReactNode;
    testID?: string;
    enterStyle?: { x: number };
  }) => (
    <div data-testid={testID} data-enter-x={enterStyle?.x}>
      {children}
    </div>
  ),
  XStack: ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout: (event: LayoutChangeEvent) => void;
  }) => {
    mockOnLayout = onLayout;
    return <div>{children}</div>;
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: [], isMounted: true }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailWatchlistSidebarPersistAtom: () =>
    useState<{ open: boolean }>({ open: false }),
}));
jest.mock('./MarketDetailWatchlistSidebar', () => ({
  MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH: 304,
  MarketDetailWatchlistSidebar: () => (
    <input data-testid="sidebar-input" defaultValue="retained" />
  ),
}));

function Toggle() {
  const sidebar = useContext(MarketDetailWatchlistSidebarContext);
  return (
    <button
      type="button"
      disabled={!sidebar?.isReady}
      onClick={sidebar?.toggle}
    >
      Toggle
    </button>
  );
}

function layout(width: number) {
  act(() => {
    mockOnLayout({
      nativeEvent: { layout: { width, height: 800, x: 0, y: 0 } },
    } as LayoutChangeEvent);
  });
}

beforeEach(() => {
  mockIsFocused = true;
});

it('retains an open sidebar through hidden tab measurements without replaying entry', () => {
  const view = (
    <MarketDetailWatchlistSidebarFrame>
      <Toggle />
    </MarketDetailWatchlistSidebarFrame>
  );
  const { rerender } = render(view);
  layout(1400);
  fireEvent.click(screen.getByText('Toggle'));
  const sidebar = screen.getByTestId('sidebar-input');
  expect(
    screen
      .getByTestId('market-detail-watchlist-sidebar-docked')
      .getAttribute('data-enter-x'),
  ).toBe('-304');

  mockIsFocused = false;
  rerender(
    <MarketDetailWatchlistSidebarFrame>
      <Toggle />
    </MarketDetailWatchlistSidebarFrame>,
  );
  layout(0);
  expect(screen.getByTestId('sidebar-input')).toBe(sidebar);

  mockIsFocused = true;
  rerender(view);
  layout(1400);
  expect(screen.getByTestId('sidebar-input')).toBe(sidebar);
  expect(
    screen
      .getByTestId('market-detail-watchlist-sidebar-docked')
      .getAttribute('data-enter-x'),
  ).toBeNull();
});

it('waits for a visible measurement and still switches modes on a real resize', () => {
  render(
    <MarketDetailWatchlistSidebarFrame>
      <Toggle />
    </MarketDetailWatchlistSidebarFrame>,
  );
  layout(0);
  fireEvent.click(screen.getByText('Toggle'));
  layout(1400);
  expect(screen.queryByTestId('sidebar-input')).toBeNull();
  fireEvent.click(screen.getByText('Toggle'));
  expect(
    screen.getByTestId('market-detail-watchlist-sidebar-docked'),
  ).toBeTruthy();

  layout(1100);
  expect(
    screen.queryByTestId('market-detail-watchlist-sidebar-docked'),
  ).toBeNull();
  fireEvent.click(screen.getByText('Toggle'));
  const sidebar = screen.getByTestId('sidebar-input');
  layout(0);
  expect(screen.getByTestId('sidebar-input')).toBe(sidebar);
  expect(
    screen.getByTestId('market-detail-watchlist-sidebar-overlay'),
  ).toBeTruthy();
});
