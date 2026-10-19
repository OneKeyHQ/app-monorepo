/** @jest-environment jsdom */

import type { MouseEvent, PointerEvent } from 'react';

import { act, render, renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getTradingViewNativeChartLayout,
  getTradingViewNativePriceY,
} from '../utils/chartLayout';

import { useChartPriceSelection } from './useChartPriceSelection';

import type { ITradingViewNativePriceSelection } from '../types';

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({
    borderSubdued: { val: '#888888' },
    text: { val: '#ffffff' },
    bgApp: { val: '#111111' },
  }),
}));

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
  const selections: ITradingViewNativePriceSelection[] = [];
  const options = {
    enabled: true,
    canvasRef: { current: canvas },
    scopeKey: 'BTC',
    onSelect: (selection: ITradingViewNativePriceSelection) =>
      selections.push(selection),
    projectionRef: {
      current: {
        layout,
        points,
        interval: 60,
        viewport: { offset: 0, zoomScale: 1 },
      },
    },
    redrawRef: { current: jest.fn() },
  };
  const hook = renderHook((props) => useChartPriceSelection(props), {
    initialProps: options,
  });
  const view = render(hook.result.current.control);
  const button = view.getByRole('button', { hidden: true });
  const overlay = view.container.appendChild(document.createElement('div'));
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
    event,
    overlay,
    rightClickAt,
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
    expect(hook.result.current.getCrosshair()?.y).toBeCloseTo(100);
  });

  it('repositions an open menu when its overlay receives another chart right-click', () => {
    const hook = setup();
    hook.selectPrice();
    const secondClick = hook.rightClickAt(250, 200);
    expect(secondClick.defaultPrevented).toBe(true);
    expect(hook.selections).toHaveLength(2);
    expect(hook.selections[1]).toMatchObject({ screenX: 250, screenY: 200 });
    expect(hook.result.current.getCrosshair()?.x).toBe(250);
    expect(hook.result.current.getCrosshair()?.y).toBeCloseTo(200);
    act(() => hook.selections[0].onClose?.());
    expect(hook.result.current.getCrosshair()?.y).toBeCloseTo(200);
    act(() => hook.selections[1].onClose?.());
    expect(hook.result.current.getCrosshair()).toBeUndefined();
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

  it('keeps the selected price visible until the menu closes', () => {
    const hook = setup();
    act(() => {
      hook.result.current.onPointerMove(
        hook.event() as unknown as PointerEvent<HTMLCanvasElement>,
      );
      hook.result.current.updateControl();
    });
    expect(hook.button.style.display).toBe('block');
    hook.selectPrice();
    expect(hook.selections).toHaveLength(1);
    expect(hook.button.style.display).toBe('block');
    expect(hook.result.current.getCrosshair()).toMatchObject({
      visible: true,
      x: 120,
    });
    expect(hook.result.current.getCrosshair()?.y).toBeCloseTo(100);
    act(() => {
      hook.result.current.hide();
      hook.result.current.onPointerMove(
        hook.event(200) as unknown as PointerEvent<HTMLCanvasElement>,
      );
    });
    expect(hook.button.style.display).toBe('block');
    expect(hook.result.current.getCrosshair()?.y).toBeCloseTo(100);
    const projection = hook.options.projectionRef.current;
    projection.layout = { ...projection.layout, minPrice: 80, maxPrice: 140 };
    act(() => hook.result.current.updateControl());
    expect(Number.parseFloat(hook.button.style.top)).toBeCloseTo(
      getTradingViewNativePriceY(hook.selections[0].price, projection.layout) -
        11,
    );
    act(() => hook.selections[0].onClose?.());
    expect(hook.button.style.display).toBe('none');
    expect(hook.result.current.getCrosshair()).toBeUndefined();
  });

  it('clears the selection when the symbol changes or selection is disabled', () => {
    const hook = setup();
    hook.selectPrice();
    hook.rerender({ ...hook.options, scopeKey: 'ETH' });
    expect(hook.result.current.getCrosshair()).toBeUndefined();
    expect(hook.button.style.display).toBe('none');
    hook.selectPrice();
    hook.rerender({ ...hook.options, enabled: false });
    expect(hook.result.current.getCrosshair()).toBeUndefined();
  });
});
