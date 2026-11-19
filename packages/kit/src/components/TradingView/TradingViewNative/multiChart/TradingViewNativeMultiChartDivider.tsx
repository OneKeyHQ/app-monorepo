import { useRef, useState } from 'react';

import { useTheme } from '@onekeyhq/components';

import type {
  ITradingViewNativeMultiChartAxis,
  ITradingViewNativeMultiChartDivider,
} from './multiChartLayout';

const HIT_SIZE = 9;

export function TradingViewNativeMultiChartDivider({
  divider,
  label,
  onEnd,
  onMove,
  onStart,
}: {
  divider: ITradingViewNativeMultiChartDivider;
  label: string;
  onStart: (axis: ITradingViewNativeMultiChartAxis, index: number) => void;
  onMove: (delta: number) => void;
  onEnd: (commit: boolean) => void;
}) {
  const theme = useTheme();
  const start = useRef<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { axis, index, position, start: from, end: to } = divider;
  const isColumn = axis === 'columns';
  const isActive = isHovered || isDragging;
  const cancel = () => {
    if (start.current === null) return;
    start.current = null;
    setIsDragging(false);
    onEnd(false);
  };
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isColumn ? 'vertical' : 'horizontal'}
      data-testid={`trading-view-multi-chart-divider-${axis}-${index}`}
      style={{
        position: 'absolute',
        // Above the charts, below their toolbars' floating panels.
        zIndex: 4,
        touchAction: 'none',
        userSelect: 'none',
        cursor: isColumn ? 'col-resize' : 'row-resize',
        ...(isColumn
          ? {
              left: `${position * 100}%`,
              top: `${from * 100}%`,
              height: `${(to - from) * 100}%`,
              width: HIT_SIZE,
              marginLeft: -(HIT_SIZE - 1) / 2,
            }
          : {
              top: `${position * 100}%`,
              left: `${from * 100}%`,
              width: `${(to - from) * 100}%`,
              height: HIT_SIZE,
              marginTop: -(HIT_SIZE - 1) / 2,
            }),
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = isColumn ? event.clientX : event.clientY;
        setIsDragging(true);
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
        setIsDragging(false);
        onEnd(true);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <div
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          backgroundColor: isActive
            ? theme.borderActive.val
            : theme.borderSubdued.val,
          ...(isColumn
            ? {
                left: (HIT_SIZE - 1) / 2,
                top: 0,
                bottom: 0,
                width: isActive ? 3 : 1,
                marginLeft: isActive ? -1 : 0,
              }
            : {
                top: (HIT_SIZE - 1) / 2,
                left: 0,
                right: 0,
                height: isActive ? 3 : 1,
                marginTop: isActive ? -1 : 0,
              }),
        }}
      />
    </div>
  );
}
