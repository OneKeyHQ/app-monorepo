/** @jest-environment jsdom */

import type { PointerEvent } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { getTradingViewNativeChartLayout } from '../../utils/chartLayout';
import { createTradingViewNativeChartRuntimeState } from '../../utils/chartRuntime';
import { buildTradingViewNativeChartScene } from '../../utils/chartScene';

import { DEFAULT_DRAWING_STYLE, drawingPointToScreen } from './model';
import { useChartDrawings } from './useChartDrawings';

import type { IDrawing, IDrawingProjection } from './model';

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
const getItem = jest.mocked(appStorage.getItem);
const setItem = jest.mocked(appStorage.setItem);
const stored = new Map<string, string>();

function setup(storageKey = 'ASTER', enabled = true) {
  const points = Array.from({ length: 50 }, (_, index) => ({
    t: 1_700_000_000 + index * 60,
    o: 100,
    h: 120,
    l: 90,
    c: 110,
    v: 10,
  }));
  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds: 60,
    height: 400,
    width: 800,
    hasVolume: false,
    minimumTimeTickIndexSpacing: 1,
    points,
    priceAxisWidth: 60,
    priceRangeScale: 1,
    priceScaleMode: 'linear',
    visiblePointRange: { startIndex: 0, endIndex: 50 },
  });
  if (!layout) throw new OneKeyLocalError('Missing chart layout');
  const projection: IDrawingProjection = {
    layout,
    points,
    interval: 60,
    viewport: createTradingViewNativeChartRuntimeState({}).viewport,
  };
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  root.append(canvas);
  Object.defineProperties(canvas, {
    setPointerCapture: { value: jest.fn() },
    releasePointerCapture: { value: jest.fn() },
    hasPointerCapture: { value: () => false },
  });
  const options = {
    storageKey,
    enabled,
    projectionRef: { current: projection },
    redrawRef: { current: jest.fn() },
    rootRef: { current: root },
  };
  const hook = renderHook((props) => useChartDrawings(props), {
    initialProps: options,
  });
  const event = (
    type: string,
    x: number,
    y: number,
    extra: Partial<PointerEvent<HTMLCanvasElement>> = {},
  ) =>
    ({
      type,
      clientX: x,
      clientY: y,
      currentTarget: canvas,
      button: 0,
      pointerId: 1,
      preventDefault: jest.fn(),
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      ...extra,
    }) as unknown as PointerEvent<HTMLCanvasElement>;
  const line = (offsetY = 0) => {
    void act(() => hook.result.current.selectTool('trend'));
    void act(() => {
      hook.result.current.onPointerDown(
        event('pointerdown', 200, 200 + offsetY),
      );
      hook.result.current.onPointerUp(event('pointerup', 200, 200 + offsetY));
    });
    void act(() =>
      hook.result.current.onPointerMove(
        event('pointermove', 400, 120 + offsetY),
      ),
    );
    void act(() =>
      hook.result.current.onPointerDown(
        event('pointerdown', 400, 120 + offsetY),
      ),
    );
  };
  return { ...hook, event, line, projection, options };
}

beforeEach(() => {
  stored.clear();
  getItem
    .mockReset()
    .mockImplementation(async (key) => stored.get(key) ?? null);
  setItem.mockReset().mockImplementation(async (key, value) => {
    stored.set(key, value);
  });
});

it.each([false, true])(
  'keeps the ruler temporary, including shift-drag: %s',
  async (shiftKey) => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    if (!shiftKey) void act(() => hook.result.current.selectTool('measure'));
    act(() => {
      hook.result.current.onPointerDown(
        hook.event('pointerdown', 200, 120, { shiftKey }),
      );
      hook.result.current.onPointerMove(
        hook.event('pointermove', 400, 220, { shiftKey }),
      );
      hook.result.current.onPointerUp(
        hook.event('pointerup', 400, 220, { shiftKey }),
      );
    });
    expect(hook.result.current.getRenderState().drawings).toHaveLength(1);
    expect(hook.result.current.getRenderState().drawings[0].tool).toBe(
      'measure',
    );
    expect(hook.result.current.state.history.present).toEqual([]);
    expect(hook.result.current.state.tool).toBe('cursor');
    expect(setItem).not.toHaveBeenCalled();
    void act(() =>
      hook.result.current.onPointerDown(hook.event('pointerdown', 500, 200)),
    );
    expect(hook.result.current.getRenderState().drawings).toEqual([]);
  },
);

it('persists range styles and keeps brush defaults separate from text and line defaults', async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  act(() => hook.result.current.selectTool('highlighter'));
  expect(hook.result.current.state.style).toMatchObject({
    color: '#FFEB3B',
    width: 4,
    opacity: 0.5,
  });
  act(() =>
    hook.result.current.changeStyle({ color: '#112233', opacity: 0.3 }),
  );
  act(() => hook.result.current.selectTool('text'));
  expect(hook.result.current.state.style).toMatchObject({
    color: '#2962FF',
    fontSize: 20,
  });
  act(() => hook.result.current.selectTool('highlighter'));
  expect(hook.result.current.state.style).toMatchObject({
    color: '#112233',
    opacity: 0.3,
  });
  act(() => hook.result.current.selectTool('datePriceRange'));
  act(() => {
    hook.result.current.onPointerDown(hook.event('pointerdown', 200, 120));
    hook.result.current.onPointerMove(hook.event('pointermove', 400, 220));
    hook.result.current.onPointerUp(hook.event('pointerup', 400, 220));
  });
  act(() =>
    hook.result.current.changeStyle({
      showVolume: false,
      fillOpacity: 0.4,
      textColor: '#112233',
    }),
  );
  await waitFor(() =>
    expect(JSON.parse(stored.values().next().value ?? '[]')[0]).toMatchObject({
      tool: 'datePriceRange',
      showVolume: false,
      fillOpacity: 0.4,
      textColor: '#112233',
    }),
  );
  act(() => hook.result.current.historyAction('undo'));
  expect(
    hook.result.current.state.history.present[0].showVolume,
  ).toBeUndefined();
});

it.each(
  (['horizontal', 'horizontalRay', 'cross'] as const).flatMap((tool) => [
    { tool, modifier: 'ctrlKey' as const },
    { tool, modifier: 'metaKey' as const },
  ]),
)(
  'keeps both price labels visible while cloning $tool with $modifier',
  async ({ tool, modifier }) => {
    const hook = setup();
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    act(() => hook.result.current.selectTool(tool));
    act(() => {
      hook.result.current.onPointerDown(hook.event('pointerdown', 200, 200));
      hook.result.current.onPointerUp(hook.event('pointerup', 200, 200));
    });
    const original = hook.result.current.state.history.present[0];
    act(() => {
      hook.result.current.onPointerDown(
        hook.event('pointerdown', 350, 200, { [modifier]: true }),
      );
      hook.result.current.onPointerMove(
        hook.event('pointermove', 350, 230, { [modifier]: true }),
      );
    });
    const { drawings } = hook.result.current.getRenderState();
    expect(drawings).toHaveLength(2);
    expect(drawings[0]).toEqual(original);
    expect(drawings[1].points[0].price).not.toBe(original.points[0].price);
    expect(hook.result.current.state.history.present).toEqual([original]);
    const scene = buildTradingViewNativeChartScene({
      candleIntervalSeconds: hook.projection.interval,
      candleLabels: { open: 'O', high: 'H', low: 'L', close: 'C' },
      chartDrawings: drawings,
      chartType: 'candlestick',
      crosshair: { visible: false, x: 0, y: 0 },
      hasVolume: false,
      height: 400,
      width: 800,
      points: hook.projection.points,
      priceAxisWidth: 60,
      priceDecimalPlaces: 2,
      viewport: hook.projection.viewport,
      measureTextWidth: (text) => text.length * 6,
      watermarkOpacity: 0.16,
    });
    const labels = scene.commands.flatMap((command) =>
      command.kind === 'rect' &&
      command.customPaintId?.startsWith('chart.drawing.')
        ? [command]
        : [],
    );
    expect(labels).toHaveLength(2);
    expect(Math.abs(labels[0].y - labels[1].y)).toBeGreaterThanOrEqual(
      labels[0].height,
    );
    const prices = scene.commands.flatMap((command) =>
      command.kind === 'text' && command.font === 'priceAxis'
        ? [command.text]
        : [],
    );
    expect(prices).toEqual(
      expect.arrayContaining(
        drawings.map((drawing) => drawing.points[0].price.toFixed(2)),
      ),
    );
    act(() => {
      hook.result.current.onPointerUp(hook.event('pointerup', 350, 230));
    });
    const saved = hook.result.current.state.history.present;
    expect(saved).toHaveLength(2);
    expect(saved[0]).toEqual(original);
    expect(saved[1].id).not.toBe(original.id);
    expect(saved[1].points).toEqual(drawings[1].points);
  },
);

it('does not load drawings or intercept chart gestures while disabled', () => {
  const hook = setup('disabled', false);
  expect(getItem).not.toHaveBeenCalled();
  const preventDefault = jest.fn();
  const event = hook.event('pointerdown', 200, 200, { preventDefault });
  expect(hook.result.current.onPointerDown(event)).toBe(false);
  expect(hook.result.current.onPointerMove(event)).toBe(false);
  expect(hook.result.current.onPointerUp(event)).toBe(false);
  expect(preventDefault).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});

it.each([false, true])(
  'moves only the current selection when dragging a line (group selected: %s)',
  async (groupSelected) => {
    const hook = setup('selection');
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    hook.line();
    hook.line(80);
    const [first, second] = hook.result.current.state.history.present;
    act(() => hook.result.current.selectDrawing(first.id));
    if (groupSelected) {
      act(() => hook.result.current.selectDrawing(second.id, true));
    }
    act(() => {
      hook.result.current.onPointerDown(hook.event('pointerdown', 300, 240));
      hook.result.current.onPointerMove(hook.event('pointermove', 330, 260));
    });
    expect(hook.result.current.state.selectedIds).toEqual(
      groupSelected ? [first.id, second.id] : [second.id],
    );
    const preview = hook.result.current.getRenderState().drawings;
    expect(preview[1].points).not.toEqual(second.points);
    if (groupSelected) {
      expect(preview[0].points).not.toEqual(first.points);
    } else {
      expect(preview[0]).toEqual(first);
    }
    act(() => {
      hook.result.current.onPointerUp(hook.event('pointerup', 330, 260));
    });
    expect(hook.result.current.state.history.present).toEqual(preview);
    await waitFor(() =>
      expect(JSON.parse(stored.values().next().value ?? '[]')).toEqual(preview),
    );
    act(() => hook.result.current.historyAction('undo'));
    expect(hook.result.current.state.history.present).toEqual([first, second]);
  },
);

it('keeps edited text out of defaults, new drawings and selected non-text tools', async () => {
  const hook = setup('text-style');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  hook.line();
  act(() => hook.result.current.selectTool('text'));
  act(() => {
    hook.result.current.onPointerDown(hook.event('pointerdown', 250, 220));
    hook.result.current.onPointerUp(hook.event('pointerup', 250, 220));
  });
  const [line, text] = hook.result.current.state.history.present;
  act(() => hook.result.current.selectDrawing(line.id));
  act(() => hook.result.current.selectDrawing(text.id, true));
  act(() =>
    hook.result.current.changeStyle({ text: 'Buy here', color: '#112233' }),
  );
  expect(hook.result.current.state.style).not.toHaveProperty('text');
  expect(hook.result.current.state.history.present[0]).not.toHaveProperty(
    'text',
  );
  expect(hook.result.current.state.history.present[1]).toMatchObject({
    text: 'Buy here',
    color: '#112233',
  });
  act(() => hook.result.current.selectTool('text'));
  act(() => {
    hook.result.current.onPointerDown(hook.event('pointerdown', 500, 220));
    hook.result.current.onPointerUp(hook.event('pointerup', 500, 220));
  });
  hook.line(80);
  const drawings = hook.result.current.state.history.present;
  expect(drawings).toHaveLength(4);
  expect(drawings[2]).not.toHaveProperty('text');
  expect(drawings[3]).not.toHaveProperty('text');
  expect(
    drawings.slice(0, 3).every((drawing) => drawing.color === '#112233'),
  ).toBe(true);
  expect(drawings[3].color).toBe(DEFAULT_DRAWING_STYLE.color);
  await waitFor(() =>
    expect(JSON.parse(stored.values().next().value ?? '[]')).toEqual(drawings),
  );
  act(() => hook.result.current.selectDrawing(text.id));
  act(() => hook.result.current.changeStyle({ text: '' }));
  expect(hook.result.current.state.history.present[1].text).toBe('');
});

it('restores locally saved drawings on remount and permits editing restored anchors', async () => {
  const first = setup();
  await waitFor(() => expect(first.result.current.state.ready).toBe(true));
  first.line();
  await waitFor(() => expect(stored.size).toBe(1));
  const original = first.result.current.state.history.present[0];
  first.unmount();
  const second = setup();
  await waitFor(() =>
    expect(second.result.current.state.history.present).toHaveLength(1),
  );
  expect(second.result.current.state.history.present[0]).toEqual(original);
  const middle = drawingPointToScreen(
    {
      time: (original.points[0].time + original.points[1].time) / 2,
      price: (original.points[0].price + original.points[1].price) / 2,
    },
    second.projection,
  );
  void act(() => {
    second.result.current.onPointerDown(
      second.event('pointerdown', middle.x, middle.y),
    );
    second.result.current.onPointerUp(
      second.event('pointerup', middle.x, middle.y),
    );
  });
  void act(() => second.result.current.editPoint(0, { price: 115 }));
  await waitFor(() =>
    expect(
      JSON.parse(stored.values().next().value ?? '[]')[0].points[0].price,
    ).toBe(115),
  );
});

it('persists text size and content and allows undo and editing after reload', async () => {
  const first = setup();
  await waitFor(() => expect(first.result.current.state.ready).toBe(true));
  void act(() => first.result.current.selectTool('text'));
  void act(() => first.result.current.changeStyle({ fontSize: 32 }));
  void act(() => {
    first.result.current.onPointerDown(first.event('pointerdown', 250, 220));
    first.result.current.onPointerUp(first.event('pointerup', 250, 220));
  });
  const original = first.result.current.state.history.present[0];
  expect(original.fontSize).toBe(32);
  void act(() =>
    first.result.current.changeStyle({ fontSize: 40, text: 'ASTER\nsupport' }),
  );
  void act(() => first.result.current.historyAction('undo'));
  expect(first.result.current.state.history.present[0].fontSize).toBe(32);
  void act(() => first.result.current.historyAction('redo'));
  await waitFor(() =>
    expect(JSON.parse(stored.values().next().value ?? '[]')[0]).toMatchObject({
      fontSize: 40,
      text: 'ASTER\nsupport',
    }),
  );
  first.unmount();
  const second = setup();
  await waitFor(() =>
    expect(second.result.current.state.history.present[0]).toMatchObject({
      fontSize: 40,
      text: 'ASTER\nsupport',
    }),
  );
  void act(() => {
    second.result.current.onPointerDown(second.event('pointerdown', 315, 245));
    second.result.current.onPointerUp(second.event('pointerup', 315, 245));
  });
  expect(second.result.current.state.selectedId).toBe(original.id);
  void act(() => second.result.current.changeStyle({ fontSize: 8 }));
  await waitFor(() =>
    expect(JSON.parse(stored.values().next().value ?? '[]')[0].fontSize).toBe(
      8,
    ),
  );
});

it('redraws live brush previews without rerendering the chart React tree per touch sample', async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  void act(() => hook.result.current.selectTool('brush'));
  void act(() =>
    hook.result.current.onPointerDown(hook.event('pointerdown', 200, 180)),
  );
  const controller = hook.result.current;
  hook.options.redrawRef.current.mockClear();
  void act(() => {
    for (let x = 210; x < 400; x += 10)
      hook.result.current.onPointerMove(hook.event('pointermove', x, 180));
  });
  expect(hook.result.current).toBe(controller);
  expect(hook.options.redrawRef.current).toHaveBeenCalled();
  expect(controller.getRenderState().drawings[0].points.length).toBeGreaterThan(
    10,
  );
  void act(() =>
    hook.result.current.onPointerUp(hook.event('pointerup', 390, 180)),
  );
  expect(hook.result.current.state.history.present).toHaveLength(1);
});

it('isolates token identities and never saves an unfinished or cancelled drawing', async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  void act(() => hook.result.current.selectTool('trend'));
  void act(() =>
    hook.result.current.onPointerDown(hook.event('pointerdown', 200, 200)),
  );
  void act(() =>
    hook.result.current.onPointerMove(hook.event('pointermove', 400, 120)),
  );
  void act(() =>
    hook.result.current.onPointerUp(hook.event('pointercancel', 400, 120)),
  );
  expect(hook.result.current.state.history.present).toEqual([]);
  expect(setItem).not.toHaveBeenCalled();
  hook.line();
  await waitFor(() => expect(stored.size).toBe(1));
  hook.rerender({ ...hook.options, storageKey: 'BNB' });
  await waitFor(() =>
    expect(hook.result.current.state.history.present).toEqual([]),
  );
  expect(stored.size).toBe(1);
});

it('serializes local saves so a slow old write cannot overwrite a newer edit', async () => {
  let finishWrite: (() => void) | undefined;
  setItem.mockImplementationOnce(
    (key, value) =>
      new Promise<void>((resolve) => {
        finishWrite = () => {
          stored.set(key, value);
          resolve();
        };
      }),
  );
  const hook = setup('write-order');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  hook.line();
  await waitFor(() => expect(setItem).toHaveBeenCalledTimes(1));
  void act(() => hook.result.current.changeStyle({ color: '#ff0000' }));
  expect(setItem).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishWrite?.();
  });
  await waitFor(() => expect(setItem).toHaveBeenCalledTimes(2));
  expect(JSON.parse(stored.values().next().value ?? '[]')[0].color).toBe(
    '#ff0000',
  );
});

it('keeps drawing available after a storage failure and reports the failed save', async () => {
  setItem.mockRejectedValueOnce(new OneKeyLocalError('Storage unavailable'));
  const hook = setup('failed-write');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  hook.line();
  await waitFor(() => expect(hook.result.current.state.saveFailed).toBe(true));
  expect(hook.result.current.state.history.present).toHaveLength(1);
  void act(() => hook.result.current.changeStyle({ color: '#ff0000' }));
  await waitFor(() => expect(hook.result.current.state.saveFailed).toBe(false));
});

it('locks restored drawings against edit and delete while allowing unlock', async () => {
  const locked: IDrawing = {
    ...DEFAULT_DRAWING_STYLE,
    id: 'locked',
    tool: 'horizontal',
    points: [{ time: 1_700_001_200, price: 105 }],
    locked: true,
  };
  stored.set(
    'trading-view-web-drawings:v1:locked-token',
    JSON.stringify([locked]),
  );
  const hook = setup('locked-token');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  const point = drawingPointToScreen(locked.points[0], hook.projection);
  void act(() =>
    hook.result.current.onPointerDown(
      hook.event('pointerdown', point.x, point.y),
    ),
  );
  void act(() => {
    hook.result.current.removeSelected();
    hook.result.current.editPoint(0, { price: 115 });
  });
  expect(hook.result.current.state.history.present).toEqual([locked]);
  void act(() => hook.result.current.toggleSelectedLock());
  void act(() => hook.result.current.removeSelected());
  expect(hook.result.current.state.history.present).toEqual([]);
});

it('keeps the move cursor over a cross line before selection, on its selected handle and while dragging', async () => {
  const cross: IDrawing = {
    ...DEFAULT_DRAWING_STYLE,
    id: 'cross',
    tool: 'cross',
    points: [{ time: 1_700_001_200, price: 105 }],
    locked: false,
  };
  stored.set(
    'trading-view-web-drawings:v1:cross-cursor',
    JSON.stringify([cross]),
  );
  const hook = setup('cross-cursor');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  const point = drawingPointToScreen(cross.points[0], hook.projection);
  const hover = hook.event('pointermove', point.x, point.y);
  act(() => {
    hook.result.current.onPointerMove(hover);
  });
  expect(hover.currentTarget.style.cursor).toBe('move');
  act(() => {
    hook.result.current.onPointerDown(
      hook.event('pointerdown', point.x, point.y),
    );
    hook.result.current.onPointerUp(hook.event('pointerup', point.x, point.y));
    hook.result.current.onPointerMove(hover);
  });
  expect(hook.result.current.state.selectedId).toBe(cross.id);
  expect(hover.currentTarget.style.cursor).toBe('move');
  act(() => {
    hook.result.current.onPointerDown(
      hook.event('pointerdown', point.x, point.y),
    );
    hook.result.current.onPointerMove(
      hook.event('pointermove', point.x + 30, point.y + 20),
    );
    hook.result.current.onPointerUp(
      hook.event('pointerup', point.x + 30, point.y + 20),
    );
  });
  expect(hover.currentTarget.style.cursor).toBe('move');
  const moved = drawingPointToScreen(
    hook.result.current.state.history.present[0].points[0],
    hook.projection,
  );
  expect(moved.x).toBeCloseTo(point.x + 30);
  expect(moved.y).toBeCloseTo(point.y + 20);
});

it.each([0, 40])(
  'sets the move cursor when a selected cross starts dragging without hover at x offset %s',
  async (offsetX) => {
    const cross: IDrawing = {
      ...DEFAULT_DRAWING_STYLE,
      id: 'cross',
      tool: 'cross',
      points: [{ time: 1_700_001_200, price: 105 }],
      locked: false,
    };
    stored.set(
      'trading-view-web-drawings:v1:cross-no-hover',
      JSON.stringify([cross]),
    );
    const hook = setup('cross-no-hover');
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    act(() => hook.result.current.selectDrawing(cross.id));
    const point = drawingPointToScreen(cross.points[0], hook.projection);
    const down = hook.event('pointerdown', point.x + offsetX, point.y);
    down.currentTarget.style.cursor = 'crosshair';
    act(() => {
      hook.result.current.onPointerDown(down);
    });
    expect(down.currentTarget.style.cursor).toBe('move');
    act(() => {
      hook.result.current.onPointerMove(
        hook.event('pointermove', point.x + offsetX + 30, point.y + 20),
      );
    });
    expect(down.currentTarget.style.cursor).toBe('move');
    act(() => {
      hook.result.current.onPointerUp(
        hook.event('pointerup', point.x + offsetX + 30, point.y + 20),
      );
    });
    const moved = drawingPointToScreen(
      hook.result.current.state.history.present[0].points[0],
      hook.projection,
    );
    expect(moved.x).toBeCloseTo(point.x + 30);
    expect(moved.y).toBeCloseTo(point.y + 20);
  },
);

it('renders a brush continuously before release and saves strokes ending at their starting point', async () => {
  const hook = setup('brush');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  void act(() => hook.result.current.selectTool('brush'));
  void act(() =>
    hook.result.current.onPointerDown(hook.event('pointerdown', 200, 200)),
  );
  void act(() =>
    hook.result.current.onPointerMove(hook.event('pointermove', 300, 100)),
  );
  void act(() =>
    hook.result.current.onPointerMove(hook.event('pointermove', 400, 200)),
  );
  expect(hook.result.current.state.draft?.drawing.points).toHaveLength(3);
  expect(hook.result.current.state.history.present).toHaveLength(0);
  expect(setItem).not.toHaveBeenCalled();
  void act(() =>
    hook.result.current.onPointerMove(hook.event('pointermove', 200, 200)),
  );
  void act(() =>
    hook.result.current.onPointerUp(hook.event('pointerup', 200, 200)),
  );
  expect(hook.result.current.state.history.present[0].points).toHaveLength(4);
  await waitFor(() => expect(stored.size).toBe(1));
});

it('persists object visibility, name, lock and stacking order with undo support', async () => {
  const hook = setup('objects');
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  hook.line();
  hook.line();
  const [first, second] = hook.result.current.state.history.present;
  void act(() =>
    hook.result.current.updateDrawing(first.id, {
      name: 'Support',
      hidden: true,
    }),
  );
  void act(() => hook.result.current.reorderDrawing(first.id, 1));
  expect(
    hook.result.current.state.history.present.map((drawing) => drawing.id),
  ).toEqual([second.id, first.id]);
  void act(() => hook.result.current.updateDrawing(first.id, { locked: true }));
  void act(() => hook.result.current.removeDrawing(first.id));
  expect(hook.result.current.state.history.present).toHaveLength(2);
  await waitFor(() =>
    expect(JSON.parse(stored.values().next().value ?? '[]')[1]).toMatchObject({
      id: first.id,
      name: 'Support',
      locked: true,
      hidden: true,
    }),
  );
  void act(() => hook.result.current.historyAction('undo'));
  expect(hook.result.current.state.history.present[1].locked).toBe(false);
  void act(() => hook.result.current.historyAction('undo'));
  expect(
    hook.result.current.state.history.present.map((drawing) => drawing.id),
  ).toEqual([first.id, second.id]);
});

it('finishes variable-length paths as one undoable drawing and restores every anchor', async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  void act(() => hook.result.current.selectTool('polyline'));
  for (const [x, y] of [
    [200, 220],
    [280, 120],
    [360, 240],
    [440, 100],
  ]) {
    void act(() => {
      hook.result.current.onPointerMove(hook.event('pointermove', x, y));
      hook.result.current.onPointerDown(hook.event('pointerdown', x, y));
      hook.result.current.onPointerUp(hook.event('pointerup', x, y));
    });
  }
  expect(hook.result.current.state.history.present).toHaveLength(0);
  expect(setItem).not.toHaveBeenCalled();
  void act(() => hook.result.current.finishPath());
  const [path] = hook.result.current.state.history.present;
  expect(path.points).toHaveLength(4);
  await waitFor(() => expect(setItem).toHaveBeenCalled());
  void act(() => hook.result.current.historyAction('undo'));
  expect(hook.result.current.state.history.present).toHaveLength(0);
  void act(() => hook.result.current.historyAction('redo'));
  await waitFor(() =>
    expect(JSON.parse(stored.values().next().value ?? '[]')).toEqual([path]),
  );
  hook.unmount();
  const restored = setup();
  await waitFor(() => expect(restored.result.current.state.ready).toBe(true));
  expect(restored.result.current.state.history.present).toEqual([path]);
});

it('edits anchored text in viewport percentages without changing its price coordinates', async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
  void act(() => hook.result.current.selectTool('anchoredText'));
  void act(() =>
    hook.result.current.onPointerDown(hook.event('pointerdown', 200, 120)),
  );
  const first = hook.result.current.state.history.present[0];
  expect(first.anchor).toBeDefined();
  void act(() => hook.result.current.editAnchor({ x: 0.75, y: 0.25 }));
  expect(hook.result.current.state.history.present[0]).toMatchObject({
    points: first.points,
    anchor: { x: 0.75, y: 0.25 },
  });
  void act(() => hook.result.current.historyAction('undo'));
  expect(hook.result.current.state.history.present[0]).toEqual(first);
  void act(() => hook.result.current.editAnchor({ x: 2 }));
  expect(hook.result.current.state.history.present[0]).toEqual(first);
});
