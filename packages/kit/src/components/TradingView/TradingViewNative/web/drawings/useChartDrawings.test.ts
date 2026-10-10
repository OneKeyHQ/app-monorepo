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
  expect(drawings.every((drawing) => drawing.color === '#112233')).toBe(true);
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
    second.result.current.onPointerDown(second.event('pointerdown', 315, 185));
    second.result.current.onPointerUp(second.event('pointerup', 315, 185));
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
