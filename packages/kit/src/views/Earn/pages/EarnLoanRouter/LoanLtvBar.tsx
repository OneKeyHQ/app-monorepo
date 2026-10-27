import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { SizableText, useTheme } from '@onekeyhq/components';

import type { ILoanLtvBarProps } from './loanLtvBar.types';

// As the Perps leverage slider: the thumb, its ring and the hit area
const THUMB_SIZE = 16;
const TRACK_HEIGHT = 6;
const HIT_HEIGHT = 24;
const WALL_HEIGHT = 14;
// Moves made with the keyboard
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.1;
// Figures typed or a market switched glide there; a drag follows the finger
const GLIDE = '150ms ease-out';

const toPercent = (value: number) =>
  `${Math.max(0, Math.min(1, value)) * 100}%`;

/**
 * The market position's LTV, 0 to 100%: what is borrowed there already, this
 * loan in the color of the health factor it leaves, and the thumb, which
 * stops at Max LTV. Past it the track dims; from the liquidation LTV on it is
 * red. Dragging sets the loan
 */
export function LoanLtvBar({
  bar,
  tone,
  disabled,
  onChange,
  onSlideStart,
  onSlideEnd,
  valueText,
  capLabel,
  liquidationLabel,
  testID,
}: ILoanLtvBarProps) {
  const theme = useTheme();
  const toneColor = {
    success: theme.iconSuccess.val,
    caution: theme.iconCaution.val,
    critical: theme.iconCritical.val,
  }[tone];

  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const [dragValue, setDragValue] = useState<number>();
  const [focusVisible, setFocusVisible] = useState(false);

  const lower = bar && !bar.isPreview ? bar.used : 0;
  const upper = Math.max(lower, bar?.cap ?? 1);
  const isDisabled = disabled || !bar;
  const clamp = useCallback(
    (value: number) => Math.max(lower, Math.min(upper, value)),
    [lower, upper],
  );

  // The page's figures follow a drag once a frame
  const emit = useCallback(
    (value: number) => {
      pendingRef.current = value;
      if (frameRef.current !== undefined) {
        return;
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = undefined;
        if (pendingRef.current !== undefined) {
          onChange(pendingRef.current);
        }
      });
    },
    [onChange],
  );
  useEffect(
    () => () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const valueAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) {
        return lower;
      }
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return lower;
      }
      return clamp((clientX - rect.left) / rect.width);
    },
    [clamp, lower],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isDisabled) {
        return;
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Without capture the press still sets the value once
      }
      draggingRef.current = true;
      onSlideStart?.();
      const value = valueAt(event.clientX);
      setDragValue(value);
      emit(value);
    },
    [emit, isDisabled, onSlideStart, valueAt],
  );
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) {
        return;
      }
      const value = valueAt(event.clientX);
      setDragValue(value);
      emit(value);
    },
    [emit, valueAt],
  );
  const finishDrag = useCallback(() => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    if (pendingRef.current !== undefined) {
      onChange(pendingRef.current);
    }
    setDragValue(undefined);
    onSlideEnd?.();
  }, [onChange, onSlideEnd]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isDisabled || !bar) {
        return;
      }
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      const moves: Record<string, number | undefined> = {
        ArrowRight: bar.value + step,
        ArrowUp: bar.value + step,
        ArrowLeft: bar.value - step,
        ArrowDown: bar.value - step,
        PageUp: bar.value + KEY_STEP_LARGE,
        PageDown: bar.value - KEY_STEP_LARGE,
        Home: lower,
        End: upper,
      };
      const next = moves[event.key];
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      onChange(clamp(next));
    },
    [bar, clamp, isDisabled, lower, onChange, upper],
  );

  const isDragging = dragValue !== undefined;
  const shown = dragValue ?? bar?.value ?? 0;
  const used = bar && !bar.isPreview ? bar.used : 0;
  const overCap = bar?.cap !== undefined && shown > bar.cap + 1e-9;
  const loanColor = overCap ? theme.iconCritical.val : toneColor;
  const transition = isDragging
    ? 'none'
    : `left ${GLIDE}, width ${GLIDE}, background-color ${GLIDE}`;

  const containerStyle: CSSProperties = {
    position: 'relative',
    height: HIT_HEIGHT,
    cursor: isDisabled ? 'default' : 'pointer',
    userSelect: 'none',
    touchAction: 'none',
    outline: focusVisible ? `2px solid ${theme.focusRing.val}` : 'none',
    outlineOffset: 2,
    borderRadius: 4,
  };
  const trackStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: TRACK_HEIGHT,
    transform: 'translateY(-50%)',
    background: theme.neutral5.val,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'visible',
    opacity: bar ? 1 : 0.5,
  };
  const zone = (left: number, width: number, color: string): CSSProperties => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: toPercent(left),
    width: toPercent(width),
    background: color,
    transition,
    pointerEvents: 'none',
  });

  return (
    <div data-testid={testID}>
      <div
        role="slider"
        aria-valuemin={Math.round(lower * 100)}
        aria-valuemax={Math.round(upper * 100)}
        // A loan typed past the wall reads out its real LTV in the text
        aria-valuenow={Math.round(Math.min(shown, upper) * 100)}
        aria-valuetext={valueText}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          setFocusVisible(event.currentTarget.matches(':focus-visible'));
        }}
        onBlur={() => setFocusVisible(false)}
        style={containerStyle}
      >
        <div ref={trackRef} style={trackStyle}>
          {bar?.cap !== undefined ? (
            // Past Max LTV the loan can't go: the track dims
            <div
              style={{
                ...zone(bar.cap, 1 - bar.cap, theme.neutral3.val),
                borderTopRightRadius: TRACK_HEIGHT / 2,
                borderBottomRightRadius: TRACK_HEIGHT / 2,
              }}
            />
          ) : null}
          {bar?.liquidation !== undefined && bar.liquidation < 1 ? (
            <div
              title={liquidationLabel}
              style={{
                ...zone(
                  bar.liquidation,
                  1 - bar.liquidation,
                  theme.iconCritical.val,
                ),
                opacity: 0.45,
                pointerEvents: 'auto',
                borderTopRightRadius: TRACK_HEIGHT / 2,
                borderBottomRightRadius: TRACK_HEIGHT / 2,
              }}
            />
          ) : null}
          {used > 0 ? (
            // What is borrowed in the market already
            <div
              style={{
                ...zone(0, used, theme.neutral8.val),
                borderTopLeftRadius: TRACK_HEIGHT / 2,
                borderBottomLeftRadius: TRACK_HEIGHT / 2,
              }}
            />
          ) : null}
          {shown > used ? (
            <div
              style={{
                ...zone(used, Math.min(1, shown) - used, loanColor),
                borderTopLeftRadius: used > 0 ? 0 : TRACK_HEIGHT / 2,
                borderBottomLeftRadius: used > 0 ? 0 : TRACK_HEIGHT / 2,
              }}
            />
          ) : null}
          {bar?.cap !== undefined ? (
            // The wall the thumb stops at
            <div
              style={{
                position: 'absolute',
                top: (TRACK_HEIGHT - WALL_HEIGHT) / 2,
                left: toPercent(bar.cap),
                width: 2,
                height: WALL_HEIGHT,
                marginLeft: -1,
                borderRadius: 1,
                background: theme.iconSubdued.val,
                transition,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          {bar ? (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: toPercent(shown),
                transform: 'translate(-50%, -50%)',
                transition: isDragging ? 'none' : `left ${GLIDE}`,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                  borderRadius: '50%',
                  background: theme.bg.val,
                  border: `1px solid ${theme.borderStrong.val}`,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                  boxSizing: 'border-box',
                  transform: isDragging ? 'scale(1.15)' : 'scale(1)',
                  transition: `transform ${GLIDE}`,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      {/* Under the wall, its figure */}
      <div
        style={{
          position: 'relative',
          height: 18,
          marginLeft: THUMB_SIZE / 2,
          marginRight: THUMB_SIZE / 2,
        }}
      >
        {bar?.cap !== undefined && capLabel ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: toPercent(bar.cap),
              transform: `translateX(${bar.cap > 0.8 ? '-100%' : '-50%'})`,
              whiteSpace: 'nowrap',
              transition,
            }}
          >
            <SizableText size="$bodySm" color="$textSubdued">
              {capLabel}
            </SizableText>
          </div>
        ) : null}
      </div>
    </div>
  );
}
