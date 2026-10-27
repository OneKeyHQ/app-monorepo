/** @jest-environment jsdom */

import type { MouseEvent, PointerEvent } from 'react';

import { act, render, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getTradingViewNativeChartLayout } from '../utils/chartLayout';

import { useChartPriceSelection } from './useChartPriceSelection';

import type { ITradingViewNativePriceSelection } from '../types';

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({
    borderSubdued: { val: '#888888' },
    text: { val: '#ffffff' },
    bgApp: { val: '#111111' },
  }),
}));

// jsdom does not implement PointerEvent.
class TestPointerEvent extends globalThis.MouseEvent {
  pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? '';
  }
}

const originalPointerEvent = globalThis.PointerEvent;

beforeAll(() => {
  globalThis.PointerEvent =
    TestPointerEvent as unknown as typeof globalThis.PointerEvent;
});

afterAll(() => {
  globalThis.PointerEvent = originalPointerEvent;
});

afterEach(() => {
  document.body.innerHTML = '';
});

function setup() {
  const points = [{ t: 1_700_000_000, o: 100, h: 110, l: 90, c: 100, v: 1 }];
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
    visiblePointRange: { startIndex: 0, endIndex: 1 },
  });
  if (!layout) throw new OneKeyLocalError('Expected chart layout');
  const canvas = document.createElement('canvas');
  const canvasMoves: Array<{ clientX: number; clientY: number }> = [];
  canvas.addEventListener('pointermove', (event) =>
    canvasMoves.push({ clientX: event.clientX, clientY: event.clientY }),
  );
  const selections: ITradingViewNativePriceSelection[] = [];
  const options = {
    enabled: true,
    canvasRef: { current: canvas },
    scopeKey: 'BTC',
    onSelect: (selection: ITradingViewNativePriceSelection) =>
      selections.push(selection),
    pointerLeaveRef: { current: jest.fn() },
    projectionRef: {
      current: {
        layout,
        points,
        interval: 60,
        viewport: { offset: 0, zoomScale: 1 },
      },
    },
  };
  const hook = renderHook((props) => useChartPriceSelection(props), {
    initialProps: options,
  });
  const view = render(hook.result.current.control);
  const button = view.getByRole('button', { hidden: true });
  // The canvas and the control share the chart container.
  view.container.appendChild(canvas);
  // Stands in for the open menu's full-screen backdrop.
  const overlay = document.body.appendChild(document.createElement('div'));
  const rightClickAt = (
    clientX: number,
    clientY: number,
    target: Element = overlay,
  ) => {
    const contextMenu = new globalThis.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    });
    act(() => {
      target.dispatchEvent(contextMenu);
    });
    return contextMenu;
  };
  const moveOver = (
    target: Element,
    clientX: number,
    clientY: number,
    buttons = 0,
  ) =>
    act(() => {
      target.dispatchEvent(
        new globalThis.PointerEvent('pointermove', {
          bubbles: true,
          buttons,
          clientX,
          clientY,
          pointerType: 'mouse',
        }),
      );
    });
  const event = (y = 100) => ({
    currentTarget: canvas,
    clientX: 120,
    clientY: y,
    pointerType: 'mouse',
    buttons: 0,
    preventDefault: jest.fn(),
  });
  return {
    ...hook,
    options,
    selections,
    button,
    canvasMoves,
    overlay,
    rightClickAt,
    moveOver,
    hoverCanvas: (y?: number) =>
      act(() =>
        hook.result.current.onPointerMove(
          event(y) as unknown as PointerEvent<HTMLCanvasElement>,
        ),
      ),
    selectPrice: () =>
      act(() =>
        hook.result.current.onContextMenu(
          event() as unknown as MouseEvent<HTMLCanvasElement>,
        ),
      ),
  };
}

describe('chart price selection', () => {
  it('leaves right-clicks inside the open menu to the menu', () => {
    const hook = setup();
    hook.selectPrice();
    const menu = document.createElement('div');
    menu.dataset.testid = 'TMPopover-ScrollView';
    hook.overlay.appendChild(menu);
    const item = menu.appendChild(document.createElement('button'));
    const event = hook.rightClickAt(250, 200, item);
    expect(event.defaultPrevented).toBe(false);
    expect(hook.selections).toHaveLength(1);
  });

  it('repositions an open menu when its overlay receives another chart right-click', () => {
    const hook = setup();
    hook.selectPrice();
    const secondClick = hook.rightClickAt(250, 200);
    expect(secondClick.defaultPrevented).toBe(true);
    expect(hook.selections).toHaveLength(2);
    expect(hook.selections[1]).toMatchObject({ screenX: 250, screenY: 200 });
    // The replaced menu closing late must not end the open one.
    act(() => hook.selections[0].onClose?.());
    expect(hook.rightClickAt(260, 210).defaultPrevented).toBe(true);
    act(() => hook.selections[2].onClose?.());
    expect(hook.rightClickAt(270, 220).defaultPrevented).toBe(false);
    expect(hook.selections).toHaveLength(3);
  });

  it('leaves browser context menus outside the plot and after menu dismissal alone', () => {
    const hook = setup();
    expect(hook.rightClickAt(120, 100).defaultPrevented).toBe(false);
    hook.selectPrice();
    for (const [x, y] of [
      [780, 100],
      [-10, 100],
      [120, -10],
      [120, 450],
    ]) {
      expect(hook.rightClickAt(x, y).defaultPrevented).toBe(false);
    }
    expect(hook.selections).toHaveLength(1);
    act(() => hook.selections[0].onClose?.());
    expect(hook.rightClickAt(120, 100).defaultPrevented).toBe(false);
    expect(hook.selections).toHaveLength(1);
  });

  it('keeps the chart hover working while the menu is open', () => {
    const hook = setup();
    const leave = hook.options.pointerLeaveRef.current;
    const menu = document.body.appendChild(document.createElement('div'));
    menu.dataset.testid = 'popover-panel';
    hook.hoverCanvas(100);
    hook.selectPrice();
    hook.hoverCanvas(200);
    expect(hook.button.style.display).toBe('flex');
    expect(hook.button.style.top).toBe('189px');
    // The menu's backdrop covers the chart, so plot hovers pass through it.
    hook.moveOver(hook.overlay, 130, 140);
    hook.moveOver(hook.overlay, 135, 145, 1);
    expect(hook.canvasMoves).toEqual([{ clientX: 130, clientY: 140 }]);
    expect(leave).not.toHaveBeenCalled();
    // Over the menu, the price axis or below the plot the pointer has left the chart.
    hook.moveOver(menu, 130, 140);
    hook.moveOver(hook.overlay, 790, 140);
    hook.moveOver(hook.overlay, 130, 450);
    expect(leave).toHaveBeenCalledTimes(3);
    expect(hook.canvasMoves).toHaveLength(1);
    act(() => hook.selections[0].onClose?.());
    hook.moveOver(hook.overlay, 130, 140);
    expect(hook.canvasMoves).toHaveLength(1);
  });

  it('keeps the visible control on the price axis when the layout changes', () => {
    const hook = setup();
    const projection = hook.options.projectionRef.current;
    hook.hoverCanvas(100);
    // A resize or a wider price axis redraws the chart without a pointer event.
    projection.layout = {
      ...projection.layout,
      priceAxisX: projection.layout.priceAxisX - 40,
    };
    act(() => hook.result.current.updateControl());
    expect(hook.button.style.left).toBe(
      `${projection.layout.priceAxisX - 24}px`,
    );
    expect(hook.button.style.top).toBe('89px');
    act(() => {
      hook.result.current.hide();
      hook.result.current.updateControl();
    });
    expect(hook.button.style.display).toBe('none');
  });

  it('forwards hover moves over the control to the canvas', () => {
    const hook = setup();
    hook.moveOver(hook.button, 130, 140);
    // A pressed move would hide the control before its click lands.
    hook.moveOver(hook.button, 131, 141, 1);
    expect(hook.canvasMoves).toEqual([{ clientX: 130, clientY: 140 }]);
  });

  it('forgets the open menu when the symbol changes or selection is disabled', () => {
    const hook = setup();
    hook.hoverCanvas();
    hook.selectPrice();
    hook.rerender({ ...hook.options, scopeKey: 'ETH' });
    expect(hook.button.style.display).toBe('none');
    expect(hook.rightClickAt(250, 200).defaultPrevented).toBe(false);
    hook.selectPrice();
    hook.rerender({ ...hook.options, enabled: false });
    expect(hook.rightClickAt(250, 200).defaultPrevented).toBe(false);
    hook.moveOver(hook.overlay, 130, 140);
    expect(hook.canvasMoves).toEqual([]);
  });
});
