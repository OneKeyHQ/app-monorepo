import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';

import { useTheme } from '@onekeyhq/components';

import { getTradingViewNativePriceAtY } from '../utils/chartLayout';

import type { IDrawingProjection } from '../drawings/model';
import type { ITradingViewNativePriceSelection } from '../types';

const CONTROL_DISPLAY = 'flex';
const MENU_SELECTOR =
  '[data-testid="popover-panel"], [data-testid="TMPopover-ScrollView"], [role="menu"], [role="dialog"]';

function forwardPointerMove(
  canvas: HTMLCanvasElement,
  event: Pick<
    globalThis.PointerEvent,
    | 'buttons'
    | 'clientX'
    | 'clientY'
    | 'isPrimary'
    | 'pointerId'
    | 'pointerType'
    | 'screenX'
    | 'screenY'
  >,
) {
  if (typeof globalThis.PointerEvent !== 'function') return;
  canvas.dispatchEvent(
    new globalThis.PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      buttons: event.buttons,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
    }),
  );
}

export function useChartPriceSelection({
  canvasRef,
  enabled,
  label,
  onSelect,
  pointerLeaveRef,
  projectionRef,
  scopeKey,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  label?: string;
  onSelect?: (selection: ITradingViewNativePriceSelection) => void;
  // The chart's own pointer-leave handling.
  pointerLeaveRef: RefObject<() => void>;
  projectionRef: RefObject<IDrawingProjection | null>;
  scopeKey?: string;
}) {
  const theme = useTheme();
  const button = useRef<HTMLButtonElement>(null);
  const selectedY = useRef<number | null>(null);
  const openMenu = useRef<object | null>(null);
  const hide = useCallback(() => {
    selectedY.current = null;
    if (button.current) button.current.style.display = 'none';
  }, []);
  const reset = useCallback(() => {
    openMenu.current = null;
    hide();
  }, [hide]);
  useEffect(() => {
    reset();
    return reset;
  }, [enabled, onSelect, reset, scopeKey]);
  const select = useCallback(
    (price: number, screenX: number, screenY: number) => {
      const menu = {};
      openMenu.current = menu;
      onSelect?.({
        price,
        screenX,
        screenY,
        onClose: () => {
          if (openMenu.current === menu) openMenu.current = null;
        },
      });
    },
    [onSelect],
  );
  const getPrice = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      const projection = projectionRef.current;
      if (!enabled || !onSelect || !canvas || !projection) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || x > projection.layout.priceAxisX) return null;
      const price = getTradingViewNativePriceAtY({ ...projection.layout, y });
      return price !== null && Number.isFinite(price) && price > 0
        ? { price, y, layout: projection.layout }
        : null;
    },
    [canvasRef, enabled, onSelect, projectionRef],
  );
  useEffect(() => {
    if (!enabled || !onSelect) return;
    const onContextMenu = (event: globalThis.MouseEvent) => {
      if (!openMenu.current) return;
      if (
        event.target instanceof Element &&
        event.target.closest(MENU_SELECTOR)
      )
        return;
      const selection = getPrice(event);
      if (!selection) return;
      // The open menu's backdrop covers the canvas, so handle repeated right-clicks here.
      event.preventDefault();
      event.stopPropagation();
      select(selection.price, event.clientX, event.clientY);
    };
    const onPointerMove = (event: globalThis.PointerEvent) => {
      const canvas = canvasRef.current;
      const layout = projectionRef.current?.layout;
      const { target } = event;
      if (
        !openMenu.current ||
        !canvas ||
        !layout ||
        !(target instanceof Element) ||
        canvas.parentElement?.contains(target) ||
        event.pointerType !== 'mouse' ||
        event.buttons !== 0
      )
        return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // The backdrop also swallows hover, so pass plot hovers through it; over
      // the menu or anywhere else the pointer has left the chart.
      if (
        !target.closest(MENU_SELECTOR) &&
        x >= 0 &&
        x <= layout.priceAxisX &&
        y >= 0 &&
        y <= layout.timeAxisY
      ) {
        forwardPointerMove(canvas, event);
      } else {
        pointerLeaveRef.current();
      }
    };
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('pointermove', onPointerMove, true);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('pointermove', onPointerMove, true);
    };
  }, [
    canvasRef,
    enabled,
    getPrice,
    onSelect,
    pointerLeaveRef,
    projectionRef,
    select,
  ]);
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType !== 'mouse' || event.buttons !== 0) {
        hide();
        return;
      }
      const selection = getPrice(event);
      if (!selection || !button.current) {
        hide();
        return;
      }
      selectedY.current = selection.y;
      // Update only the floating control; pointer movement must not rerender the chart.
      button.current.style.display = CONTROL_DISPLAY;
      button.current.style.left = `${Math.max(0, selection.layout.priceAxisX - 24)}px`;
      button.current.style.top = `${Math.max(0, selection.y - 11)}px`;
    },
    [getPrice, hide],
  );
  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const selection = getPrice(event);
      if (!selection) return;
      event.preventDefault();
      select(selection.price, event.clientX, event.clientY);
    },
    [getPrice, select],
  );
  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const layout = projectionRef.current?.layout;
      if (enabled && layout && selectedY.current !== null) {
        const price = getTradingViewNativePriceAtY({
          ...layout,
          y: selectedY.current,
        });
        const rect = event.currentTarget.getBoundingClientRect();
        if (price !== null && Number.isFinite(price) && price > 0)
          select(price, rect.left, rect.bottom);
      }
    },
    [enabled, projectionRef, select],
  );
  const onControlPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      // The control covers the canvas; forward hover moves so the crosshair,
      // price axis label and the control itself keep tracking the pointer.
      // A pressed move would hide the control before its click lands.
      if (canvasRef.current && event.buttons === 0)
        forwardPointerMove(canvasRef.current, event);
    },
    [canvasRef],
  );
  const control =
    enabled && onSelect ? (
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        data-testid="trading-view-native-price-action"
        onClick={onClick}
        onPointerMove={onControlPointerMove}
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          position: 'absolute',
          width: 22,
          height: 22,
          padding: 0,
          borderRadius: 4,
          border: `1px solid ${theme.borderSubdued.val}`,
          color: theme.text.val,
          background: theme.bgApp.val,
          cursor: 'pointer',
        }}
      >
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <path
            d="M6 1.5v9M1.5 6h9"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      </button>
    ) : null;
  return {
    control,
    onContextMenu,
    onPointerMove,
    hide,
  };
}
