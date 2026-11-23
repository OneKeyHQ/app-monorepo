import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { colord } from 'colord';

import { useTheme } from '../../hooks/useStyle';

import {
  DOTTED_ACTIVE_SCALE,
  DOTTED_BUBBLE_EDGE_INSET,
  DOTTED_BUBBLE_HEIGHT,
  DOTTED_BUBBLE_PATH,
  DOTTED_BUBBLE_WIDTH,
} from './dottedSliderConstants';
import { resolveDottedSliderColor } from './dottedSliderUtils';

import type { ISegmentSliderProps } from './DefaultSegmentSlider';

const DOTTED_TRACK_HEIGHT = 28;
const DOTTED_THUMB_SIZE = 28;
const DOTTED_INSET = DOTTED_TRACK_HEIGHT / 2;
// Square hit area around each mark so mouse/touch don't need pixel precision.
const MARK_HIT_AREA = 24;
const bubbleShapeStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: -1,
};
const bubbleTextStyle: CSSProperties = { position: 'relative' };

// Keep half-step marks symmetric when the slider emits integer values.
function roundHalfToEven(value: number) {
  const lower = Math.floor(value);
  if (value - lower !== 0.5) {
    return Math.round(value);
  }
  return lower % 2 === 0 ? lower : lower + 1;
}

interface ISegmentMarkProps {
  index: number;
  pct: number;
  disabled: boolean;
  reportPointerDown: (index: number) => void;
  children: ReactNode;
}

const SegmentMark = memo(
  ({
    index,
    pct,
    disabled,
    reportPointerDown,
    children,
  }: ISegmentMarkProps) => {
    const handlePointerDown = useCallback(() => {
      // Don't stop propagation — the container needs to set up pointer capture
      // so drag continues to work even when the press starts on a mark.
      // Just hand off the mark index; the container will use that to snap the
      // initial value to the exact step instead of clientX-based raw value.
      if (disabled) return;
      reportPointerDown(index);
    }, [index, reportPointerDown, disabled]);

    const hitAreaStyle = useMemo<CSSProperties>(
      () => ({
        position: 'absolute',
        top: '50%',
        left: `${pct}%`,
        transform: 'translate(-50%, -50%)',
        width: MARK_HIT_AREA,
        height: MARK_HIT_AREA,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        // Track has pointer-events: none, so the mark must explicitly opt back
        // in to receive hover and click.
        pointerEvents: 'auto',
        zIndex: 3,
      }),
      [pct, disabled],
    );

    return (
      <div style={hitAreaStyle} onPointerDown={handlePointerDown}>
        {children}
      </div>
    );
  },
);
SegmentMark.displayName = 'SegmentMark';

function DottedSliderComponent({
  value,
  activeColor,
  onChange,
  segments,
  snapThreshold = 0,
  forceSnapToStep = false,
  onSlideStart,
  onSlideComplete,
  onSlideCancel,
  snapTapToSegment = false,
  renderThumb,
  min = 0,
  max = 100,
  disabled = false,
  showBubble = true,
  alignSegmentMarksToIntegerValues = false,
  centerOrigin = false,
}: ISegmentSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTextRef = useRef<HTMLSpanElement>(null);
  const dottedLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0, dragged: false, value });
  const lastEmittedRef = useRef<number>(value);
  // When a pointerdown originates on a mark, the mark's handler runs first
  // (event capture/bubbling order) and stashes its index here. The
  // container's handler then reads this to know it should snap the initial
  // value to that exact step instead of using the raw clientX position.
  const markOriginRef = useRef<number | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const active = !disabled && (pressed || hovered);
  const hoveredRef = useRef(false);

  const theme = useTheme();
  // Tamagui exposes color tokens via `.val`; useTheme re-runs the component
  // when the theme changes, so we read fresh values on every render.
  const sourceColor = activeColor ?? theme.bgPrimary.val;
  const bgPrimary = useMemo(
    () =>
      resolveDottedSliderColor(
        sourceColor,
        theme.neutral3.val,
        theme.bgApp.val,
      ),
    [sourceColor, theme.neutral3.val, theme.bgApp.val],
  );
  const fillStartColor = useMemo(
    () =>
      resolveDottedSliderColor(
        colord(bgPrimary).alpha(0.75).toRgbString(),
        theme.neutral3.val,
        theme.bgApp.val,
      ),
    [bgPrimary, theme.neutral3.val, theme.bgApp.val],
  );
  const bg = theme.bg.val;
  const borderActive = theme.borderActive.val;

  const activeTextColor = colord(bgPrimary).isLight() ? '#000000' : '#FFFFFF';

  const range = max - min;
  const safeRange = range || 1;
  // segments < 1 disables segment marks and snap entirely (continuous slider).
  const hasSegments = segments >= 1;
  const stepValue = hasSegments ? range / segments : 0;

  const valueToPct = useCallback(
    (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      return ((clamped - min) / safeRange) * 100;
    },
    [min, max, safeRange],
  );

  const centerPct = useMemo(() => valueToPct(0), [valueToPct]);

  const segmentIndexToValue = useCallback(
    (index: number) => {
      const segmentValue = min + index * stepValue;
      return alignSegmentMarksToIntegerValues
        ? roundHalfToEven(segmentValue)
        : Math.round(segmentValue);
    },
    [alignSegmentMarksToIntegerValues, min, stepValue],
  );

  const segmentIndexToPct = useCallback(
    (index: number) =>
      alignSegmentMarksToIntegerValues
        ? valueToPct(segmentIndexToValue(index))
        : (index / segments) * 100,
    [
      alignSegmentMarksToIntegerValues,
      segmentIndexToValue,
      segments,
      valueToPct,
    ],
  );

  const applyMarkActiveStates = useCallback(
    (v: number) => {
      if (!hasSegments) return;
      const valuePct = valueToPct(v);
      dottedLabelRefs.current.forEach((label, index) => {
        if (label)
          label.style.color =
            segmentIndexToPct(index) <= valuePct
              ? activeTextColor
              : theme.textSubdued.val;
      });
    },
    [
      hasSegments,
      activeTextColor,
      theme.textSubdued.val,
      valueToPct,
      segmentIndexToPct,
    ],
  );

  const applyVisual = useCallback(
    (v: number) => {
      const pct = valueToPct(v);
      const thumbEl = thumbRef.current;
      if (thumbEl) thumbEl.style.left = `${pct}%`;

      const fill = fillRef.current;
      if (fill) {
        if (centerOrigin) {
          if (v === 0) {
            fill.style.width = '0%';
          } else {
            const left = Math.min(pct, centerPct);
            const width = Math.abs(pct - centerPct);
            fill.style.left = `${left}%`;
            fill.style.width = `${width}%`;
          }
        } else {
          fill.style.left = `${-DOTTED_INSET}px`;
          fill.style.width =
            pct <= 0 ? '0px' : `calc(${pct}% + ${DOTTED_INSET}px)`;
        }
      }

      const bubble = bubbleRef.current;
      if (bubble) {
        bubble.style.left = `clamp(${DOTTED_BUBBLE_WIDTH + DOTTED_BUBBLE_EDGE_INSET - DOTTED_INSET}px, ${pct}%, calc(100% + ${DOTTED_INSET - DOTTED_BUBBLE_EDGE_INSET}px))`;
        if (bubbleTextRef.current)
          bubbleTextRef.current.textContent = `${Math.round(v)}%`;
      }

      applyMarkActiveStates(v);
    },
    [valueToPct, centerOrigin, centerPct, applyMarkActiveStates],
  );

  // Initial paint, external value sync, and theme repaint. Uses
  // useLayoutEffect so the thumb sits at the correct position on the very
  // first paint (no "fly in from 0" on mount or remount). Skips when the user
  // is dragging so the thumb doesn't fight the finger. applyVisual carries
  // the theme color closure, so adding it to the deps covers theme changes.
  useLayoutEffect(() => {
    if (draggingRef.current) return;
    lastEmittedRef.current = value;
    applyVisual(value);
  }, [value, applyVisual]);

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return lastEmittedRef.current;
      const rect = track.getBoundingClientRect();
      const w = rect.width;
      if (w <= 0) return lastEmittedRef.current;
      const x = Math.max(0, Math.min(w, clientX - rect.left));
      const pct = x / w;
      return min + pct * range;
    },
    [min, range],
  );

  const clampValue = useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max],
  );

  const snap = useCallback(
    (v: number): number => {
      // Guard against min===max (stepValue=0) and other degenerate ranges so
      // we never hand NaN/Infinity to onChange.
      if (!hasSegments || stepValue <= 0 || !Number.isFinite(stepValue)) {
        return clampValue(v);
      }
      const idx = Math.round((v - min) / stepValue);
      const snapped = min + idx * stepValue;
      if (forceSnapToStep) return clampValue(snapped);
      if (Math.abs(snapped - v) <= snapThreshold) return clampValue(snapped);
      return clampValue(v);
    },
    [hasSegments, min, stepValue, forceSnapToStep, snapThreshold, clampValue],
  );

  const emit = useCallback(
    (rawValue: number) => {
      const snapped = snap(rawValue);
      const rounded = alignSegmentMarksToIntegerValues
        ? roundHalfToEven(snapped)
        : Math.round(snapped);
      applyVisual(snapped);
      if (rounded !== lastEmittedRef.current) {
        lastEmittedRef.current = rounded;
        onChange(rounded);
      }
    },
    [alignSegmentMarksToIntegerValues, snap, onChange, applyVisual],
  );

  const setBubbleVisible = useCallback((visible: boolean) => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const show = visible || hoveredRef.current;
    bubble.style.opacity = show ? '1' : '0';
  }, []);

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || event.pointerType !== 'mouse') return;
      hoveredRef.current = true;
      setHovered(true);
      setBubbleVisible(true);
    },
    [disabled, setBubbleVisible],
  );
  const handlePointerLeave = useCallback(() => {
    hoveredRef.current = false;
    setHovered(false);
    if (!draggingRef.current) setBubbleVisible(false);
  }, [setBubbleVisible]);

  const snapToStep = useCallback(
    (idx: number) => {
      if (!hasSegments) return;
      const snapped = segmentIndexToValue(idx);
      applyVisual(snapped);
      if (snapped !== lastEmittedRef.current) {
        lastEmittedRef.current = snapped;
        onChange(snapped);
      }
    },
    [hasSegments, segmentIndexToValue, applyVisual, onChange],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const target = e.currentTarget;
      let captured = false;
      try {
        target.setPointerCapture(e.pointerId);
        pointerIdRef.current = e.pointerId;
        captured = true;
      } catch {
        /* setPointerCapture can throw on some browsers; ignore */
      }
      onSlideStart?.();
      pointerStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        dragged: false,
        value,
      };
      setBubbleVisible(true);
      // Mark-originated pointerdown: use the exact step value so a tap on a
      // mark always lands precisely (no off-by-one from clientX rounding).
      // Drag continues to work because we still set pointer capture above.
      const markIdx = markOriginRef.current;
      markOriginRef.current = null;
      if (markIdx !== null && hasSegments) {
        snapToStep(markIdx);
      } else {
        const next = valueFromClientX(e.clientX);
        const width = trackRef.current?.getBoundingClientRect().width ?? 0;
        const nearestIndex = Math.round((next - min) / stepValue);
        const distance =
          (Math.abs(next - (min + nearestIndex * stepValue)) / safeRange) *
          width;
        if (
          snapTapToSegment &&
          hasSegments &&
          width > 0 &&
          distance <= Math.min(12, (width / segments) * 0.2)
        ) {
          snapToStep(nearestIndex);
        } else {
          emit(next);
        }
      }
      if (!captured) {
        // Without pointer capture, pointermove/pointerup may never reach the
        // container if the user drags outside, leaving draggingRef stuck.
        // Treat this as a single tap: emit once above, then finalize.
        setBubbleVisible(false);
        onSlideComplete?.();
        return;
      }
      draggingRef.current = true;
      setPressed(true);
    },
    [
      disabled,
      value,
      min,
      stepValue,
      safeRange,
      segments,
      snapTapToSegment,
      onSlideStart,
      onSlideComplete,
      setBubbleVisible,
      hasSegments,
      snapToStep,
      emit,
      valueFromClientX,
    ],
  );

  const reportMarkPointerDown = useCallback((idx: number) => {
    markOriginRef.current = idx;
  }, []);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const start = pointerStartRef.current;
      if (snapTapToSegment && !start.dragged) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
        start.dragged = true;
      }
      emit(valueFromClientX(e.clientX));
    },
    [emit, valueFromClientX, snapTapToSegment],
  );

  const finishDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (e.type !== 'pointerup' && onSlideCancel) {
        lastEmittedRef.current = pointerStartRef.current.value;
        applyVisual(pointerStartRef.current.value);
        onSlideCancel();
      }
      const target = e.currentTarget;
      if (pointerIdRef.current !== null) {
        try {
          target.releasePointerCapture(pointerIdRef.current);
        } catch {
          /* ignore */
        }
      }
      pointerIdRef.current = null;
      // Taps retain the initial mark preview; only activated drags size freely.
      setPressed(false);
      setBubbleVisible(false);
      onSlideComplete?.();
    },
    [onSlideComplete, onSlideCancel, applyVisual, setBubbleVisible],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      // Keyboard: step by segment when segmented; by 1 unit when continuous.
      const keyboardStep = hasSegments ? stepValue : 1;
      let delta = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = keyboardStep;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
        delta = -keyboardStep;
      else if (e.key === 'Home') {
        e.preventDefault();
        emit(min);
        return;
      } else if (e.key === 'End') {
        e.preventDefault();
        emit(max);
        return;
      }
      if (delta !== 0) {
        e.preventDefault();
        if (alignSegmentMarksToIntegerValues && hasSegments) {
          const currentIndex = Math.round(
            (lastEmittedRef.current - min) / stepValue,
          );
          const nextIndex = currentIndex + (delta > 0 ? 1 : -1);
          emit(min + nextIndex * stepValue);
        } else {
          emit(lastEmittedRef.current + delta);
        }
      }
    },
    [
      disabled,
      alignSegmentMarksToIntegerValues,
      hasSegments,
      stepValue,
      emit,
      min,
      max,
    ],
  );

  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // Only show focus ring for keyboard focus, not mouse clicks.
    const node = e.currentTarget;
    if (node && typeof node.matches === 'function') {
      try {
        setFocusVisible(node.matches(':focus-visible'));
        return;
      } catch {
        /* :focus-visible not supported, fall through */
      }
    }
    setFocusVisible(false);
  }, []);

  const handleBlur = useCallback(() => setFocusVisible(false), []);

  const markIndices = useMemo(() => {
    const arr: number[] = [];
    if (!hasSegments) return arr;
    for (let i = 0; i <= segments; i += 1) arr.push(i);
    return arr;
  }, [hasSegments, segments]);

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: 'relative',
      width: '100%',
      height: 44,
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none',
      touchAction: 'none',
      opacity: disabled ? 0.5 : 1,
      outline: focusVisible ? `2px solid ${borderActive}` : 'none',
      outlineOffset: 2,
      borderRadius: 4,
      transform: `scale(${1 + Number(active) * (DOTTED_ACTIVE_SCALE - 1)})`,
      transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
    }),
    [disabled, focusVisible, borderActive, active],
  );

  const trackStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: '50%',
      left: DOTTED_INSET,
      right: DOTTED_INSET,
      transform: 'translateY(-50%)',
      height: DOTTED_TRACK_HEIGHT,
      borderRadius: 999,
      pointerEvents: 'none',
    }),
    [],
  );

  const fillStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '0%',
      height: '100%',
      backgroundColor: bgPrimary,
      backgroundImage: `linear-gradient(to right, ${fillStartColor}, ${bgPrimary} calc(100% - ${DOTTED_THUMB_SIZE / 2}px), ${bgPrimary})`,
      borderRadius: '14px 0 0 14px',
      pointerEvents: 'none',
      willChange: 'left, width',
      zIndex: 1,
    }),
    [bgPrimary, fillStartColor],
  );

  const defaultThumbStyle = useMemo<CSSProperties>(
    () => ({
      width: DOTTED_THUMB_SIZE,
      height: DOTTED_THUMB_SIZE,
      borderRadius: '50%',
      background: bg,
      backgroundClip: 'padding-box',
      border: `3px solid ${bgPrimary}`,
      boxSizing: 'border-box',
    }),
    [bg, bgPrimary],
  );

  const thumbWrapperStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: '50%',
      left: '0%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      willChange: 'left',
      zIndex: 4,
    }),
    [],
  );

  const bubbleStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      bottom: '100%',
      left: '0%',
      marginBottom: 0,
      transform: 'translateX(-100%)',
      padding: '2px 0 0',
      color: theme.text.val,
      width: DOTTED_BUBBLE_WIDTH,
      height: DOTTED_BUBBLE_HEIGHT,
      textAlign: 'center',
      boxSizing: 'border-box',
      fontSize: 10,
      lineHeight: '16px',
      fontWeight: 600,
      opacity: 0,
      transition: 'none',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 5,
    }),
    [theme.text.val],
  );
  const dottedMarkStyle = useMemo<CSSProperties>(
    () => ({
      width: 5,
      height: 5,
      borderRadius: '50%',
      backgroundColor: theme.textSubdued.val,
      opacity: active ? 0 : 0.45,
      transition: 'opacity 120ms ease',
    }),
    [active, theme.textSubdued.val],
  );
  const dottedLabelStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      fontSize: 10,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      opacity: active ? 0.65 : 0,
      transition: 'opacity 120ms ease',
      pointerEvents: 'none',
    }),
    [active],
  );
  const dottedLabelStyles = useMemo(
    () =>
      markIndices.map((index) => {
        let offset = 0;
        if (index === 0) offset = 6;
        else if (index === segments) offset = -8;
        return { ...dottedLabelStyle, transform: `translateX(${offset}px)` };
      }),
    [dottedLabelStyle, markIndices, segments],
  );
  const dottedBackgroundStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: -DOTTED_INSET,
      right: -DOTTED_INSET,
      borderRadius: 999,
      background: theme.neutral3.val,
      pointerEvents: 'none',
    }),
    [theme.neutral3.val],
  );

  const registerDottedLabels = useMemo(
    () =>
      markIndices.map((idx) => (element: HTMLSpanElement | null) => {
        dottedLabelRefs.current[idx] = element;
      }),
    [markIndices],
  );
  const minorMarks = useMemo(
    () =>
      markIndices.slice(0, -1).map((idx) => ({
        index: idx,
        style: {
          ...dottedMarkStyle,
          position: 'absolute' as const,
          left: `${((idx + 0.5) / segments) * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: active ? 0.45 : 0,
          zIndex: 2,
        },
      })),
    [dottedMarkStyle, markIndices, active, segments],
  );

  return (
    <div
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={containerStyle}
    >
      <div ref={trackRef} style={trackStyle}>
        <div style={dottedBackgroundStyle} />
        <div
          ref={fillRef}
          data-testid="segment-slider-fill"
          style={fillStyle}
        />

        {markIndices.map((idx) => (
          <SegmentMark
            key={idx}
            index={idx}
            pct={segmentIndexToPct(idx)}
            disabled={disabled}
            reportPointerDown={reportMarkPointerDown}
          >
            <>
              <span style={dottedMarkStyle} />
              <span
                ref={registerDottedLabels[idx]}
                style={dottedLabelStyles[idx]}
                aria-hidden="true"
              >
                {segmentIndexToValue(idx)}%
              </span>
            </>
          </SegmentMark>
        ))}

        {minorMarks.map(({ index, style }) => (
          <span key={`minor-${index}`} aria-hidden="true" style={style} />
        ))}
        <div ref={thumbRef} style={thumbWrapperStyle}>
          {renderThumb ? renderThumb() : <div style={defaultThumbStyle} />}
        </div>

        {showBubble ? (
          <div ref={bubbleRef} style={bubbleStyle}>
            <svg
              width={DOTTED_BUBBLE_WIDTH}
              height={DOTTED_BUBBLE_HEIGHT}
              style={bubbleShapeStyle}
              aria-hidden="true"
            >
              <path d={DOTTED_BUBBLE_PATH} fill={theme.neutral3.val} />
            </svg>
            <span ref={bubbleTextRef} style={bubbleTextStyle} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const DottedSlider = memo(DottedSliderComponent);
DottedSlider.displayName = 'DottedSlider';
