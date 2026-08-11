/**
 * @jest-environment jsdom
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';

import {
  clearTradingViewNativeDebugEvents,
  emitTradingViewNativeDebugEvent,
} from './data/tradingViewNativeDebugLogger';
import { TradingViewNativeDebugPanel } from './TradingViewNativeDebugPanel';

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const mockDevSettings: {
    enabled: boolean;
    settings: { showTradingViewNativeDebugPanel?: boolean };
  } = {
    enabled: true,
    settings: { showTradingViewNativeDebugPanel: true },
  };
  return {
    mockDevSettings,
    useDevSettingsPersistAtom: () => {
      const [value, setValue] = React.useState(mockDevSettings);
      const setPersistedValue = React.useCallback(
        (
          updater: (previous: typeof mockDevSettings) => typeof mockDevSettings,
        ) => {
          setValue((previous) => {
            const next = updater(previous);
            Object.assign(mockDevSettings, next);
            return next;
          });
        },
        [],
      );
      return [value, setPersistedValue];
    },
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
    isWeb: true,
  },
}));

const mockDevSettings = jest.requireMock(
  '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings',
).mockDevSettings as {
  enabled: boolean;
  settings: { showTradingViewNativeDebugPanel?: boolean };
};
const mockPlatformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv')
  .default as {
  isDev: boolean;
  isWeb: boolean;
};
const mockWriteClipboardText = jest.fn<Promise<void>, [string]>();
const originalResizeObserver = globalThis.ResizeObserver;
let triggerResizeObserver: (() => void) | undefined;

describe('TradingViewNativeDebugPanel', () => {
  beforeEach(() => {
    mockDevSettings.enabled = true;
    mockDevSettings.settings = { showTradingViewNativeDebugPanel: true };
    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isWeb = true;
    clearTradingViewNativeDebugEvents();
    globalThis.localStorage.clear();
    Object.defineProperty(globalThis, 'innerHeight', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(globalThis, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });
    triggerResizeObserver = undefined;
    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        triggerResizeObserver = () => callback([], this);
      }

      observe() {}

      unobserve() {}

      disconnect() {}
    };
    mockWriteClipboardText.mockReset().mockResolvedValue();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockWriteClipboardText,
      },
    });
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('shows chart events at the highest development overlay layer', () => {
    emitTradingViewNativeDebugEvent({
      details: {
        historySource: 'fallback',
        points: 120,
      },
      level: 'warning',
      name: 'history.response',
    });

    render(<TradingViewNativeDebugPanel />);

    const panel = screen.getByTestId('trading-view-native-debug-panel');
    expect(panel.style.zIndex).toBe(
      DEV_OVERLAY_FLOAT_BUTTON_Z_INDEX.toString(),
    );
    expect(screen.getByText(/history\.response/)).toBeTruthy();
    expect(screen.getByText(/historySource=fallback/)).toBeTruthy();
    expect(screen.getByText(/points=120/)).toBeTruthy();

    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByText('Waiting for chart events…')).toBeTruthy();
  });

  it('can be dragged and persists its position', () => {
    render(<TradingViewNativeDebugPanel />);
    const panel = screen.getByTestId('trading-view-native-debug-panel');
    const dragHandle = screen.getByTestId(
      'trading-view-native-debug-panel-drag-handle',
    );
    const initialLeft = Number.parseFloat(panel.style.left);
    const initialTop = Number.parseFloat(panel.style.top);

    fireEvent.pointerDown(dragHandle, {
      clientX: initialLeft + 20,
      clientY: initialTop + 20,
      pointerId: 1,
    });
    fireEvent.pointerMove(dragHandle, {
      clientX: initialLeft - 80,
      clientY: initialTop + 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(dragHandle, {
      clientX: initialLeft - 80,
      clientY: initialTop + 100,
      pointerId: 1,
    });

    expect(Number.parseFloat(panel.style.left)).toBeLessThan(initialLeft);
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(initialTop);
    expect(
      globalThis.localStorage.getItem(
        'trading_view_native_debug_panel_position',
      ),
    ).toBeTruthy();
  });

  it('copies the complete event log as plain text', async () => {
    emitTradingViewNativeDebugEvent({
      details: {
        historySource: 'fallback',
        points: 120,
      },
      level: 'warning',
      name: 'history.response',
    });
    render(<TradingViewNativeDebugPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy event log' }));

    await waitFor(() => {
      expect(mockWriteClipboardText).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Copied')).toBeTruthy();
    });
    const copiedText = mockWriteClipboardText.mock.calls[0][0];
    expect(copiedText).toMatch(
      /^\d{4}-\d{2}-\d{2}T.* \[WARNING\] history\.response /,
    );
    expect(copiedText).toContain('historySource=fallback');
    expect(copiedText).toContain('points=120');
  });

  it('shows a failure state when clipboard access fails', async () => {
    mockWriteClipboardText.mockRejectedValueOnce(
      new Error('Clipboard unavailable'),
    );
    emitTradingViewNativeDebugEvent({ name: 'chart.mount' });
    render(<TradingViewNativeDebugPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy event log' }));

    await waitFor(() => expect(screen.getByText('Failed')).toBeTruthy());
  });

  it('uses native resize and persists the observed size', () => {
    render(<TradingViewNativeDebugPanel />);
    const panel = screen.getByTestId('trading-view-native-debug-panel');
    expect(panel.style.resize).toBe('both');
    expect(panel.style.minHeight).toBe('180px');
    expect(panel.style.minWidth).toBe('300px');

    jest.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: 0,
      height: 240,
      left: 0,
      right: 0,
      toJSON: () => ({}),
      top: 0,
      width: 340,
      x: 0,
      y: 0,
    });
    act(() => triggerResizeObserver?.());

    expect(panel.style.height).toBe('240px');
    expect(panel.style.width).toBe('340px');
    expect(
      globalThis.localStorage.getItem('trading_view_native_debug_panel_size'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse event log' }));
    expect(panel.style.resize).toBe('none');
  });

  it('does not force the event list to the bottom after the user scrolls up', () => {
    emitTradingViewNativeDebugEvent({ name: 'chart.mount' });
    render(<TradingViewNativeDebugPanel />);

    const eventList = screen.getByTestId(
      'trading-view-native-debug-event-list',
    );
    let scrollHeight = 1000;
    Object.defineProperty(eventList, 'clientHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(eventList, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    eventList.scrollTop = 300;
    fireEvent.scroll(eventList);

    scrollHeight = 1100;
    act(() => {
      emitTradingViewNativeDebugEvent({ name: 'history.response' });
    });

    expect(eventList.scrollTop).toBe(300);

    eventList.scrollTop = scrollHeight - eventList.clientHeight;
    fireEvent.scroll(eventList);
    scrollHeight = 1200;
    act(() => {
      emitTradingViewNativeDebugEvent({ name: 'realtime.update' });
    });

    expect(eventList.scrollTop).toBe(scrollHeight);
  });

  it('closes the panel and persists the developer setting', () => {
    const { unmount } = render(<TradingViewNativeDebugPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Close event log' }));

    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
    expect(mockDevSettings.settings.showTradingViewNativeDebugPanel).toBe(
      false,
    );

    unmount();
    render(<TradingViewNativeDebugPanel />);
    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
  });

  it('defaults the panel to visible when the setting is missing', () => {
    mockDevSettings.settings = {};
    render(<TradingViewNativeDebugPanel />);

    expect(screen.getByTestId('trading-view-native-debug-panel')).toBeTruthy();
  });

  it('stays hidden when developer mode is disabled', () => {
    mockDevSettings.enabled = false;
    render(<TradingViewNativeDebugPanel />);

    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
  });

  it('stays hidden outside a local Web development build', () => {
    mockPlatformEnv.isDev = false;
    render(<TradingViewNativeDebugPanel />);

    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
  });
});
