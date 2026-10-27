import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { SizableText, useTheme } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import { useLoanToneColors } from './loanToneColors';

import type { ILoanLtvBarProps } from './loanLtvBar.types';

const THUMB_SIZE = 18;
const TRACK_HEIGHT = 6;
const HIT_HEIGHT = 26;
const WALL_HEIGHT = 14;
// The track runs the block's full width, level with the figures above; the
// thumb's center stops half a thumb from each end
const INSET = THUMB_SIZE / 2;
// Moves made with the keyboard
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.1;
// Figures typed or a market switched glide there; a drag follows the finger
const GLIDE = '180ms cubic-bezier(0.2, 0, 0, 1)';

// Quiet greys, so the loan's color and the white thumb lead
const SURFACES = {
  dark: {
    track: 'rgba(255, 255, 255, 0.13)',
    locked: 'rgba(255, 255, 255, 0.05)',
    used: 'rgba(255, 255, 255, 0.4)',
    wall: 'rgba(255, 255, 255, 0.55)',
    thumbShadow: '0 0 0 0.5px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.5)',
    // Around the thumb while it is held
    halo: 'rgba(255, 255, 255, 0.16)',
  },
  light: {
    track: 'rgba(0, 0, 0, 0.1)',
    locked: 'rgba(0, 0, 0, 0.04)',
    used: 'rgba(0, 0, 0, 0.3)',
    wall: 'rgba(0, 0, 0, 0.45)',
    thumbShadow:
      '0 0 0 0.5px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.18)',
    halo: 'rgba(0, 0, 0, 0.08)',
  },
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Where a value sits on the track
const posAt = (value: number) =>
  `calc(${INSET}px + (100% - ${INSET * 2}px) * ${clamp01(value)})`;

// The part of the track between two values; from 0 or to 1 it reaches the
// track's end
const span = (from: number, to: number): CSSProperties => ({
  left: from <= 0 ? 0 : posAt(from),
  right: to >= 1 ? 0 : `calc(100% - ${posAt(to)})`,
});

const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

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
  const surfaces = SURFACES[useThemeVariant() === 'light' ? 'light' : 'dark'];
  const { fill } = useLoanToneColors();

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
      if (rect.width <= INSET * 2) {
        return lower;
      }
      return clamp((clientX - rect.left - INSET) / (rect.width - INSET * 2));
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
  const loanColor = overCap ? fill.critical : fill[tone];
  const glideEnds = isDragging ? '' : `left ${GLIDE}, right ${GLIDE}, `;
  const part = (
    from: number,
    to: number,
    background: string,
  ): CSSProperties => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    ...span(from, to),
    background,
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
        style={{
          position: 'relative',
          height: HIT_HEIGHT,
          cursor: isDisabled ? 'default' : 'pointer',
          userSelect: 'none',
          touchAction: 'none',
          outline: focusVisible ? `2px solid ${theme.focusRing.val}` : 'none',
          outlineOffset: 2,
          borderRadius: 6,
        }}
      >
        <div
          ref={trackRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: TRACK_HEIGHT,
            marginTop: -TRACK_HEIGHT / 2,
            borderRadius: TRACK_HEIGHT / 2,
            overflow: 'hidden',
            background: surfaces.track,
            opacity: bar ? 1 : 0.5,
          }}
        >
          {bar?.cap !== undefined ? (
            // Past Max LTV the loan can't go: the track dims
            <div style={part(bar.cap, 1, surfaces.locked)} />
          ) : null}
          {bar?.liquidation !== undefined && bar.liquidation < 1 ? (
            // Deeper red toward 100%
            <div
              title={liquidationLabel}
              style={{
                ...part(
                  bar.liquidation,
                  1,
                  `linear-gradient(90deg, ${tint(fill.critical, 35)}, ${tint(
                    fill.critical,
                    60,
                  )})`,
                ),
                pointerEvents: 'auto',
              }}
            />
          ) : null}
          {used > 0 ? (
            // What is borrowed in the market already
            <div
              style={{
                ...part(0, used, surfaces.used),
                transition: isDragging ? 'none' : `right ${GLIDE}`,
              }}
            />
          ) : null}
          {shown > used ? (
            <div
              style={{
                ...part(used, shown, loanColor),
                transition: `${glideEnds}background-color ${GLIDE}`,
              }}
            />
          ) : null}
        </div>
        {bar?.cap !== undefined ? (
          // The wall the thumb stops at
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: posAt(bar.cap),
              width: 2,
              height: WALL_HEIGHT,
              marginTop: -WALL_HEIGHT / 2,
              marginLeft: -1,
              borderRadius: 1,
              background: surfaces.wall,
              transition: `left ${GLIDE}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {bar ? (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: posAt(shown),
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              marginTop: -THUMB_SIZE / 2,
              marginLeft: -THUMB_SIZE / 2,
              borderRadius: '50%',
              background: '#FFFFFF',
              // Held, the thumb grows and a soft ring shows around it
              boxShadow: `0 0 0 ${isDragging ? 6 : 0}px ${
                surfaces.halo
              }, ${surfaces.thumbShadow}`,
              transform: isDragging ? 'scale(1.1)' : 'scale(1)',
              transition: `${
                isDragging ? '' : `left ${GLIDE}, `
              }transform ${GLIDE}, box-shadow ${GLIDE}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      {/* Under the wall, its figure */}
      <div style={{ position: 'relative', height: 18 }}>
        {bar?.cap !== undefined && capLabel ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: posAt(bar.cap),
              transform: `translateX(${bar.cap > 0.8 ? '-100%' : '-50%'})`,
              whiteSpace: 'nowrap',
              transition: `left ${GLIDE}`,
            }}
          >
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {capLabel}
            </SizableText>
          </div>
        ) : null}
      </div>
    </div>
  );
}
