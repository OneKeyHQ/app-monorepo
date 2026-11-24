/** @jest-environment jsdom */
// cspell:ignore macd

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { createTradingViewNativeSubIndicatorRenderSnapshots } from '../utils/subIndicatorRender/pipeline';

import { IndicatorPaneHandles } from './IndicatorPaneHandles';
import { useIndicatorPanes } from './useIndicatorPanes';

const CHART_HEIGHT = 300;
const PREFERENCES_KEY = 'trading-view-indicator-panes:v1:chart';

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

jest.mock('@onekeyhq/components', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({
      children,
      onLayout,
    }: {
      children?: ReactNode;
      onLayout?: (event: {
        nativeEvent: { layout: { height: number } };
      }) => void;
    }) => {
      const reportLayout = react.useRef(onLayout);
      reportLayout.current = onLayout;
      // jsdom lays nothing out, so report the chart height once mounted.
      react.useEffect(() => {
        reportLayout.current?.({ nativeEvent: { layout: { height: 300 } } });
      }, []);
      return <div>{children}</div>;
    },
    useTheme: () => ({
      bgApp: { val: '#ffffff' },
      borderActive: { val: '#000000' },
      borderSubdued: { val: '#cccccc' },
      textSubdued: { val: '#666666' },
    }),
  };
});

const panes = createTradingViewNativeSubIndicatorRenderSnapshots({
  configs: [
    { id: 'volume', indicator: 'VOL' },
    { id: 'macd', indicator: 'MACD' },
    { id: 'rsi', indicator: 'RSI' },
  ],
  points: [],
}).map(({ pane }) => pane);

function Chart() {
  const controller = useIndicatorPanes(panes, 'chart', CHART_HEIGHT);
  return <IndicatorPaneHandles controller={controller} timeAxisHeight={24} />;
}

const stored = new Map<string, string>();
const originalPointerEvent = globalThis.PointerEvent;
const POINTER_CAPTURE_METHODS = [
  'setPointerCapture',
  'releasePointerCapture',
] as const;
const originalPointerCapture = POINTER_CAPTURE_METHODS.map((name) =>
  Object.getOwnPropertyDescriptor(Element.prototype, name),
);

// jsdom has no PointerEvent or pointer capture, and the handle reads the
// pressed button and the pointer position.
beforeAll(() => {
  globalThis.PointerEvent =
    MouseEvent as unknown as typeof globalThis.PointerEvent;
  for (const name of POINTER_CAPTURE_METHODS) {
    Object.defineProperty(Element.prototype, name, {
      configurable: true,
      value: () => undefined,
    });
  }
});

afterAll(() => {
  globalThis.PointerEvent = originalPointerEvent;
  POINTER_CAPTURE_METHODS.forEach((name, index) => {
    const descriptor = originalPointerCapture[index];
    if (descriptor) {
      Object.defineProperty(Element.prototype, name, descriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, name);
    }
  });
});

beforeEach(() => {
  stored.clear();
  // 'volume' was dragged over all 180px the panes have in a 300px chart
  // before 'macd' and 'rsi' were added: 108 / 36 / 36px are on show.
  stored.set(
    PREFERENCES_KEY,
    JSON.stringify({
      order: [],
      heights: { volume: 180 },
      referenceHeight: CHART_HEIGHT,
    }),
  );
  jest
    .mocked(appStorage.getItem)
    .mockReset()
    .mockImplementation(async (key) => stored.get(key) ?? null);
  jest
    .mocked(appStorage.setItem)
    .mockReset()
    .mockImplementation(async (key, value) => {
      stored.set(key, value);
    });
});

async function renderChart() {
  render(<Chart />);
  await waitFor(() =>
    expect(screen.getByTestId('indicator-pane-resize-VOL').style.top).toBe(
      '91px',
    ),
  );
}

const topOf = (indicator: string) =>
  screen.getByTestId(`indicator-pane-resize-${indicator}`).style.top;

/** Presses the boundary above a pane; `move` takes offsets from that press. */
function press(indicator: string) {
  const handle = screen.getByTestId(`indicator-pane-resize-${indicator}`);
  const start = 200;
  let offset = 0;
  act(() => {
    fireEvent.pointerDown(handle, { button: 0, clientY: start });
  });
  const gesture = {
    move: (delta: number) => {
      offset = delta;
      act(() => {
        fireEvent.pointerMove(handle, { clientY: start + offset });
      });
      return gesture;
    },
    release: () =>
      act(() => {
        fireEvent.pointerUp(handle, { clientY: start + offset });
      }),
  };
  return gesture;
}

/** Saves are queued, so let a pending one reach the storage. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });

it('saves the heights a drag ends on', async () => {
  await renderChart();
  press('VOL').move(30).release();
  expect(topOf('VOL')).toBe('121px');
  await waitFor(() => expect(appStorage.setItem).toHaveBeenCalledTimes(1));
  expect(JSON.parse(stored.get(PREFERENCES_KEY) ?? '{}')).toEqual({
    order: [],
    heights: { volume: 78, macd: 36, rsi: 36 },
    referenceHeight: CHART_HEIGHT,
  });
});

it('saves nothing when the boundary cannot move', async () => {
  await renderChart();
  // The price chart is at its minimum height, so the stack cannot grow.
  press('VOL').move(-30).release();
  // 'macd' and 'rsi' are both at their minimum height.
  press('RSI').move(-10).release();
  press('RSI').move(10).release();
  await settle();
  expect(topOf('VOL')).toBe('91px');
  expect(topOf('RSI')).toBe('235px');
  expect(appStorage.setItem).not.toHaveBeenCalled();
  // The 180px saved for 'volume' are still there for when it is alone again.
  expect(JSON.parse(stored.get(PREFERENCES_KEY) ?? '{}').heights).toEqual({
    volume: 180,
  });
});

it('drops the preview of a boundary dragged back to where it started', async () => {
  await renderChart();
  const gesture = press('VOL').move(30);
  expect(topOf('VOL')).toBe('121px');
  // Past the start: the price chart's minimum holds the boundary there.
  gesture.move(-30);
  expect(topOf('VOL')).toBe('91px');
  gesture.release();
  await settle();
  expect(topOf('VOL')).toBe('91px');
  expect(appStorage.setItem).not.toHaveBeenCalled();
});

it('keeps a reset made while another boundary is held', async () => {
  await renderChart();
  // The price chart is at its minimum height, so this drag resizes nothing.
  const held = press('VOL');
  // A second pointer double-presses another boundary: back to the defaults.
  press('RSI').release();
  press('RSI').release();
  await waitFor(() => expect(topOf('VOL')).toBe('103px'));
  held.move(-30).release();
  await settle();
  // The held drag left no preview, so it has nothing of its own to undo.
  expect(topOf('VOL')).toBe('103px');
  expect(JSON.parse(stored.get(PREFERENCES_KEY) ?? '{}').heights).toEqual({});
});
