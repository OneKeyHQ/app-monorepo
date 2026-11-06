/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PerpMarketWorkspacePanel } from './PerpMarketWorkspacePanel';

let mockGtXl = true;
let mockIsNative = false;
const mockSetLayoutState = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    display,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    display?: 'flex' | 'none';
    onPress?: () => void;
    testID?: string;
  }) {
    return onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID} hidden={display === 'none'}>
        {children}
      </div>
    );
  }

  return {
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    XStack: MockStack,
    YStack: MockStack,
    useMedia: () => ({ gtXl: mockGtXl }),
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsLayoutStateAtom: () => [{}, mockSetLayoutState],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock('../../hooks/useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({
    baseName: 'BTC',
    coin: 'BTC',
    displayName: 'BTC',
    mode: 'perp',
  }),
}));

jest.mock('../PerpCandles', () => ({
  PerpCandles: () => <div data-testid="chart" />,
}));

jest.mock('../PerpOrderBook', () => ({
  PerpOrderBook: () => <div data-testid="order-book" />,
}));

jest.mock('./PerpFundingChart', () => ({ PerpFundingChart: () => null }));
jest.mock('./PerpMarketDetailContent', () => ({
  PERP_MARKET_INFO_TAB_KEYS: ['overview'],
  PerpMarketDetailContent: () => null,
}));

describe('PerpMarketWorkspacePanel narrow order book', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGtXl = true;
    mockIsNative = false;
  });

  it('keeps the order book reachable when narrowed and restores the chart when widened', () => {
    const view = render(<PerpMarketWorkspacePanel />);
    const chart = view.getByTestId('chart');

    expect(
      view.queryByTestId('perp-market-workspace-tab-orderBook'),
    ).toBeNull();

    mockGtXl = false;
    view.rerender(<PerpMarketWorkspacePanel />);
    fireEvent.click(view.getByTestId('perp-market-workspace-tab-orderBook'));

    expect(view.getAllByTestId('order-book')).toHaveLength(1);
    expect(view.getByTestId('chart')).toBe(chart);
    expect(chart.parentElement?.hidden).toBe(true);

    fireEvent.click(view.getByTestId('perp-market-workspace-tab-chart'));
    expect(view.queryByTestId('order-book')).toBeNull();
    expect(chart.parentElement?.hidden).toBe(false);

    fireEvent.click(view.getByTestId('perp-market-workspace-tab-orderBook'));
    mockGtXl = true;
    view.rerender(<PerpMarketWorkspacePanel />);

    expect(
      view.queryByTestId('perp-market-workspace-tab-orderBook'),
    ).toBeNull();
    expect(view.queryByTestId('order-book')).toBeNull();
    expect(view.getByTestId('chart')).toBe(chart);
    expect(chart.parentElement?.hidden).toBe(false);

    mockGtXl = false;
    view.rerender(<PerpMarketWorkspacePanel />);
    expect(
      view.getByTestId('perp-market-workspace-tab-orderBook'),
    ).toBeTruthy();
    expect(view.queryByTestId('order-book')).toBeNull();
  });

  it('does not add the desktop order book entry on native', () => {
    mockGtXl = false;
    mockIsNative = true;
    const view = render(<PerpMarketWorkspacePanel />);

    expect(
      view.queryByTestId('perp-market-workspace-tab-orderBook'),
    ).toBeNull();
    expect(view.queryByTestId('order-book')).toBeNull();
  });
});
