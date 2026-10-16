import { useLayoutEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { DPCalendar } from '@rehookify/datepicker';

export function callOnClick<T extends { onClick?: (...args: any[]) => void }>(
  obj: T,
): void {
  obj.onClick?.();
}

/**
 * Latest-value ref written at commit time only: render-time writes could leak
 * values from an abandoned concurrent render into a press that lands on the
 * old committed UI. Lets handlers stay identity-stable while rehookify
 * recreates its data and prop getters on every render.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * First day of the month a rehookify calendar shows. Read from an in-month
 * day: `calendar.month` / `calendar.year` are locale-formatted strings
 * (e.g. Arabic-Indic digits) and can't be parsed back reliably.
 */
export function getCalendarMonthStart(
  cal: DPCalendar | undefined,
): Date | null {
  const date = cal?.days.find((d) => d.inCurrentMonth)?.$date;
  return date ? new Date(date.getFullYear(), date.getMonth(), 1) : null;
}

/** Ordinal month index (year * 12 + month); comparable across years. */
export function toMonthPosition(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

export function getCalendarMonthPosition(cal: DPCalendar | undefined): number {
  const start = getCalendarMonthStart(cal);
  return start ? toMonthPosition(start) : 0;
}

export function getCalendarYear(cal: DPCalendar | undefined): number {
  const start = getCalendarMonthStart(cal);
  return start ? start.getFullYear() : Number(cal?.year);
}

/**
 * Month-granular navigation bounds for a calendar showing `monthPosition`.
 * Rehookify's add/subtractOffset getters test the clamped day, not the month,
 * so they can report "enabled" for a step that doesn't move the calendar.
 */
export function getNavBounds(
  monthPosition: number,
  minDate?: Date,
  maxDate?: Date,
) {
  const year = Math.floor(monthPosition / 12);
  return {
    isPrevDisabled: minDate ? monthPosition <= toMonthPosition(minDate) : false,
    isNextDisabled: maxDate ? monthPosition >= toMonthPosition(maxDate) : false,
    isPrevYearDisabled: minDate ? year <= minDate.getFullYear() : false,
    isNextYearDisabled: maxDate ? year >= maxDate.getFullYear() : false,
  };
}

// ---- Shared cell interaction styles (DayCell, PeriodCell) ----

const selectedHoverStyle = { bg: '$bgPrimaryHover' } as const;
const idleHoverStyle = { bg: '$bgHover' } as const;
const idlePressStyle = { bg: '$bgActive' } as const;

function getHoverStyle(disabled: boolean, selected: boolean) {
  if (disabled) return undefined;
  return selected ? selectedHoverStyle : idleHoverStyle;
}

export function getCellStateStyles({
  disabled,
  selected,
  muted = false,
}: {
  disabled: boolean;
  selected: boolean;
  /** Outside days: interactive but de-emphasized unless selected. */
  muted?: boolean;
}) {
  let color: '$text' | '$textDisabled' | '$textInverse' = '$text';
  if (disabled) {
    color = '$textDisabled';
  } else if (selected) {
    color = '$textInverse';
  } else if (muted) {
    color = '$textDisabled';
  }
  return {
    color,
    bg: selected && !disabled ? '$bgPrimary' : 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    hoverStyle: getHoverStyle(disabled, selected),
    pressStyle: disabled || selected ? undefined : idlePressStyle,
  } as const;
}

// ---- Enter animations ----

export type ISlideDirection = -1 | 0 | 1;

const SLIDE_DISTANCE = 12;
const SLIDE_ENTER_STYLES = {
  [-1]: { opacity: 0, x: -SLIDE_DISTANCE },
  1: { opacity: 0, x: SLIDE_DISTANCE },
} as const;
const ZOOM_ENTER_STYLE = { opacity: 0, scale: 0.96 } as const;

/**
 * Enter style for calendar content: slide in from the side navigated to, or
 * zoom for month/year drill-down. Android skips enter animations, matching
 * layouts/SortableCell.
 */
export function getEnterStyle(kind: ISlideDirection | 'zoom') {
  if (platformEnv.isNativeAndroid || kind === 0) return undefined;
  return kind === 'zoom' ? ZOOM_ENTER_STYLE : SLIDE_ENTER_STYLES[kind];
}
