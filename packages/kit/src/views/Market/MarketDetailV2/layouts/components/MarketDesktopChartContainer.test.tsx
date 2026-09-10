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
    YStack: ({
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

  it('waits for the matching UI broadcast after the write promise resolves', async () => {
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
    await act(async () => {
      mockWriteResults[0].resolve();
    });
    expect(handle.getAttribute('aria-valuenow')).toBe('480');
    expect(mockSavedLayout.chartHeight).toBe(456);
    mockSavedLayout = mockPendingWrites[0];
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('480');
    mockSavedLayout = { chartHeight: 600 };
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
  });

  it('does not acknowledge a return-to-start input from a stale equal height', async () => {
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
      mockWriteResults[0].resolve();
    });
    await act(async () => {
      mockWriteResults[1].resolve();
    });
    mockSavedLayout = mockPendingWrites[0];
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('456');
    mockSavedLayout = mockPendingWrites[1];
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('456');
    mockSavedLayout = { chartHeight: 600 };
    rerender(chart());
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
  });

  it.each([false, true])(
    'repairs a timed-out write that lands after the latest save (unmounted: %s)',
    async (unmounted) => {
      jest.useFakeTimers();
      try {
        mockDelayWrites = true;
        const chart = () => (
          <MarketDesktopChartContainer
            testID="market-chart"
            isFullscreen={false}
          >
            <div>chart</div>
          </MarketDesktopChartContainer>
        );
        const { rerender, unmount } = render(chart());
        const handle = screen.getByTestId('market-chart-resize-handle');
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        await act(async () => {});
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        await act(async () => {
          jest.advanceTimersByTime(5000);
        });
        await act(async () => {
          mockSavedLayout = mockPendingWrites[1];
          mockWriteResults[1].resolve();
          rerender(chart());
        });
        expect(mockSavedLayout.chartHeight).toBe(504);
        if (unmounted) {
          unmount();
        }
        await act(async () => {
          mockSavedLayout = mockPendingWrites[0];
          mockWriteResults[0].resolve();
          if (!unmounted) {
            rerender(chart());
          }
        });
        expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
          480, 504, 504,
        ]);
        if (!unmounted) {
          expect(handle.getAttribute('aria-valuenow')).toBe('504');
        }
        await act(async () => {
          mockSavedLayout = mockPendingWrites[2];
          mockWriteResults[2].resolve();
          if (!unmounted) {
            rerender(chart());
          }
        });
        expect(mockSavedLayout.chartHeight).toBe(504);
        act(() => {
          jest.runAllTicks();
        });
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('repairs an unmounted instance after a new chart saves, even before timeout', async () => {
    mockDelayWrites = true;
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
    first.unmount();
    const second = render(chart());
    const handle = screen.getByTestId('market-chart-resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    await act(async () => {
      mockSavedLayout = mockPendingWrites[1];
      mockWriteResults[1].resolve();
      second.rerender(chart());
    });
    await act(async () => {
      mockSavedLayout = mockPendingWrites[0];
      mockWriteResults[0].resolve();
      second.rerender(chart());
    });
    expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
      480, 504, 504,
    ]);
    expect(mockPendingWrites[2]).toEqual(mockPendingWrites[1]);
    expect(handle.getAttribute('aria-valuenow')).toBe('504');
    await act(async () => {
      mockSavedLayout = mockPendingWrites[2];
      mockWriteResults[2].resolve();
      second.rerender(chart());
    });
    second.unmount();
    render(chart());
    expect(
      screen
        .getByTestId('market-chart-resize-handle')
        .getAttribute('aria-valuenow'),
    ).toBe('504');
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'releases an adopted failed repair (origin unmounted: %s, previously accepted: %s)',
    async (unmounted, accepted) => {
      mockDelayWrites = true;
      const chart = (id: string) => (
        <MarketDesktopChartContainer testID={id} isFullscreen={false}>
          <div>chart</div>
        </MarketDesktopChartContainer>
      );
      const first = render(chart('first'));
      fireEvent.keyDown(screen.getByTestId('first-resize-handle'), {
        key: 'ArrowDown',
      });
      await act(async () => {});
      const second = render(chart('second'));
      fireEvent.keyDown(screen.getByTestId('second-resize-handle'), {
        key: 'ArrowDown',
      });
      fireEvent.keyDown(screen.getByTestId('second-resize-handle'), {
        key: 'ArrowDown',
      });
      await act(async () => {});
      if (unmounted) second.unmount();
      await act(async () => {
        if (accepted) {
          mockWriteResults[1].resolve();
        } else {
          mockWriteResults[1].reject();
        }
      });
      await act(async () => {
        mockSavedLayout = mockPendingWrites[0];
        mockWriteResults[0].resolve();
        first.rerender(chart('first'));
      });
      expect(
        screen.getByTestId('first-resize-handle').getAttribute('aria-valuenow'),
      ).toBe('504');
      await act(async () => {
        mockWriteResults[2].reject();
      });
      mockSavedLayout = { chartHeight: 600 };
      first.rerender(chart('first'));
      expect(
        screen.getByTestId('first-resize-handle').getAttribute('aria-valuenow'),
      ).toBe('600');
      if (!unmounted) {
        second.rerender(chart('second'));
        expect(
          screen
            .getByTestId('second-resize-handle')
            .getAttribute('aria-valuenow'),
        ).toBe('600');
      }
    },
  );

  it.each([false, true])(
    'retries an adopted repair once when the broadcast is lost (origin unmounted: %s)',
    async (unmounted) => {
      jest.useFakeTimers();
      try {
        mockDelayWrites = true;
        const chart = (id: string) => (
          <MarketDesktopChartContainer testID={id} isFullscreen={false}>
            <div>chart</div>
          </MarketDesktopChartContainer>
        );
        const first = render(chart('first'));
        fireEvent.keyDown(screen.getByTestId('first-resize-handle'), {
          key: 'ArrowDown',
        });
        await act(async () => {});
        const second = render(chart('second'));
        fireEvent.keyDown(screen.getByTestId('second-resize-handle'), {
          key: 'ArrowDown',
        });
        fireEvent.keyDown(screen.getByTestId('second-resize-handle'), {
          key: 'ArrowDown',
        });
        await act(async () => {});
        await act(async () => {
          mockWriteResults[1].resolve();
        });
        if (unmounted) second.unmount();
        await act(async () => {
          mockSavedLayout = mockPendingWrites[0];
          mockWriteResults[0].resolve();
          first.rerender(chart('first'));
        });
        await act(async () => {
          mockWriteResults[2].resolve();
        });
        await act(async () => {
          jest.advanceTimersByTime(5000);
        });
        expect(mockPendingWrites).toHaveLength(4);
        expect(mockPendingWrites[3]).toEqual(mockPendingWrites[1]);
        await act(async () => {
          mockSavedLayout = mockPendingWrites[3];
          mockWriteResults[3].resolve();
          first.rerender(chart('first'));
        });
        mockSavedLayout = { chartHeight: 600 };
        first.rerender(chart('first'));
        expect(
          screen
            .getByTestId('first-resize-handle')
            .getAttribute('aria-valuenow'),
        ).toBe('600');
        await act(async () => {
          jest.advanceTimersByTime(60_000);
        });
        expect(mockPendingWrites).toHaveLength(4);
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('stops repairing when every bridge write, including repairs, takes eight seconds', async () => {
    jest.useFakeTimers();
    try {
      mockDelayWrites = true;
      const chart = () => (
        <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
          <div>chart</div>
        </MarketDesktopChartContainer>
      );
      const { rerender, unmount } = render(chart());
      const handle = screen.getByTestId('market-chart-resize-handle');
      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      await act(async () => {});
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      expect(handle.getAttribute('aria-valuenow')).toBe('504');
      await act(async () => {
        jest.advanceTimersByTime(3000);
        mockSavedLayout = mockPendingWrites[0];
        mockWriteResults[0].resolve();
        rerender(chart());
      });
      expect(mockPendingWrites).toHaveLength(3);
      expect(mockPendingWrites[2]).toEqual(mockPendingWrites[1]);
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(handle.getAttribute('aria-valuenow')).toBe('504');
      await act(async () => {
        mockSavedLayout = mockPendingWrites[1];
        mockWriteResults[1].resolve();
        rerender(chart());
      });
      unmount();
      await act(async () => {
        jest.advanceTimersByTime(3000);
        mockSavedLayout = mockPendingWrites[2];
        mockWriteResults[2].resolve();
      });
      expect(mockPendingWrites[3]).toEqual(mockPendingWrites[1]);
      await act(async () => {
        jest.advanceTimersByTime(5000);
        mockSavedLayout = mockPendingWrites[3];
        mockWriteResults[3].resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(mockPendingWrites).toHaveLength(4);
      expect(mockSavedLayout.chartHeight).toBe(504);
      act(() => {
        jest.runAllTicks();
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([false, true])(
    'retries a missing broadcast once and keeps the chosen height (retry fails: %s)',
    async (retryFails) => {
      jest.useFakeTimers();
      try {
        mockDelayWrites = true;
        const chart = () => (
          <MarketDesktopChartContainer
            testID="market-chart"
            isFullscreen={false}
          >
            <div>chart</div>
          </MarketDesktopChartContainer>
        );
        const { rerender } = render(chart());
        const handle = screen.getByTestId('market-chart-resize-handle');
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        await act(async () => {});
        await act(async () => {
          mockWriteResults[0].resolve();
        });
        expect(handle.getAttribute('aria-valuenow')).toBe('480');
        await act(async () => {
          jest.advanceTimersByTime(5000);
        });
        expect(handle.getAttribute('aria-valuenow')).toBe('480');
        expect(mockPendingWrites).toHaveLength(2);
        expect(mockPendingWrites[1]).toEqual(mockPendingWrites[0]);
        await act(async () => {
          if (retryFails) {
            mockWriteResults[1].reject();
          } else {
            mockWriteResults[1].resolve();
          }
          jest.advanceTimersByTime(60_000);
        });
        expect(mockPendingWrites).toHaveLength(2);
        expect(handle.getAttribute('aria-valuenow')).toBe('480');
        if (retryFails) {
          mockSavedLayout = {
            chartHeight: 600,
            chartHeightUpdateId: 'external-save',
          };
          rerender(chart());
          expect(handle.getAttribute('aria-valuenow')).toBe('600');
        }
      } finally {
        jest.useRealTimers();
      }
    },
  );

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

  it('releases the queue and saves later input when a bridge response never arrives', async () => {
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
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      mockSavedLayout = { chartHeight: 600 };
      rerender(chart());
      expect(handle.getAttribute('aria-valuenow')).toBe('480');
      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      await act(async () => {});
      expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
        480, 504,
      ]);
      await act(async () => {
        mockWriteResults[0].reject();
      });
      expect(handle.getAttribute('aria-valuenow')).toBe('504');
      await act(async () => {
        mockSavedLayout = mockPendingWrites[1];
        mockWriteResults[1].resolve();
        rerender(chart());
      });
      expect(mockSavedLayout.chartHeight).toBe(504);
      act(() => {
        jest.runAllTicks();
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('coalesces a keyboard burst and keeps the latest input through a stalled write', async () => {
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
      for (let index = 0; index < 5; index += 1) {
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
      }
      expect(handle.getAttribute('aria-valuenow')).toBe('600');
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(handle.getAttribute('aria-valuenow')).toBe('600');
      expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
        480, 600,
      ]);
      await act(async () => {
        mockSavedLayout = mockPendingWrites[1];
        mockWriteResults[1].resolve();
        rerender(chart());
      });
      expect(mockSavedLayout.chartHeight).toBe(600);
      act(() => {
        jest.runAllTicks();
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('still dispatches the latest queued preference after unmount', async () => {
    mockDelayWrites = true;
    const { unmount } = render(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen={false}>
        <div>chart</div>
      </MarketDesktopChartContainer>,
    );
    const handle = screen.getByTestId('market-chart-resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    await act(async () => {});
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    unmount();
    await act(async () => {
      mockWriteResults[0].resolve();
    });
    expect(mockPendingWrites.map((value) => value.chartHeight)).toEqual([
      480, 504,
    ]);
    await act(async () => {
      mockWriteResults[1].resolve();
    });
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

  it('keeps the chart mounted across a fullscreen toggle, footer or not', () => {
    const handleChartMount = jest.fn();
    const footer = <div data-testid="market-chart-footer">toolbar</div>;
    const { rerender } = render(
      <MarketDesktopChartContainer
        testID="market-chart"
        isFullscreen={false}
        footer={footer}
      >
        <ChartMountProbe onMount={handleChartMount} />
      </MarketDesktopChartContainer>,
    );
    expect(handleChartMount).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('market-chart-footer')).toBeTruthy();

    // The caller drops its toolbar in fullscreen, so the footer goes from a
    // node to undefined at the same time. Neither may change the element the
    // chart hangs off: a remount costs the user their zoom and pan.
    rerender(
      <MarketDesktopChartContainer testID="market-chart" isFullscreen>
        <ChartMountProbe onMount={handleChartMount} />
      </MarketDesktopChartContainer>,
    );
    expect(handleChartMount).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('market-chart-footer')).toBeNull();

    rerender(
      <MarketDesktopChartContainer
        testID="market-chart"
        isFullscreen={false}
        footer={footer}
      >
        <ChartMountProbe onMount={handleChartMount} />
      </MarketDesktopChartContainer>,
    );
    expect(handleChartMount).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('market-chart-footer')).toBeTruthy();
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
