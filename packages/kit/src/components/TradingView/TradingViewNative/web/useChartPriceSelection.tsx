import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';

import { useTheme } from '@onekeyhq/components';

import {
  getTradingViewNativePriceAtY,
  getTradingViewNativePriceY,
} from '../utils/chartLayout';

import type { IDrawingProjection } from '../drawings/model';
import type { ITradingViewNativePriceSelection } from '../types';

export function useChartPriceSelection({
  canvasRef,
  enabled,
  label,
  onSelect,
  projectionRef,
  redrawRef,
  scopeKey,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  label?: string;
  onSelect?: (selection: ITradingViewNativePriceSelection) => void;
  projectionRef: RefObject<IDrawingProjection | null>;
  redrawRef: RefObject<() => void>;
  scopeKey?: string;
}) {
  const theme = useTheme();
  const button = useRef<HTMLButtonElement>(null);
  const selectedY = useRef<number | null>(null);
  const pinned = useRef<{ price: number; x: number } | null>(null);
  const hide = useCallback((force = false) => {
    if (pinned.current && !force) return;
    pinned.current = null;
    selectedY.current = null;
    if (button.current) button.current.style.display = 'none';
  }, []);
  useEffect(() => {
    hide(true);
    redrawRef.current();
    return () => hide(true);
  }, [enabled, hide, onSelect, redrawRef, scopeKey]);
  const getCrosshair = useCallback(() => {
    const selection = pinned.current;
    const layout = projectionRef.current?.layout;
    if (!selection || !layout) return undefined;
    const y = getTradingViewNativePriceY(selection.price, layout);
    if (button.current) {
      button.current.style.display = 'block';
      button.current.style.left = `${Math.max(0, layout.priceAxisX - 24)}px`;
      button.current.style.top = `${Math.max(0, y - 11)}px`;
    }
    return { visible: true, x: selection.x, y };
  }, [projectionRef]);
  const select = useCallback(
    (price: number, x: number, screenX: number, screenY: number) => {
      const selection = { price, x };
      pinned.current = selection;
      getCrosshair();
      onSelect?.({
        price,
        screenX,
        screenY,
        onClose: () => {
          if (pinned.current !== selection) return;
          hide(true);
          redrawRef.current();
        },
      });
      redrawRef.current();
    },
    [getCrosshair, hide, onSelect, redrawRef],
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
        ? { price, x, y, layout: projection.layout }
        : null;
    },
    [canvasRef, enabled, onSelect, projectionRef],
  );
  useEffect(() => {
    if (!enabled || !onSelect) return;
    const onContextMenu = (event: globalThis.MouseEvent) => {
      if (!pinned.current) return;
      const selection = getPrice(event);
      if (!selection) return;
      // The open menu's backdrop covers the canvas, so handle repeated right-clicks here.
      event.preventDefault();
      event.stopPropagation();
      select(selection.price, selection.x, event.clientX, event.clientY);
    };
    document.addEventListener('contextmenu', onContextMenu, true);
    return () =>
      document.removeEventListener('contextmenu', onContextMenu, true);
  }, [enabled, getPrice, onSelect, select]);
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (pinned.current) return;
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
      button.current.style.display = 'block';
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
      select(selection.price, selection.x, event.clientX, event.clientY);
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
          select(price, layout.priceAxisX - 24, rect.left, rect.bottom);
      }
    },
    [enabled, projectionRef, select],
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
        style={{
          display: 'none',
          position: 'absolute',
          width: 22,
          height: 22,
          padding: 0,
          borderRadius: 4,
          border: `1px solid ${theme.borderSubdued.val}`,
          color: theme.text.val,
          background: theme.bgApp.val,
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: '18px',
        }}
      >
        +
      </button>
    ) : null;
  return { control, onContextMenu, onPointerMove, hide, getCrosshair };
}
