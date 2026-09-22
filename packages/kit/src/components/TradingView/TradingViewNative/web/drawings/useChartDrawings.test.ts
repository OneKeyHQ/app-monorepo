/** @jest-environment jsdom */

import type { PointerEvent } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { getTradingViewNativeChartLayout } from '../../utils/chartLayout';
import { createTradingViewNativeChartRuntimeState } from '../../utils/chartRuntime';

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

function setup(storageKey = 'ASTER') {
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
    enabled: true,
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
  const line = () => {
    void act(() => hook.result.current.selectTool('trend'));
    void act(() => {
      hook.result.current.onPointerDown(event('pointerdown', 200, 200));
      hook.result.current.onPointerUp(event('pointerup', 200, 200));
    });
    void act(() =>
      hook.result.current.onPointerMove(event('pointermove', 400, 120)),
    );
    void act(() =>
      hook.result.current.onPointerDown(event('pointerdown', 400, 120)),
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
