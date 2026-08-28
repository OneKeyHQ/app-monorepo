/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import {
  PerpMobileTopChartContent,
  PerpMobileTopChartProvider,
  PerpMobileTopChartTicker,
} from './PerpMobileTopChartProvider';

const mockParentRender = jest.fn();
const mockNonConsumerRender = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('./TickerBar/PerpTickerBar', () => ({
  PerpTickerBar: ({
    isTopChartExpanded,
    onToggleTopChart,
    showTopChartToggle,
  }: {
    isTopChartExpanded?: boolean;
    onToggleTopChart?: () => void;
    showTopChartToggle?: boolean;
  }) => (
    <button
      aria-pressed={isTopChartExpanded}
      data-show-toggle={showTopChartToggle}
      data-testid="top-chart-toggle"
      onClick={onToggleTopChart}
      type="button"
    >
      Toggle chart
    </button>
  ),
}));

jest.mock('./PerpMobileChartPanel', () => ({
  PerpMobileTopChartPanel: ({ isExpanded }: { isExpanded: boolean }) => (
    <div data-expanded={isExpanded} data-testid="top-chart-panel" />
  ),
}));

function NonConsumer() {
  mockNonConsumerRender();
  return <div data-testid="non-consumer" />;
}

function Parent() {
  mockParentRender();
  return (
    <PerpMobileTopChartProvider isEnabled>
      <PerpMobileTopChartTicker onLayout={jest.fn()} />
      <PerpMobileTopChartContent />
      <NonConsumer />
    </PerpMobileTopChartProvider>
  );
}

describe('PerpMobileTopChartProvider', () => {
  beforeEach(() => {
    mockParentRender.mockClear();
    mockNonConsumerRender.mockClear();
  });

  it('updates only chart consumers when the top chart is toggled', () => {
    const view = render(<Parent />);

    expect(mockParentRender).toHaveBeenCalledTimes(1);
    expect(mockNonConsumerRender).toHaveBeenCalledTimes(1);
    expect(
      view.getByTestId('top-chart-panel').getAttribute('data-expanded'),
    ).toBe('false');

    fireEvent.click(view.getByTestId('top-chart-toggle'));

    expect(mockParentRender).toHaveBeenCalledTimes(1);
    expect(mockNonConsumerRender).toHaveBeenCalledTimes(1);
    expect(
      view.getByTestId('top-chart-panel').getAttribute('data-expanded'),
    ).toBe('true');
  });

  it('hides the top chart controls when the preference is not top', () => {
    const view = render(
      <PerpMobileTopChartProvider isEnabled={false}>
        <PerpMobileTopChartTicker onLayout={jest.fn()} />
        <PerpMobileTopChartContent />
      </PerpMobileTopChartProvider>,
    );

    expect(
      view.getByTestId('top-chart-toggle').getAttribute('data-show-toggle'),
    ).toBe('false');
    expect(view.queryByTestId('top-chart-panel')).toBeNull();
  });

  it('resets the expanded state after switching away from top', () => {
    const view = render(
      <PerpMobileTopChartProvider isEnabled>
        <PerpMobileTopChartTicker onLayout={jest.fn()} />
        <PerpMobileTopChartContent />
      </PerpMobileTopChartProvider>,
    );

    fireEvent.click(view.getByTestId('top-chart-toggle'));
    expect(
      view.getByTestId('top-chart-panel').getAttribute('data-expanded'),
    ).toBe('true');

    view.rerender(
      <PerpMobileTopChartProvider isEnabled={false}>
        <PerpMobileTopChartTicker onLayout={jest.fn()} />
        <PerpMobileTopChartContent />
      </PerpMobileTopChartProvider>,
    );
    view.rerender(
      <PerpMobileTopChartProvider isEnabled>
        <PerpMobileTopChartTicker onLayout={jest.fn()} />
        <PerpMobileTopChartContent />
      </PerpMobileTopChartProvider>,
    );

    expect(
      view.getByTestId('top-chart-panel').getAttribute('data-expanded'),
    ).toBe('false');
  });
});
