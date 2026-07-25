import { getTradingViewTimezone } from './tradingViewTimezone';

import type { Calendar } from 'expo-localization';

describe('getTradingViewTimezone', () => {
  it('uses the shared device time zone resolution for calendar data', () => {
    const calendars: Calendar[] = [
      {
        calendar: null,
        uses24hourClock: null,
        firstWeekday: null,
        timeZone: 'Asia/Shanghai',
      },
    ];

    expect(getTradingViewTimezone(calendars)).toBe('Asia/Shanghai');
  });
});
