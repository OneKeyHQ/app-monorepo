/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { DustSweepSelection } from './DustSweepSelection';

const mockScroll = jest.fn((_options: { bottomInset: number }) => ({
  scrollViewRef: { current: null },
  onRowsLayout: () => undefined,
}));
let mockSelecting = false;
let mockLoadStatus: 'loading' | 'ready' | 'error' = 'ready';
let mockRefreshStatus: 'refreshing' | 'idle' | 'error' = 'idle';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  function MockBox({
    children,
    testID,
  }: PropsWithChildren<{ testID?: string }>) {
    return <div data-testid={testID}>{children}</div>;
  }
  return {
    Button: MockBox,
    Checkbox: () => null,
    Illustration: () => null,
    ScrollView: MockBox,
    SizableText: MockBox,
    Stack: MockBox,
    XStack: MockBox,
    YStack: MockBox,
  };
});
jest.mock('@onekeyhq/kit/src/views/Swap/utils/swapDesktopCardShadow', () => ({
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE: {},
}));
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({
    visible: [],
    hidden: [],
    selected: [],
    selecting: mockSelecting,
    session: {
      state: { phase: mockSelecting ? 'selecting' : 'running', items: [] },
    },
    loadStatus: mockLoadStatus,
    refreshStatus: mockRefreshStatus,
    assetStatus: mockRefreshStatus === 'refreshing' ? 'refreshing' : 'ready',
    partialError: false,
  }),
}));
jest.mock('../hooks/useDustSweepActiveItemScroll', () => ({
  useDustSweepActiveItemScroll: (options: { bottomInset: number }) =>
    mockScroll(options),
}));
jest.mock('./DustSweepFilters', () => ({ DustSweepFilters: () => null }));
jest.mock('./DustSweepSummary', () => ({ DUST_SWEEP_ACTION_HEIGHT: 46 }));
jest.mock('./DustSweepTokenRow', () => ({
  DUST_SWEEP_ROW_HEIGHT: 64,
  DustSweepTokenRow: () => <span data-testid="dust-sweep-skeleton-row" />,
}));

function lastBottomInset() {
  return mockScroll.mock.calls.at(-1)?.[0].bottomInset;
}

beforeEach(() => {
  mockScroll.mockClear();
  mockSelecting = false;
  mockLoadStatus = 'ready';
  mockRefreshStatus = 'idle';
});

it('keeps the active row above the mobile live sheet while sweeping', () => {
  render(<DustSweepSelection desktop={false} obscuredBottom={434} />);
  expect(lastBottomInset()).toBe(434);
});

it('only clears the direction circle while selecting on mobile', () => {
  mockSelecting = true;
  render(<DustSweepSelection desktop={false} obscuredBottom={434} />);
  expect(lastBottomInset()).toBe(18);
});

it('has no bottom inset on desktop', () => {
  render(<DustSweepSelection desktop obscuredBottom={434} />);
  expect(lastBottomInset()).toBe(0);
});

it('shows skeleton rows only while the initial data is unavailable', () => {
  mockSelecting = true;
  mockLoadStatus = 'loading';
  mockRefreshStatus = 'refreshing';
  render(<DustSweepSelection desktop />);
  expect(screen.getAllByTestId('dust-sweep-skeleton-row')).toHaveLength(7);
});

it('keeps a known empty selection visible during a background refresh', () => {
  mockSelecting = true;
  mockRefreshStatus = 'refreshing';
  render(<DustSweepSelection desktop />);
  expect(screen.queryByTestId('dust-sweep-skeleton-row')).toBeNull();
  expect(screen.getByText('empty_noMatchingTokens')).toBeTruthy();
});
