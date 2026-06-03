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

import { useTheme } from '../../hooks/useStyle';

const THUMB_SIZE = 16;
const MARK_SIZE = 10;
// Square hit area around each mark so mouse/touch don't need pixel precision.
const MARK_HIT_AREA = 24;
const DEFAULT_TRACK_HEIGHT = 4;
const HIT_AREA_HEIGHT = 24;

export interface ISegmentSliderProps {
  value: number;
  sliderHeight?: number;
  onChange: (value: number) => void;
  segments: number;
  snapThreshold?: number;
  forceSnapToStep?: boolean;
  onSlideStart?: () => void;
  onSlideComplete?: () => void;
  renderThumb?: () => ReactNode;
  renderMark?: (props: { index: number }) => ReactNode;
  min?: number;
  max?: number;
  disabled?: boolean;
  showBubble?: boolean;
  /**
   * When true, the slider fills from center (0) instead of left edge.
   * Negative values fill left from center, positive values fill right from
   * center.
   */
  centerOrigin?: boolean;
}

interface ISegmentMarkProps {
  index: number;
  pct: number;
  hoverGlowColor: string;
  disabled: boolean;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
  reportPointerDown: (index: number) => void;
  customNode?: ReactNode;
}

const SegmentMark = memo(function SegmentMarkInner({
  index,
  pct,
  hoverGlowColor,
  disabled,
  registerRef,
  reportPointerDown,
  customNode,
}: ISegmentMarkProps) {
  const [hovered, setHovered] = useState(false);
  const hasCustom = customNode !== undefined && customNode !== null;

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => registerRef(index, el),
    [index, registerRef],
  );

  const handlePointerDown = useCallback(() => {
    // Don't stop propagation — the container needs to set up pointer capture
    // so drag continues to work even when the press starts on a mark.
    // Just hand off the mark index; the container will use that to snap the
    // initial value to the exact step instead of clientX-based raw value.
    if (disabled) return;
    reportPointerDown(index);
  }, [index, reportPointerDown, disabled]);

  const handleMouseEnter = useCallback(() => {
    if (!disabled) setHovered(true);
  }, [disabled]);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

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

  // background and borderColor are owned by applyMarkActiveStates (imperative
  // DOM mutation). Listing them here too would let a hover-triggered
  // re-render clobber the active-state fill set by the parent.
  // borderWidth/borderStyle MUST live here: borderColor alone doesn't render a
  // ring without a non-zero width and an explicit style, so the inactive marks
  // would otherwise be invisible white circles on a white page.
  const visualStyle = useMemo<CSSProperties>(
    () => ({
      width: MARK_SIZE,
      height: MARK_SIZE,
      borderRadius: '50%',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'transparent',
      boxSizing: 'border-box',
      boxShadow: hovered ? `0 0 0 4px ${hoverGlowColor}` : 'none',
      transition: 'box-shadow 150ms ease',
    }),
    [hovered, hoverGlowColor],
  );

  // When a custom renderMark is provided, it replaces the default visual
  // entirely (matches native: `if (renderMark) return renderMark({ index })`).
  // We skip the default circle wrapper AND skip ref registration so
  // applyMarkActiveStates can't mutate the custom node's styles.
  return (
    <div
      style={hitAreaStyle}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {hasCustom ? customNode : <div ref={handleRef} style={visualStyle} />}
    </div>
  );
});

function SegmentSliderComponent({
  value,
  sliderHeight = DEFAULT_TRACK_HEIGHT,
  onChange,
  segments,
  snapThreshold = 0,
  forceSnapToStep = false,
  onSlideStart,
  onSlideComplete,
  renderThumb,
  renderMark,
  min = 0,
  max = 100,
  disabled = false,
  showBubble = true,
  centerOrigin = false,
}: ISegmentSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastEmittedRef = useRef<number>(value);
  // When a pointerdown originates on a mark, the mark's handler runs first
  // (event capture/bubbling order) and stashes its index here. The
  // container's handler then reads this to know it should snap the initial
  // value to that exact step instead of using the raw clientX position.
  const markOriginRef = useRef<number | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);

  const theme = useTheme();
  // Tamagui exposes color tokens via `.val`; useTheme re-runs the component
  // when the theme changes, so we read fresh values on every render.
  const bgPrimary = theme.bgPrimary.val;
  const neutral5 = theme.neutral5.val;
  const bg = theme.bg.val;
  const borderStrong = theme.borderStrong.val;
  const borderActive = theme.borderActive.val;

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

  const applyMarkActiveStates = useCallback(
    (v: number) => {
      if (!hasSegments) return;
      const total = segments;
      const valuePct = valueToPct(v);
      markRefs.current.forEach((el, idx) => {
        if (!el) return;
        const markPct = (idx / total) * 100;
        let active = false;
        if (centerOrigin) {
          if (v === 0) {
            active = false;
          } else if (v > 0) {
            active = markPct > centerPct && markPct <= valuePct;
          } else {
            active = markPct >= valuePct && markPct < centerPct;
          }
        } else {
          active = markPct <= valuePct;
        }
        // Inactive marks: opaque page-bg fill with a gray ring so the track
        // line behind them doesn't bleed through.
        el.style.background = active ? bgPrimary : bg;
        el.style.borderColor = active ? bgPrimary : neutral5;
      });
    },
    [
      hasSegments,
      segments,
      valueToPct,
      centerOrigin,
      centerPct,
      bgPrimary,
      bg,
      neutral5,
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
          fill.style.left = '0%';
          fill.style.width = `${pct}%`;
        }
      }

      const bubble = bubbleRef.current;
      if (bubble) {
        bubble.style.left = `${pct}%`;
        bubble.textContent = `${Math.round(v)}%`;
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
      const rounded = Math.round(snapped);
      applyVisual(rounded);
      if (rounded !== lastEmittedRef.current) {
        lastEmittedRef.current = rounded;
        onChange(rounded);
      }
    },
    [snap, onChange, applyVisual],
  );

  const setBubbleVisible = useCallback((visible: boolean) => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    bubble.style.opacity = visible ? '1' : '0';
  }, []);

  const snapToStep = useCallback(
    (idx: number) => {
      if (!hasSegments) return;
      const snapped = Math.round(min + idx * stepValue);
      applyVisual(snapped);
      if (snapped !== lastEmittedRef.current) {
        lastEmittedRef.current = snapped;
        onChange(snapped);
      }
    },
    [hasSegments, min, stepValue, applyVisual, onChange],
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
      setBubbleVisible(true);
      // Mark-originated pointerdown: use the exact step value so a tap on a
      // mark always lands precisely (no off-by-one from clientX rounding).
      // Drag continues to work because we still set pointer capture above.
      const markIdx = markOriginRef.current;
      markOriginRef.current = null;
      if (markIdx !== null && hasSegments) {
        snapToStep(markIdx);
      } else {
        emit(valueFromClientX(e.clientX));
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
    },
    [
      disabled,
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
      emit(valueFromClientX(e.clientX));
    },
    [emit, valueFromClientX],
  );

  const finishDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const target = e.currentTarget;
      if (pointerIdRef.current !== null) {
        try {
          target.releasePointerCapture(pointerIdRef.current);
        } catch {
          /* ignore */
        }
      }
      pointerIdRef.current = null;
      // No tap-snap here. Marks themselves are the click targets — taps on
      // bare track keep whatever value the click landed at; taps on a mark
      // also bubble to this handler, but `markOriginRef` was set by
      // SegmentMark first and consumed inside handlePointerDown to snap to
      // the exact step rather than the raw clientX value.
      draggingRef.current = false;
      setBubbleVisible(false);
      onSlideComplete?.();
    },
    [onSlideComplete, setBubbleVisible],
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
        emit(lastEmittedRef.current + delta);
      }
    },
    [disabled, hasSegments, stepValue, emit, min, max],
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

  const registerMarkRef = useCallback(
    (idx: number, el: HTMLDivElement | null) => {
      markRefs.current[idx] = el;
    },
    [],
  );

  const markIndices = useMemo(() => {
    const arr: number[] = [];
    if (!hasSegments) return arr;
    for (let i = 0; i <= segments; i += 1) arr.push(i);
    return arr;
  }, [hasSegments, segments]);

  // Translucent halo for the mark hover ring. color-mix is widely supported
  // (Chrome 111+, Safari 16.2+, Firefox 113+).
  const markHoverGlow = useMemo(
    () => `color-mix(in srgb, ${bgPrimary} 25%, transparent)`,
    [bgPrimary],
  );

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: 'relative',
      width: '100%',
      height: HIT_AREA_HEIGHT,
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none',
      touchAction: 'none',
      opacity: disabled ? 0.5 : 1,
      outline: focusVisible ? `2px solid ${borderActive}` : 'none',
      outlineOffset: 2,
      borderRadius: 4,
    }),
    [disabled, focusVisible, borderActive],
  );

  const trackStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: '50%',
      left: THUMB_SIZE / 2,
      right: THUMB_SIZE / 2,
      transform: 'translateY(-50%)',
      height: sliderHeight,
      background: neutral5,
      borderRadius: sliderHeight / 2,
      pointerEvents: 'none',
    }),
    [sliderHeight, neutral5],
  );

  const fillStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '0%',
      height: '100%',
      background: bgPrimary,
      borderRadius: sliderHeight / 2,
      pointerEvents: 'none',
      willChange: 'left, width',
    }),
    [bgPrimary, sliderHeight],
  );

  const defaultThumbStyle = useMemo<CSSProperties>(
    () => ({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: '50%',
      background: bg,
      border: `1px solid ${borderStrong}`,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
      boxSizing: 'border-box',
    }),
    [bg, borderStrong],
  );

  const thumbWrapperStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      top: '50%',
      left: '0%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      willChange: 'left',
      zIndex: 2,
    }),
    [],
  );

  const bubbleStyle = useMemo<CSSProperties>(
    () => ({
      position: 'absolute',
      bottom: '100%',
      left: '0%',
      marginBottom: 8,
      transform: 'translateX(-50%)',
      padding: '2px 8px',
      background: bgPrimary,
      color: bg,
      borderRadius: 4,
      fontSize: 12,
      lineHeight: '16px',
      fontWeight: 600,
      opacity: 0,
      transition: 'opacity 150ms ease',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }),
    [bgPrimary, bg],
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
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={containerStyle}
    >
      <div ref={trackRef} style={trackStyle}>
        <div ref={fillRef} style={fillStyle} />

        {markIndices.map((idx) => (
          <SegmentMark
            key={idx}
            index={idx}
            pct={(idx / segments) * 100}
            hoverGlowColor={markHoverGlow}
            disabled={disabled}
            registerRef={registerMarkRef}
            reportPointerDown={reportMarkPointerDown}
            customNode={renderMark ? renderMark({ index: idx }) : undefined}
          />
        ))}

        <div ref={thumbRef} style={thumbWrapperStyle}>
          {renderThumb ? renderThumb() : <div style={defaultThumbStyle} />}
        </div>

        {showBubble ? <div ref={bubbleRef} style={bubbleStyle} /> : null}
      </div>
    </div>
  );
}

export const SegmentSlider = memo(SegmentSliderComponent);
SegmentSlider.displayName = 'SegmentSlider';
