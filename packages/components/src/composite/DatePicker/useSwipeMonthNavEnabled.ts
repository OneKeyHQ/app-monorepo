import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMedia } from '../../hooks';

/**
 * Extra rehookify calendar offsets for the swipeable month pager. Rehookify
 * prepends the default offset 0, so the final calendars array becomes:
 * calendars[0] = current month, [1] = previous month, [2] = next month.
 */
export const SWIPE_PAGER_OFFSETS: number[] = [-1, 1];

/**
 * Rehookify calendar slot indexes produced by SWIPE_PAGER_OFFSETS.
 * Keep in sync with the offsets array above.
 */
export const CALENDAR_CURRENT = 0;
export const CALENDAR_PREV = 1;
export const CALENDAR_NEXT = 2;

/**
 * Swipe month navigation applies to native single-panel calendars only.
 * iPad (gtMd) keeps the dual-panel range layout; web/desktop keep buttons.
 */
export function useSwipeMonthNavEnabled(): boolean {
  const media = useMedia();
  return Boolean(platformEnv.isNative) && !media.gtMd;
}
