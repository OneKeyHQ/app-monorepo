import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';

import { useTheme } from '@onekeyhq/components';

import { getTradingViewNativePriceAtY } from '../utils/chartLayout';

import type { IDrawingProjection } from '../drawings/model';
import type { ITradingViewNativePriceSelection } from '../types';

export function useChartPriceSelection({
  enabled,
  label,
  onSelect,
  projectionRef,
}: {
  enabled: boolean;
  label?: string;
  onSelect?: (selection: ITradingViewNativePriceSelection) => void;
  projectionRef: RefObject<IDrawingProjection | null>;
}) {
  const theme = useTheme();
  const button = useRef<HTMLButtonElement>(null);
  const selectedY = useRef<number | null>(null);
  const hide = useCallback(() => {
    selectedY.current = null;
    if (button.current) button.current.style.display = 'none';
  }, []);
  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);
  const getPrice = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const projection = projectionRef.current;
      if (!enabled || !onSelect || !projection) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || x > projection.layout.priceAxisX) return null;
      const price = getTradingViewNativePriceAtY({ ...projection.layout, y });
      return price !== null && Number.isFinite(price) && price > 0
        ? { price, y, layout: projection.layout }
        : null;
    },
    [enabled, onSelect, projectionRef],
  );
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
      onSelect?.({
        price: selection.price,
        screenX: event.clientX,
        screenY: event.clientY,
      });
      hide();
    },
    [getPrice, hide, onSelect],
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
          onSelect?.({
            price,
            screenX: rect.left,
            screenY: rect.bottom,
          });
      }
      hide();
    },
    [enabled, hide, onSelect, projectionRef],
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
  return { control, onContextMenu, onPointerMove, hide };
}
