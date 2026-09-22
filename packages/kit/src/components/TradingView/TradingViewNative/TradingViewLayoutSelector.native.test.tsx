/**
 * @jest-environment jsdom
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewLayoutSelector } from './TradingViewLayoutSelector.native';

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
    onPress,
    accessibilityState,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    accessibilityState?: { selected?: boolean };
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        aria-pressed={accessibilityState?.selected}
        onClick={onPress}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Stack,
    XStack: Stack,
    SizableText: ({ children }: { children?: ReactNode }) => children,
    useTheme: () => ({ iconSubdued: { val: '#808080' } }),
  };
});

jest.mock('./TradingViewPanelIcon', () => ({
  TradingViewPanelIcon: () => null,
}));

function FullscreenChart() {
  const [panelCount, setPanelCount] = useState(1);
  return (
    <div data-testid="fullscreen-chart-host">
      <TradingViewLayoutSelector
        title="Chart layout"
        panelCount={panelCount}
        icon="single"
        onChange={setPanelCount}
      />
      <div data-testid="chart-count">{panelCount}</div>
    </div>
  );
}

describe('native chart layout menu', () => {
  it('opens and changes layouts inside the existing fullscreen host', () => {
    render(<FullscreenChart />);
    const host = screen.getByTestId('fullscreen-chart-host');
    const trigger = screen.getByTestId('trading-view-chart-layout-trigger');

    [4, 2, 1].forEach((count) => {
      fireEvent.click(trigger);
      const menu = screen.getByTestId('trading-view-chart-layout-menu');
      expect(host.contains(menu)).toBe(true);
      fireEvent.click(
        screen.getByTestId(`trading-view-chart-layout-option-${count}`),
      );
      expect(screen.getByTestId('chart-count').textContent).toBe(String(count));
      expect(screen.queryByTestId('trading-view-chart-layout-menu')).toBeNull();
      expect(screen.getByTestId('fullscreen-chart-host')).toBe(host);
    });
  });

  it('marks the current layout and dismisses without changing it', () => {
    const onChange = jest.fn();
    render(
      <TradingViewLayoutSelector
        title="Chart layout"
        panelCount={2}
        icon="columns"
        onChange={onChange}
      />,
    );
    const trigger = screen.getByTestId('trading-view-chart-layout-trigger');
    fireEvent.click(trigger);
    expect(
      screen
        .getByTestId('trading-view-chart-layout-option-2')
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(trigger);
    expect(screen.queryByTestId('trading-view-chart-layout-menu')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
