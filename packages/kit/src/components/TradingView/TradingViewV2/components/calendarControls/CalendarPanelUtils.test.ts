import {
  buildChartTimestamp,
  clampCalendarDateToRange,
  getCalendarMaximumTimestamp,
  getChartDateFromTimestamp,
  isCalendarDateInRange,
  isCalendarMonthInRange,
  normalizeRangeEndSelection,
} from './CalendarPanelUtils';

describe('CalendarPanelUtils', () => {
  it('builds chart timestamps in the chart timezone', () => {
    const selectedDate = new Date(2026, 0, 2);
    const totalMinutes = 9 * 60 + 30;

    expect(
      buildChartTimestamp({
        date: selectedDate,
        totalMinutes,
        timeZone: 'UTC',
      }),
    ).toBe(Date.UTC(2026, 0, 2, 9, 30) / 1000);
    expect(
      buildChartTimestamp({
        date: selectedDate,
        totalMinutes,
        timeZone: 'Asia/Shanghai',
      }),
    ).toBe(Date.UTC(2026, 0, 2, 1, 30) / 1000);
    expect(
      buildChartTimestamp({
        date: selectedDate,
        totalMinutes,
        timeZone: 'America/New_York',
      }),
    ).toBe(Date.UTC(2026, 0, 2, 14, 30) / 1000);
  });

  it('keeps range dates ordered when the end selection is earlier', () => {
    const rangeStartDate = new Date(2026, 0, 10);
    const nextDate = new Date(2026, 0, 5);

    expect(
      normalizeRangeEndSelection({
        rangeStartDate,
        nextDate,
      }),
    ).toEqual({
      rangeStartDate: nextDate,
      rangeEndDate: rangeStartDate,
    });
  });

  it('maps timestamps into chart calendar dates', () => {
    expect(
      getChartDateFromTimestamp({
        timeZone: 'Asia/Shanghai',
        timestamp: Date.UTC(2026, 0, 1, 20) / 1000,
      }),
    ).toEqual(new Date(2026, 0, 2));
  });

  it('allows one day beyond now without relying on history data', () => {
    expect(
      getCalendarMaximumTimestamp({
        nowTimestamp: 1000,
      }),
    ).toBe(87_400);
    expect(
      getCalendarMaximumTimestamp({
        nowTimestamp: 1000,
        rangeMaximumTimestamp: 2000,
      }),
    ).toBe(2000);
  });

  it('clamps selectable days and months to the available history range', () => {
    const minimumDate = new Date(2026, 0, 10);
    const maximumDate = new Date(2026, 2, 5);
    const inRangeDate = new Date(2026, 1, 1);

    expect(
      isCalendarDateInRange({
        date: new Date(2026, 0, 9),
        maximumDate,
        minimumDate,
      }),
    ).toBe(false);
    expect(
      isCalendarDateInRange({
        date: new Date(2026, 0, 10),
        maximumDate,
        minimumDate,
      }),
    ).toBe(true);
    expect(
      clampCalendarDateToRange({
        date: new Date(2025, 11, 1),
        maximumDate,
        minimumDate,
      }),
    ).toEqual(minimumDate);
    expect(
      clampCalendarDateToRange({
        date: inRangeDate,
        maximumDate,
        minimumDate,
      }),
    ).toBe(inRangeDate);
    expect(
      isCalendarMonthInRange({
        maximumDate,
        minimumDate,
        monthDate: new Date(2025, 11, 1),
      }),
    ).toBe(false);
    expect(
      isCalendarMonthInRange({
        maximumDate,
        minimumDate,
        monthDate: new Date(2026, 2, 1),
      }),
    ).toBe(true);
    expect(
      isCalendarMonthInRange({
        maximumDate,
        minimumDate,
        monthDate: new Date(2026, 3, 1),
      }),
    ).toBe(false);
  });
});
