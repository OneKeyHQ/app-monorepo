import { formatRangeLabel } from './RewardDateRangeField';

jest.mock('@onekeyhq/components', () => ({}));

describe('formatRangeLabel', () => {
  const allTime = 'All time';

  it('reads an empty range and the all-time preset as "All time"', () => {
    expect(formatRangeLabel(undefined, allTime)).toBe(allTime);
    expect(
      formatRangeLabel(
        { start: new Date('2024-01-01T00:00:00.000'), end: new Date() },
        allTime,
      ),
    ).toBe(allTime);
  });

  it('drops the end year inside one year', () => {
    expect(
      formatRangeLabel(
        {
          start: new Date('2025-03-01T00:00:00.000'),
          end: new Date('2025-03-31T23:59:59.999'),
        },
        allTime,
      ),
    ).toBe('2025/03/01 – 03/31');
  });

  it('keeps both years across years', () => {
    expect(
      formatRangeLabel(
        {
          start: new Date('2024-12-01T00:00:00.000'),
          end: new Date('2025-01-15T23:59:59.999'),
        },
        allTime,
      ),
    ).toBe('2024/12/01 – 2025/01/15');
  });
});
