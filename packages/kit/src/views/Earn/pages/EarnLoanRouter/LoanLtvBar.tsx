import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { SizableText, useTheme } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import {
  LOAN_LTV_STEP,
  LOAN_LTV_STEP_LARGE,
  snapLoanLtv,
  stepLoanLtv,
} from './loanRouter.utils';
import { useLoanToneColors } from './loanToneColors';

import type { ILoanLtvBarProps } from './loanLtvBar.types';

const THUMB_SIZE = 18;
const TRACK_HEIGHT = 6;
const HIT_HEIGHT = 26;
// A press counts this far above and below the bar as well, for a finger; the
// layout keeps the bar's own height
const HIT_REACH = 8;
const WALL_HEIGHT = 14;
const CAP_ROW_HEIGHT = 18;
// The track runs the block's full width, level with the figures above; the
// thumb's center stops half a thumb from each end
const INSET = THUMB_SIZE / 2;
// Figures typed or a market switched glide there; a drag follows the finger
const GLIDE = '180ms cubic-bezier(0.2, 0, 0, 1)';
// What the market's figures bring fades in as the form's figures do
const REVEAL_MS = 150;
// The thumb counts as at Max LTV this close to it
const AT_CAP = 0.0005;

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

const fadeIn = (element: HTMLElement | null) => {
  element?.animate?.([{ opacity: 0 }, { opacity: 1 }], {
    duration: REVEAL_MS,
    easing: 'ease-out',
  });
};

/**
 * The market position's LTV, 0 to 100%: what is borrowed there already, this
 * loan in the color of the health factor it leaves, and the thumb, which
 * moves in whole percents and stops at Max LTV. Past it the track dims; from
 * the liquidation LTV on it is red. Dragging sets the loan
 */
export function LoanLtvBar({
  bar,
  isInert,
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
  const reduceMotion = useReducedMotion();

  const trackRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const capRowRef = useRef<HTMLDivElement>(null);
  const capLabelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pendingRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const [dragValue, setDragValue] = useState<number>();
  const [focusVisible, setFocusVisible] = useState(false);
  // How far the line under the bar moves off center to stay within the
  // bar's ends
  const [labelShift, setLabelShift] = useState(0);
  // The pointer over the red part: the line under the bar names it
  const [isOverRed, setIsOverRed] = useState(false);

  // What the thumb and the loan draw from: none while the figures load or
  // where the market doesn't lend
  const live = isInert ? undefined : bar;
  const lower = live && !live.isPreview ? live.used : 0;
  const upper = Math.max(lower, live?.cap ?? 1);
  const isDisabled = disabled || !live;
  const bounds = useMemo(() => ({ lower, upper }), [lower, upper]);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);
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
          onChange(pendingRef.current, false);
        }
      });
    },
    [onChange],
  );
  useEffect(() => cancelFrame, [cancelFrame]);

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
      return snapLoanLtv(
        (clientX - rect.left - INSET) / (rect.width - INSET * 2),
        bounds,
      );
    },
    [bounds, lower],
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
      // Held, the line under the bar shows Max again
      setIsOverRed(false);
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
  // Let go: the last value is final. A frame still waiting would hand the
  // page a value in motion after it
  const finishDrag = useCallback(() => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    cancelFrame();
    if (pendingRef.current !== undefined) {
      onChange(pendingRef.current, true);
      pendingRef.current = undefined;
    }
    setDragValue(undefined);
    onSlideEnd?.();
  }, [cancelFrame, onChange, onSlideEnd]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isDisabled || !live) {
        return;
      }
      const step = event.shiftKey ? LOAN_LTV_STEP_LARGE : LOAN_LTV_STEP;
      const by = (size: number, direction: 1 | -1) =>
        stepLoanLtv(live.value, { step: size, direction, ...bounds });
      const moves: Record<string, (() => number) | undefined> = {
        ArrowRight: () => by(step, 1),
        ArrowUp: () => by(step, 1),
        ArrowLeft: () => by(step, -1),
        ArrowDown: () => by(step, -1),
        PageUp: () => by(LOAN_LTV_STEP_LARGE, 1),
        PageDown: () => by(LOAN_LTV_STEP_LARGE, -1),
        Home: () => lower,
        End: () => upper,
      };
      const move = moves[event.key];
      if (!move) {
        return;
      }
      event.preventDefault();
      onChange(move(), true);
    },
    [bounds, isDisabled, live, lower, onChange, upper],
  );

  // The line under the bar: Max LTV under the wall, or, with the pointer
  // over the red part, the liquidation LTV under where the red starts. It
  // sits centered under its place, moved in where it would run past the
  // bar's end (a high Max on a phone-width bar)
  const liquidation = live?.liquidation;
  const showsLiquidation =
    isOverRed &&
    Boolean(liquidationLabel) &&
    liquidation !== undefined &&
    liquidation < 1;
  const labelAt = showsLiquidation ? liquidation : live?.cap;
  const labelText = showsLiquidation ? liquidationLabel : capLabel;
  useLayoutEffect(() => {
    const row = capRowRef.current;
    const label = capLabelRef.current;
    if (!row || !label || labelAt === undefined) {
      return undefined;
    }
    const place = () => {
      const width = row.offsetWidth;
      const labelWidth = label.offsetWidth;
      const centered =
        INSET + (width - INSET * 2) * clamp01(labelAt) - labelWidth / 2;
      const left = Math.max(0, Math.min(width - labelWidth, centered));
      setLabelShift(left - centered);
    };
    place();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(place);
    observer.observe(row);
    return () => observer.disconnect();
  }, [labelAt, labelText]);

  // Once the market's figures are in, the loan, the limit and the thumb fade
  // in rather than appear at once
  const isLive = Boolean(live);
  const wasLiveRef = useRef(isLive);
  useLayoutEffect(() => {
    if (isLive && !wasLiveRef.current && !reduceMotion) {
      fadeIn(layerRef.current);
      fadeIn(wallRef.current);
      fadeIn(thumbRef.current);
      fadeIn(capLabelRef.current);
    }
    wasLiveRef.current = isLive;
  }, [isLive, reduceMotion]);

  const isDragging = dragValue !== undefined;
  const shown = dragValue ?? live?.value ?? 0;
  // Where the market doesn't lend, the position as it stands
  let used = 0;
  if (live && !live.isPreview) {
    used = live.used;
  } else if (isInert && bar && !bar.isPreview) {
    used = bar.used;
  }
  const overCap = live?.cap !== undefined && shown > live.cap + 1e-9;
  const isAtCap =
    live?.cap !== undefined && !overCap && Math.abs(shown - live.cap) < AT_CAP;
  const loanColor = overCap ? fill.critical : fill[tone];
  let labelColor: '$text' | '$textSubdued' | '$textCritical' = '$textSubdued';
  if (showsLiquidation) {
    labelColor = '$textCritical';
  } else if (isAtCap) {
    labelColor = '$text';
  }
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

  let cursor: CSSProperties['cursor'] = 'pointer';
  if (isDisabled) {
    cursor = 'default';
  } else if (isDragging) {
    cursor = 'grabbing';
  }

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
          cursor,
          userSelect: 'none',
          touchAction: 'none',
          outline: focusVisible ? `2px solid ${theme.focusRing.val}` : 'none',
          outlineOffset: 2,
          borderRadius: 6,
        }}
      >
        {isDisabled ? null : (
          // The press area past the bar's own height
          <div
            style={{
              position: 'absolute',
              top: -HIT_REACH,
              bottom: -HIT_REACH,
              left: 0,
              right: 0,
            }}
          />
        )}
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
          }}
        >
          <div
            ref={layerRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {live?.cap !== undefined ? (
              // Past Max LTV the loan can't go: the track dims
              <div style={part(live.cap, 1, surfaces.locked)} />
            ) : null}
            {live?.liquidation !== undefined && live.liquidation < 1 ? (
              // Deeper red toward 100%
              <div
                style={part(
                  live.liquidation,
                  1,
                  `linear-gradient(90deg, ${tint(fill.critical, 35)}, ${tint(
                    fill.critical,
                    60,
                  )})`,
                )}
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
            {live && shown > used ? (
              <div
                style={{
                  ...part(used, shown, loanColor),
                  transition: `${glideEnds}background-color ${GLIDE}`,
                }}
              />
            ) : null}
          </div>
        </div>
        {live?.liquidation !== undefined &&
        live.liquidation < 1 &&
        liquidationLabel ? (
          // Over the red part, the line under the bar names it
          <div
            data-testid={testID ? `${testID}-liquidation` : undefined}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse' && !draggingRef.current) {
                setIsOverRed(true);
              }
            }}
            onPointerLeave={() => setIsOverRed(false)}
            style={{
              position: 'absolute',
              top: -HIT_REACH,
              bottom: -HIT_REACH,
              left: posAt(live.liquidation),
              right: 0,
            }}
          />
        ) : null}
        {live?.cap !== undefined ? (
          // The wall the thumb stops at
          <div
            ref={wallRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: posAt(live.cap),
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
        {live ? (
          <div
            ref={thumbRef}
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
      {/* Under the wall, its figure, brighter once the thumb is at it; over
          the red part, where liquidation starts. The line keeps its room
          while the figures load, so nothing moves once they are in */}
      {isInert ? null : (
        <div
          ref={capRowRef}
          style={{ position: 'relative', height: CAP_ROW_HEIGHT }}
        >
          {live && labelAt !== undefined && labelText ? (
            <div
              ref={capLabelRef}
              style={{
                position: 'absolute',
                top: 0,
                left: posAt(labelAt),
                transform: `translateX(calc(-50% + ${labelShift}px))`,
                width: 'max-content',
                whiteSpace: 'nowrap',
                transition: `left ${GLIDE}, transform ${GLIDE}`,
                pointerEvents: 'none',
              }}
            >
              <SizableText
                size="$bodySm"
                color={labelColor}
                numberOfLines={1}
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  transition: `color ${GLIDE}`,
                }}
              >
                {labelText}
              </SizableText>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
