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
jest.mock('@onekeyhq/components', () => {
  function Stack({
    children,
    testID,
    enterStyle,
    onLayout,
  }: {
    children?: ReactNode;
    testID?: string;
    enterStyle?: { x: number };
    onLayout?: (event: LayoutChangeEvent) => void;
  }) {
    if (onLayout) mockOnLayout = onLayout;
    return (
      <div data-testid={testID} data-enter-x={enterStyle?.x}>
        {children}
      </div>
    );
  }
  return { Stack, XStack: Stack };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: [], isMounted: true }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailWatchlistSidebarPersistAtom: () =>
    useState<{ open: boolean }>({ open: false }),
}));
jest.mock('./MarketDetailWatchlistSidebar', () => ({
  MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH: 304,
  MarketDetailWatchlistSidebar: () => <div data-testid="sidebar" />,
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

function TestFrame() {
  return (
    <MarketDetailWatchlistSidebarFrame>
      <Toggle />
    </MarketDetailWatchlistSidebarFrame>
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
  const { rerender } = render(<TestFrame />);
  layout(1400);
  fireEvent.click(screen.getByText('Toggle'));
  const sidebar = screen.getByTestId('sidebar');
  const docked = screen.getByTestId('market-detail-watchlist-sidebar-docked');
  expect(docked.getAttribute('data-enter-x')).toBe('-304');

  mockIsFocused = false;
  rerender(<TestFrame />);
  layout(0);
  expect(screen.getByTestId('sidebar')).toBe(sidebar);

  mockIsFocused = true;
  rerender(<TestFrame />);
  layout(1400);
  expect(screen.getByTestId('sidebar')).toBe(sidebar);
  expect(docked.getAttribute('data-enter-x')).toBeNull();
});

it('waits for a visible measurement and still switches modes on a real resize', () => {
  render(<TestFrame />);
  layout(0);
  fireEvent.click(screen.getByText('Toggle'));
  layout(1400);
  expect(screen.queryByTestId('sidebar')).toBeNull();
  fireEvent.click(screen.getByText('Toggle'));
  layout(1100);
  expect(
    screen.queryByTestId('market-detail-watchlist-sidebar-docked'),
  ).toBeNull();
  fireEvent.click(screen.getByText('Toggle'));
  const sidebar = screen.getByTestId('sidebar');
  layout(0);
  expect(screen.getByTestId('sidebar')).toBe(sidebar);
  expect(
    screen.getByTestId('market-detail-watchlist-sidebar-overlay'),
  ).toBeTruthy();
});
