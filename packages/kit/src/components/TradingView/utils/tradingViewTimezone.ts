import { getDeviceTimeZone } from '@onekeyhq/shared/src/utils/timeZoneUtils';

import type { Calendar } from 'expo-localization';

/**
 * Get user's timezone for TradingView
 * Uses expo-localization first, fallback to Intl API, then to UTC
 */
export const getTradingViewTimezone = (calendars?: Calendar[]): string => {
  return getDeviceTimeZone(calendars?.[0]?.timeZone);
};
