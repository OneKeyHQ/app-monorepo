/** @jest-environment jsdom */

import React, { useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type * as ContextModule from './MarketDetailWatchlistSidebarContext';
import type * as FrameModule from './MarketDetailWatchlistSidebarFrame';
import type { LayoutChangeEvent } from 'react-native';

let mockIsFocused = true;
let mockOnLayout: (event: LayoutChangeEvent) => void;
let mockWatchList: { data: unknown[]; isMounted: boolean };
let mockInitialPersist: { open?: boolean };

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
  useMarketWatchListV2Atom: () => [mockWatchList],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailWatchlistSidebarPersistAtom: () =>
    useState<{ open?: boolean }>(mockInitialPersist),
}));
jest.mock('./MarketDetailWatchlistSidebar', () => ({
  MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH: 304,
  MarketDetailWatchlistSidebar: () => <div data-testid="sidebar" />,
}));

// The frame remembers the last mount's width and default in module scope, so
// each test loads a fresh copy.
let MarketDetailWatchlistSidebarContext: typeof ContextModule.MarketDetailWatchlistSidebarContext;
let MarketDetailWatchlistSidebarFrame: typeof FrameModule.MarketDetailWatchlistSidebarFrame;

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
  mockWatchList = { data: [], isMounted: true };
  mockInitialPersist = { open: false };
  jest.isolateModules(() => {
    // Share the test's React so the fresh frame's hooks run in this renderer.
    jest.doMock('react', () => React);
    ({ MarketDetailWatchlistSidebarContext } = jest.requireActual<
      typeof ContextModule
    >('./MarketDetailWatchlistSidebarContext'));
    ({ MarketDetailWatchlistSidebarFrame } = jest.requireActual<
      typeof FrameModule
    >('./MarketDetailWatchlistSidebarFrame'));
  });
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

it('ignores zero widths and applies real modal-time resizes before refocusing', () => {
  const { rerender } = render(<TestFrame />);
  layout(0);
  fireEvent.click(screen.getByText('Toggle'));
  layout(1400);
  expect(screen.queryByTestId('sidebar')).toBeNull();
  fireEvent.click(screen.getByText('Toggle'));
  mockIsFocused = false;
  rerender(<TestFrame />);
  layout(1100);
  mockIsFocused = true;
  rerender(<TestFrame />);
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

  mockIsFocused = false;
  rerender(<TestFrame />);
  layout(1400);
  mockIsFocused = true;
  rerender(<TestFrame />);
  expect(
    screen.getByTestId('market-detail-watchlist-sidebar-docked'),
  ).toBeTruthy();
});

describe('before the user picks a state', () => {
  const DOCKED_TEST_ID = 'market-detail-watchlist-sidebar-docked';

  beforeEach(() => {
    mockInitialPersist = {};
  });

  function mountFrame() {
    const result = render(<TestFrame />);
    layout(1400);
    return result;
  }

  it('re-reads the favorites on each mount', () => {
    mountFrame().unmount();

    // A first favorite added elsewhere opens the sidebar on the next visit.
    mockWatchList = { data: [{}], isMounted: true };
    const second = mountFrame();
    expect(screen.getByTestId(DOCKED_TEST_ID)).toBeTruthy();

    // Removing the last favorite keeps this mount's answer.
    mockWatchList = { data: [], isMounted: true };
    second.rerender(<TestFrame />);
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
    render(<TestFrame />);
    expect(screen.getByTestId(DOCKED_TEST_ID)).toBeTruthy();
  });
});
