import { useRef } from 'react';

import { useTheme } from '@onekeyhq/components';

export interface ITradingViewPanelDividerProps {
  axis: 'columns' | 'rows';
  index: number;
  position: number;
  label: string;
  onStart: (axis: 'columns' | 'rows', index: number) => void;
  onMove: (delta: number) => void;
  onEnd: (commit: boolean) => void;
}

export function TradingViewPanelDivider({
  axis,
  index,
  position,
  label,
  onStart,
  onMove,
  onEnd,
}: ITradingViewPanelDividerProps) {
  const theme = useTheme();
  const start = useRef<number | null>(null);
  const isColumn = axis === 'columns';
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isColumn ? 'vertical' : 'horizontal'}
      data-testid={`trading-view-panel-divider-${axis}-${index}`}
      style={{
        position: 'absolute',
        zIndex: 5,
        touchAction: 'none',
        cursor: isColumn ? 'col-resize' : 'row-resize',
        ...(isColumn
          ? {
              left: `${position * 100}%`,
              top: 0,
              bottom: 0,
              width: 12,
              marginLeft: -6,
            }
          : {
              top: `${position * 100}%`,
              left: 0,
              right: 0,
              height: 12,
              marginTop: -6,
            }),
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = isColumn ? event.clientX : event.clientY;
        onStart(axis, index);
      }}
      onPointerMove={(event) => {
        if (start.current !== null) {
          onMove((isColumn ? event.clientX : event.clientY) - start.current);
        }
      }}
      onPointerUp={(event) => {
        if (start.current === null) return;
        onMove((isColumn ? event.clientX : event.clientY) - start.current);
        start.current = null;
        onEnd(true);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        if (start.current !== null) {
          start.current = null;
          onEnd(false);
        }
      }}
      onLostPointerCapture={() => {
        if (start.current !== null) {
          start.current = null;
          onEnd(false);
        }
      }}
    >
      <div
        style={{
          position: 'absolute',
          backgroundColor: theme.borderStrong.val,
          ...(isColumn
            ? { left: 5, top: 0, bottom: 0, width: 2 }
            : { top: 5, left: 0, right: 0, height: 2 }),
        }}
      />
    </div>
  );
}
