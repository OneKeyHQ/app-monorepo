/** @jest-environment jsdom */
import { useEffect } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IMarketDesktopLayout } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

import { MarketDesktopChartContainer } from './MarketDesktopChartContainer';

let mockSavedLayout: IMarketDesktopLayout = {};
let mockViewportHeight = 900;
let mockDelayWrites = false;
let mockPendingWrites: IMarketDesktopLayout[] = [];
let mockWriteResults: { resolve: () => void; reject: () => void }[] = [];
const mockPersist = jest.fn();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketDesktopLayoutAtom: () => {
      const [, refresh] = React.useState(0);
      const set = React.useCallback(
        (update: (prev: IMarketDesktopLayout) => IMarketDesktopLayout) => {
          const next = update(mockSavedLayout);
          if (next === mockSavedLayout) {
            return undefined;
          }
          mockPersist(next);
          if (mockDelayWrites) {
            mockPendingWrites.push(next);
            return new Promise<void>((resolve, reject) => {
              mockWriteResults.push({ resolve, reject });
            });
          }
          mockSavedLayout = next;
          refresh((value) => value + 1);
          return undefined;
        },
        [],
      );
      return [mockSavedLayout, set];
    },
  };
});

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
  useWindowDimensions: () => ({ height: mockViewportHeight, width: 1440 }),
}));

describe('MarketDesktopChartContainer', () => {
  beforeEach(() => {
    mockSavedLayout = {};
    mockViewportHeight = 900;
    mockPersist.mockClear();
    mockDelayWrites = false;
    mockPendingWrites = [];
    mockWriteResults = [];
  });

  it('preserves the saved preference for clamped arrow keys but lets Home reset it', async () => {
    mockSavedLayout = { chartHeight: 900 };
    mockViewportHeight = 800;
    const chart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const { rerender } = render(chart());
    const handle = screen.getByTestId('market-chart-resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    expect(handle.getAttribute('aria-valuenow')).toBe('640');
    expect(mockSavedLayout.chartHeight).toBe(900);
    expect(mockPersist).not.toHaveBeenCalled();

    mockViewportHeight = 1200;
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('900');
    mockViewportHeight = 600;
    rerender(chart());
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    await act(async () => {});
    expect(mockSavedLayout.chartHeight).toBe(900);
    fireEvent.keyDown(handle, { key: 'Home' });
    await act(async () => {});
    expect(mockSavedLayout.chartHeight).toBe(456);
  });

  it('keeps the latest keyboard height until delayed writes catch up', async () => {
    mockDelayWrites = true;
    const chart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const { rerender } = render(chart());
    const handle = screen.getByTestId('market-chart-resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    expect(handle.getAttribute('aria-valuenow')).toBe('504');
    expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([480]);
    await act(async () => {
      mockSavedLayout = mockPendingWrites[0];
      mockWriteResults[0].resolve();
      rerender(chart());
    });
    expect(handle.getAttribute('aria-valuenow')).toBe('504');
    await act(async () => {
      mockSavedLayout = mockPendingWrites[1];
      mockWriteResults[1].resolve();
      rerender(chart());
    });
    expect(handle.getAttribute('aria-valuenow')).toBe('504');
    mockSavedLayout = { chartHeight: 600 };
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
  });

  it('does not snap back on release or let an earlier acknowledgement interrupt a new drag', async () => {
    mockDelayWrites = true;
    const chart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const { rerender } = render(chart());
    const handle = screen.getByTestId('market-chart-resize-handle');
    Object.defineProperties(handle, {
      hasPointerCapture: { value: jest.fn(() => true) },
      releasePointerCapture: { value: jest.fn() },
      setPointerCapture: { value: jest.fn() },
    });
    firePointerEvent(handle, 'pointerdown', 400);
    firePointerEvent(handle, 'pointermove', 460);
    firePointerEvent(handle, 'pointerup', 460);
    await act(async () => {});
    expect(handle.getAttribute('aria-valuenow')).toBe('516');
    firePointerEvent(handle, 'pointerdown', 460);
    firePointerEvent(handle, 'pointermove', 500);
    await act(async () => {
      mockSavedLayout = mockPendingWrites[0];
      mockWriteResults[0].resolve();
      rerender(chart());
    });
    expect(handle.getAttribute('aria-valuenow')).toBe('556');
    firePointerEvent(handle, 'pointerup', 500);
    await act(async () => {});
    expect(handle.getAttribute('aria-valuenow')).toBe('556');
    await act(async () => {
      mockSavedLayout = mockPendingWrites[1];
      mockWriteResults[1].resolve();
      rerender(chart());
    });
    expect(handle.getAttribute('aria-valuenow')).toBe('556');
    mockSavedLayout = { chartHeight: 620 };
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('620');
  });

  it('sends a return to the stale mirror after the earlier write completes', async () => {
    mockSavedLayout = { chartHeight: 456 };
    mockDelayWrites = true;
    const chart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const { rerender } = render(chart());
    const handle = screen.getByTestId('market-chart-resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    await act(async () => {});
    expect(handle.getAttribute('aria-valuenow')).toBe('456');
    await act(async () => {
      mockSavedLayout = mockPendingWrites[0];
      mockWriteResults[0].resolve();
      rerender(chart());
    });
    expect(handle.getAttribute('aria-valuenow')).toBe('456');
    expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
      480, 456,
    ]);
    await act(async () => {
      mockSavedLayout = mockPendingWrites[1];
      mockWriteResults[1].resolve();
      rerender(chart());
    });
    expect(mockSavedLayout.chartHeight).toBe(456);
    expect(handle.getAttribute('aria-valuenow')).toBe('456');
  });

  it('releases a failed save and continues with the next input', async () => {
    mockSavedLayout = { chartHeight: 456 };
    mockDelayWrites = true;
    const chart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const { rerender } = render(chart());
    const handle = screen.getByTestId('market-chart-resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    await act(async () => {
      mockWriteResults[0].reject();
    });
    expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
      480, 456,
    ]);
    await act(async () => {
      mockWriteResults[1].reject();
    });
    mockSavedLayout = { chartHeight: 600 };
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
  });

  it('releases the local override when a bridge response never arrives', async () => {
    jest.useFakeTimers();
    try {
      mockDelayWrites = true;
      const chart = () => (
        <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
          <div>chart</div>
        </MarketDesktopChartContainer>
      );
      const { rerender } = render(chart());
      const handle = screen.getByTestId('market-chart-resize-handle');
      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      await act(async () => {});
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      mockSavedLayout = { chartHeight: 600 };
      rerender(chart());
      expect(handle.getAttribute('aria-valuenow')).toBe('600');
    } finally {
      jest.useRealTimers();
    }
  });

  it('restores persisted height on remount and clamps only the display on resize', async () => {
    const chart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const first = render(chart());
    fireEvent.keyDown(screen.getByTestId('market-chart-resize-handle'), {
      key: 'ArrowDown',
    });
    await act(async () => {});
    expect(mockSavedLayout.chartHeight).toBe(480);
    first.unmount();
    const { rerender } = render(chart());
    const height = () =>
      screen
        .getByTestId('market-chart-resize-handle')
        .getAttribute('aria-valuenow');
    expect(height()).toBe('480');
    mockViewportHeight = 600;
    rerender(chart());
    expect(height()).toBe('456');
    expect(mockSavedLayout.chartHeight).toBe(480);
    mockViewportHeight = 900;
    rerender(chart());
    expect(height()).toBe('480');
  });

  it('applies late hydration without overwriting storage and rejects invalid values', async () => {
    const renderChart = () => (
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>
    );
    const { rerender } = render(renderChart());
    mockSavedLayout = { chartHeight: 700 };
    rerender(renderChart());
    expect(
      screen
        .getByTestId('market-chart-resize-handle')
        .getAttribute('aria-valuenow'),
    ).toBe('700');
    mockSavedLayout = { chartHeight: Number.NaN };
    rerender(renderChart());
    expect(
      screen
        .getByTestId('market-chart-resize-handle')
        .getAttribute('aria-valuenow'),
    ).toBe('456');
    expect(mockPersist).not.toHaveBeenCalled();
  });
  it('adjusts height by dragging and enforces the minimum', async () => {
    const handleChartMount = jest.fn();
    render(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <ChartMountProbe onMount={handleChartMount} />
      </MarketDesktopChartContainer>,
    );

    const resizeHandle = screen.getByTestId('market-chart-resize-handle');
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('456');
    Object.defineProperties(resizeHandle, {
      hasPointerCapture: { value: jest.fn(() => true) },
      releasePointerCapture: { value: jest.fn() },
      setPointerCapture: { value: jest.fn() },
    });

    firePointerEvent(resizeHandle, 'pointerdown', 400);
    firePointerEvent(resizeHandle, 'pointermove', 460);
    expect(mockPersist).not.toHaveBeenCalled();
    firePointerEvent(resizeHandle, 'pointerup', 460);
    await act(async () => {});
    expect(mockSavedLayout.chartHeight).toBe(516);
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('516');
    expect(handleChartMount).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(resizeHandle, { key: 'Home' });
    await act(async () => {});
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('456');
  });

  it('hides the resize handle in fullscreen and restores its height on exit', async () => {
    const { rerender } = render(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>,
    );

    fireEvent.keyDown(screen.getByTestId('market-chart-resize-handle'), {
      key: 'ArrowDown',
    });
    await act(async () => {});

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
    ).toBe('480');
  });
});
