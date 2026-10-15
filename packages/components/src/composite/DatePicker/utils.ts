import type { DPCalendar } from '@rehookify/datepicker';

export function callOnClick<T extends { onClick?: (...args: any[]) => void }>(
  obj: T,
): void {
  obj.onClick?.();
}

/**
 * Numeric year of a rehookify calendar. `calendar.year` is locale-formatted
 * (e.g. Arabic-Indic digits), so read it from an in-month day instead.
 */
export function getCalendarYear(cal: DPCalendar | undefined): number {
  const date = cal?.days.find((d) => d.inCurrentMonth)?.$date;
  return date ? date.getFullYear() : Number(cal?.year);
}
