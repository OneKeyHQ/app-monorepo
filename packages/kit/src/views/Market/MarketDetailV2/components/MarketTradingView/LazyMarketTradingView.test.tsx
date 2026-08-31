/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  ChartLoadingFallback,
  LazyDesktopMarketTradingView,
} from './LazyMarketTradingView';

let mockIsWeb = true;

jest.mock('@onekeyhq/components', () => ({
  Spinner: () => <div data-testid="chart-loading-spinner" />,
  Stack: ({ children }: { children?: ReactNode }) => (
    <div data-testid="chart-loading-fallback">{children}</div>
  ),
}));

jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () =>
    Object.assign(
      ({
        onChartError,
        onVisualReady,
      }: {
        onChartError?: () => void;
        onVisualReady?: () => void;
      }) => (
        <div data-testid="lazy-chart">
          <button
            aria-label="Chart visible"
            data-testid="chart-visible"
            onClick={onVisualReady}
          />
          <button
            aria-label="Chart error"
            data-testid="chart-error"
            onClick={onChartError}
          />
        </div>
      ),
      { preload: jest.fn() },
    ),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isWeb() {
      return mockIsWeb;
    },
  },
}));

describe('ChartLoadingFallback', () => {
  beforeEach(() => {
    mockIsWeb = true;
  });

  it('does not render the spinner on web while preserving the chart layout', () => {
    render(<ChartLoadingFallback minHeight={550} />);

    expect(screen.getByTestId('chart-loading-fallback')).toBeTruthy();
    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
  });

  it('shows the spinner immediately outside web', () => {
    mockIsWeb = false;

    render(<ChartLoadingFallback minHeight={240} />);

    expect(screen.getByTestId('chart-loading-spinner')).toBeTruthy();
  });
});

describe('LazyDesktopMarketTradingView web slow loading', () => {
  beforeEach(() => {
    mockIsWeb = true;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const chartProps = {
    dataSource: 'websocket' as const,
    networkId: 'sol--101',
    tokenAddress: 'token-address',
  };

  it('only shows the app spinner when the chart shell takes over 1.5 seconds', () => {
    render(<LazyDesktopMarketTradingView {...chartProps} />);

    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
    act(() => jest.advanceTimersByTime(1499));
    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('chart-loading-spinner')).toBeTruthy();

    fireEvent.click(screen.getByTestId('chart-visible'));
    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
  });

  it('never shows the app spinner when the chart shell is visible within 1.5 seconds', () => {
    render(<LazyDesktopMarketTradingView {...chartProps} />);

    act(() => jest.advanceTimersByTime(500));
    fireEvent.click(screen.getByTestId('chart-visible'));
    act(() => jest.advanceTimersByTime(1000));

    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
  });

  it('keeps the app spinner hidden when the visible chart switches tokens', () => {
    const { rerender } = render(
      <LazyDesktopMarketTradingView {...chartProps} />,
    );

    fireEvent.click(screen.getByTestId('chart-visible'));
    rerender(
      <LazyDesktopMarketTradingView
        {...chartProps}
        tokenAddress="next-token-address"
      />,
    );
    act(() => jest.advanceTimersByTime(1500));

    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
  });

  it('removes the app spinner when DOM embed falls back to iframe', () => {
    render(<LazyDesktopMarketTradingView {...chartProps} />);

    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByTestId('chart-loading-spinner')).toBeTruthy();
    fireEvent.click(screen.getByTestId('chart-error'));

    expect(screen.queryByTestId('chart-loading-spinner')).toBeNull();
  });
});
