/** @jest-environment jsdom */
import { useEffect } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MarketDesktopChartContainer } from './MarketDesktopChartContainer';

function firePointerEvent(
  element: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientY: number,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(element, event);
}

function ChartMountProbe({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <div>chart</div>;
}

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
    useTheme: () => ({
      borderActive: { val: '#00f' },
      borderSubdued: { val: '#ccc' },
    }),
  };
});

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 900, width: 1440 }),
}));

describe('MarketDesktopChartContainer', () => {
  it('adjusts height by dragging and enforces the minimum', () => {
    const handleChartMount = jest.fn();
    render(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <ChartMountProbe onMount={handleChartMount} />
      </MarketDesktopChartContainer>,
    );

    const resizeHandle = screen.getByTestId('market-chart-resize-handle');
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('360');
    Object.defineProperties(resizeHandle, {
      hasPointerCapture: { value: jest.fn(() => true) },
      releasePointerCapture: { value: jest.fn() },
      setPointerCapture: { value: jest.fn() },
    });

    firePointerEvent(resizeHandle, 'pointerdown', 400);
    firePointerEvent(resizeHandle, 'pointermove', 460);
    firePointerEvent(resizeHandle, 'pointerup', 460);
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('420');
    expect(handleChartMount).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(resizeHandle, { key: 'Home' });
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('360');
  });

  it('hides the resize handle in fullscreen and restores its height on exit', () => {
    const { rerender } = render(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>,
    );

    fireEvent.keyDown(screen.getByTestId('market-chart-resize-handle'), {
      key: 'ArrowDown',
    });

    rerender(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen>
        <div>chart</div>
      </MarketDesktopChartContainer>,
    );
    expect(screen.queryByTestId('market-chart-resize-handle')).toBeNull();

    rerender(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>,
    );
    expect(
      screen
        .getByTestId('market-chart-resize-handle')
        .getAttribute('aria-valuenow'),
    ).toBe('384');
  });
});
