import { useRef } from 'react';

import { useTheme } from '@onekeyhq/components';

import type { IPaneDragHandleProps } from './PaneDragHandle.types';

export function PaneDragHandle({
  top,
  label,
  testID,
  mode,
  title,
  onStart,
  onDrag,
}: IPaneDragHandleProps) {
  const start = useRef<number | null>(null);
  const theme = useTheme();
  return (
    <div
      data-testid={testID}
      role="separator"
      aria-label={label}
      aria-orientation="horizontal"
      title={label}
      style={{
        position: 'absolute',
        top,
        left: mode === 'resize' ? 0 : undefined,
        right: mode === 'resize' ? 0 : 76,
        height: mode === 'resize' ? 10 : 20,
        padding: mode === 'move' ? '0 5px' : 0,
        pointerEvents: 'auto',
        cursor: mode === 'resize' ? 'ns-resize' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        fontSize: 10,
        color: theme.textSubdued.val,
        background: mode === 'move' ? theme.bgApp.val : undefined,
        borderRadius: 3,
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        start.current = event.clientY;
        onStart();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current !== null) {
          event.preventDefault();
          event.stopPropagation();
          onDrag(event.clientY - start.current, false, false);
        }
      }}
      onPointerUp={(event) => {
        if (start.current !== null) {
          const delta = event.clientY - start.current;
          start.current = null;
          onDrag(delta, true, false);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        if (start.current !== null) {
          start.current = null;
          onDrag(0, true, true);
        }
      }}
      onLostPointerCapture={() => {
        if (start.current !== null) {
          start.current = null;
          onDrag(0, true, true);
        }
      }}
    >
      {mode === 'resize' ? (
        <div
          style={{
            width: '100%',
            height: 1,
            background: theme.borderSubdued.val,
          }}
        />
      ) : (
        title
      )}
    </div>
  );
}
