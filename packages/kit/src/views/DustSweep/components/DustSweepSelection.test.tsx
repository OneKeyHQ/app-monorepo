/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

import { DustSweepSelection } from './DustSweepSelection';

const mockScroll = jest.fn((_options: { bottomInset: number }) => ({
  scrollViewRef: { current: null },
  onRowsLayout: () => undefined,
}));
let mockSelecting = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  function MockBox({ children }: PropsWithChildren) {
    return <div>{children}</div>;
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
    loadStatus: 'ready',
    refreshStatus: 'idle',
    assetStatus: 'ready',
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
  DustSweepTokenRow: () => null,
}));

function lastBottomInset() {
  return mockScroll.mock.calls.at(-1)?.[0].bottomInset;
}

beforeEach(() => {
  mockScroll.mockClear();
  mockSelecting = false;
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
