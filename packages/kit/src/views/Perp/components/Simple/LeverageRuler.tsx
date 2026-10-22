import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { useTheme } from '@onekeyhq/components';

import {
  LEVERAGE_FOCUSED_TICK_HEIGHT,
  LEVERAGE_RULER_HEIGHT,
  LEVERAGE_SETTLE_DURATION,
  LEVERAGE_TICK_HEIGHT,
  LEVERAGE_TICK_SPACING,
  LEVERAGE_TICK_WIDTH,
  LeverageRulerScale,
  clampLeverage,
  getRulerPosition,
  getRulerReleaseTarget,
  getRulerTickProgress,
} from './LeverageRulerScale';

import type { ILeverageRulerProps } from './LeverageRulerScale';

export function LeverageRuler({
  value,
  max,
  disabled = false,
  onChange,
  accessibilityLabel,
}: ILeverageRulerProps) {
  const theme = useTheme();
  const activeColor = disabled ? theme.textDisabled.val : theme.bgAccent.val;
  const scale = useRef<HTMLDivElement>(null);
  const ticks = useRef<(HTMLDivElement | null)[]>([]);
  const position = useRef(clampLeverage(value, max));
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  const frame = useRef<number | null>(null);
  const settling = useRef(false);
  const motionPreference = useMemo(
    () => globalThis.matchMedia('(prefers-reduced-motion: reduce)'),
    [],
  );
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    origin: number;
    active: boolean;
    lastX: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  const paint = useCallback(
    (next: number) => {
      position.current = next;
      if (!scale.current) return;
      const reduced = motionPreference.matches;
      const selected = clampLeverage(next, max);
      scale.current.style.transform = `translateX(${-(next - 1) * LEVERAGE_TICK_SPACING}px)`;
      ticks.current.forEach((tick, index) => {
        if (!tick) return;
        const progress = getRulerTickProgress(next, index + 1);
        const height = Number(tick.dataset.height);
        tick.style.backgroundColor =
          index + 1 === selected ? activeColor : (tick.dataset.color ?? '');
        const transform = reduced
          ? 'none'
          : `scale(${1 + progress * 0.5}, ${1 + progress * (LEVERAGE_FOCUSED_TICK_HEIGHT / height - 1)})`;
        if (tick.style.transform !== transform)
          tick.style.transform = transform;
      });
    },
    [activeColor, max, motionPreference],
  );
  const emit = useCallback((next: number) => {
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChangeRef.current(next);
  }, []);
  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    settling.current = false;
  }, []);
  useEffect(() => stop, [stop]);
  const settle = useCallback(
    (velocityX = 0) => {
      stop();
      const from = position.current;
      const target = getRulerReleaseTarget(
        from,
        motionPreference.matches ? 0 : velocityX,
        max,
      );
      if (motionPreference.matches || target === from) {
        paint(target);
        emit(target);
        return;
      }
      settling.current = true;
      const start = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - start) / LEVERAGE_SETTLE_DURATION);
        const next = from + (target - from) * (1 - (1 - progress) ** 3);
        paint(next);
        emit(clampLeverage(next, max));
        if (progress < 1) {
          frame.current = requestAnimationFrame(animate);
        } else {
          frame.current = null;
          settling.current = false;
        }
      };
      frame.current = requestAnimationFrame(animate);
    },
    [emit, max, motionPreference, paint, stop],
  );
  const renderTick = useCallback(
    (leverage: number, major: boolean) => (
      <div
        ref={(element) => {
          ticks.current[leverage - 1] = element;
        }}
        data-height={LEVERAGE_TICK_HEIGHT}
        data-color={major ? theme.borderStrong.val : theme.borderSubdued.val}
        style={{
          position: 'relative',
          width: LEVERAGE_TICK_WIDTH,
          height: LEVERAGE_TICK_HEIGHT,
          transformOrigin: 'center bottom',
          background: major ? theme.borderStrong.val : theme.borderSubdued.val,
        }}
      />
    ),
    [theme.borderStrong.val, theme.borderSubdued.val],
  );
  useLayoutEffect(() => {
    if (disabled) {
      drag.current = null;
      stop();
    }
    if (!drag.current && !settling.current) {
      const next = clampLeverage(value, max);
      paint(next);
      lastEmitted.current = next;
    }
  }, [disabled, max, paint, renderTick, stop, value]);
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const velocity =
      event.type === 'pointerup' &&
      drag.current.active &&
      performance.now() - drag.current.lastTime < 80
        ? drag.current.velocity
        : 0;
    drag.current = null;
    settle(velocity);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next = value;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next += 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next -= 1;
        break;
      case 'Home':
        next = 1;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    stop();
    drag.current = null;
    next = clampLeverage(next, max);
    paint(next);
    emit(next);
  };
  return (
    <div
      data-testid="perps-simple-leverage-slider"
      role="slider"
      aria-label={accessibilityLabel}
      aria-valuemin={1}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}x`}
      aria-orientation="horizontal"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        position: 'relative',
        height: LEVERAGE_RULER_HEIGHT,
        overflow: 'hidden',
        touchAction: 'pan-y',
        userSelect: 'none',
        cursor: disabled ? 'default' : 'ew-resize',
      }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (disabled || max <= 1 || event.button !== 0 || drag.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus({ preventScroll: true });
        stop();
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          origin: position.current,
          active: false,
          lastX: event.clientX,
          lastTime: performance.now(),
          velocity: 0,
        };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId || disabled) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.active) {
          if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
            finish(event);
            return;
          }
          if (Math.abs(dx) < 4) return;
          current.active = true;
        }
        const now = performance.now();
        const elapsed = now - current.lastTime;
        if (elapsed > 0) {
          const velocity = ((event.clientX - current.lastX) / elapsed) * 1000;
          current.velocity =
            Math.sign(velocity) === Math.sign(current.velocity)
              ? current.velocity * 0.35 + velocity * 0.65
              : velocity;
        }
        current.lastX = event.clientX;
        current.lastTime = now;
        paint(
          getRulerPosition(current.origin - dx / LEVERAGE_TICK_SPACING, max),
        );
        emit(clampLeverage(position.current, max));
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      <div
        ref={scale}
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          pointerEvents: 'none',
        }}
      >
        <LeverageRulerScale max={max} renderTick={renderTick} />
      </div>
    </div>
  );
}
