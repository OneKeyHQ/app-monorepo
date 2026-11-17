import { useRef, useState } from 'react';

import { useTheme } from '@onekeyhq/components';

import type { IPaneDragHandleProps } from './PaneDragHandle.types';

const MOVE_THRESHOLD = 2;
const DOUBLE_PRESS_MS = 350;

export function PaneDragHandle({
  top,
  label,
  testID,
  mode,
  title,
  onStart,
  onDrag,
  onReset,
}: IPaneDragHandleProps) {
  const start = useRef<number | null>(null);
  const lastPress = useRef(0);
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isResize = mode === 'resize';
  const isActive = isHovered || isDragging;
  const cancel = () => {
    if (start.current !== null) {
      start.current = null;
      setIsDragging(false);
      onDrag(0, true, true);
    }
  };
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
        left: isResize ? 0 : undefined,
        right: isResize ? 0 : 76,
        height: isResize ? 10 : 20,
        padding: mode === 'move' ? '0 5px' : 0,
        pointerEvents: 'auto',
        cursor: isResize ? 'ns-resize' : 'grab',
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
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        start.current = event.clientY;
        setIsDragging(true);
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
          const moved = Math.abs(delta) >= MOVE_THRESHOLD;
          start.current = null;
          setIsDragging(false);
          // A press without movement resizes nothing.
          onDrag(delta, true, !moved);
          event.currentTarget.releasePointerCapture(event.pointerId);
          const now = Date.now();
          if (moved) {
            lastPress.current = 0;
          } else if (now - lastPress.current <= DOUBLE_PRESS_MS) {
            lastPress.current = 0;
            if (isResize) onReset?.();
          } else {
            lastPress.current = now;
          }
        }
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      {isResize ? (
        <div
          style={{
            width: '100%',
            // The pane border stays where it is; the highlight grows around it.
            height: isActive ? 3 : 1,
            background: isActive
              ? theme.borderActive.val
              : theme.borderSubdued.val,
          }}
        />
      ) : (
        title
      )}
    </div>
  );
}
