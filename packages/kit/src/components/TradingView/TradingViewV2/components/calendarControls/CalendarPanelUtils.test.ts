import {
  buildChartTimestamp,
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
});
