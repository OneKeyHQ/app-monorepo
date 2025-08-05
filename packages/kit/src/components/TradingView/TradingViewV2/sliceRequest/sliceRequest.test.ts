import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { sliceRequest } from './sliceRequest';

/*
yarn jest packages/kit/src/components/TradingView/TradingViewV2/sliceRequest.test.ts
*/

// Time constants for better readability and maintainability
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * 60; // 3_600
const SECONDS_IN_DAY = 24 * 60 * 60; // 86_400
const SECONDS_IN_WEEK = 7 * 24 * 60 * 60; // 604_800
const SECONDS_IN_MONTH = 30 * 24 * 60 * 60; // 2_592_000
const SECONDS_IN_YEAR = 365 * 24 * 60 * 60; // 31_536_000

describe('sliceRequest', () => {
  const mockTimeFrom = 1_640_995_200; // 2022-01-01 00:00:00 UTC
  const mockTimeTo = 1_672_531_200; // 2023-01-01 00:00:00 UTC

  describe('interval parsing', () => {
    it('should parse minutes interval correctly', () => {
      const result = sliceRequest(
        '5m',
        mockTimeFrom,
        mockTimeFrom + 5 * SECONDS_IN_MINUTE,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + 5 * SECONDS_IN_MINUTE,
        interval: '5m',
      });
    });

    it('should parse hours interval correctly', () => {
      const result = sliceRequest(
        '2H',
        mockTimeFrom,
        mockTimeFrom + 2 * SECONDS_IN_HOUR,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + 2 * SECONDS_IN_HOUR,
        interval: '2H',
      });
    });

    it('should parse days interval correctly', () => {
      const result = sliceRequest(
        '1D',
        mockTimeFrom,
        mockTimeFrom + SECONDS_IN_DAY,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + SECONDS_IN_DAY,
        interval: '1D',
      });
    });

    it('should parse weeks interval correctly', () => {
      const result = sliceRequest(
        '1W',
        mockTimeFrom,
        mockTimeFrom + SECONDS_IN_WEEK,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + SECONDS_IN_WEEK,
        interval: '1W',
      });
    });

    it('should parse months interval correctly', () => {
      const result = sliceRequest(
        '1M',
        mockTimeFrom,
        mockTimeFrom + SECONDS_IN_MONTH,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + SECONDS_IN_MONTH,
        interval: '1M',
      });
    });

    it('should parse years interval correctly', () => {
      const result = sliceRequest(
        '1y',
        mockTimeFrom,
        mockTimeFrom + SECONDS_IN_YEAR,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + SECONDS_IN_YEAR,
        interval: '1y',
      });
    });

    it('should throw error for invalid interval format', () => {
      expect(() => sliceRequest('invalid', mockTimeFrom, mockTimeTo)).toThrow(
        OneKeyLocalError,
      );
      expect(() => sliceRequest('invalid', mockTimeFrom, mockTimeTo)).toThrow(
        'Invalid interval format: invalid',
      );
    });

    it('should throw error for invalid interval format with invalid characters', () => {
      expect(() => sliceRequest('5x', mockTimeFrom, mockTimeTo)).toThrow(
        OneKeyLocalError,
      );
      expect(() => sliceRequest('5x', mockTimeFrom, mockTimeTo)).toThrow(
        'Invalid interval format: 5x',
      );
    });

    it('should throw error for seconds interval (not supported)', () => {
      expect(() => sliceRequest('30s', mockTimeFrom, mockTimeTo)).toThrow(
        OneKeyLocalError,
      );
      expect(() => sliceRequest('30s', mockTimeFrom, mockTimeTo)).toThrow(
        'Invalid interval format: 30s',
      );
    });

    it('should throw error for missing number in interval', () => {
      expect(() => sliceRequest('D', mockTimeFrom, mockTimeTo)).toThrow(
        OneKeyLocalError,
      );
    });

    it('should handle multi-digit intervals', () => {
      const result = sliceRequest(
        '15m',
        mockTimeFrom,
        mockTimeFrom + 15 * SECONDS_IN_MINUTE,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + 15 * SECONDS_IN_MINUTE,
        interval: '15m',
      });
    });
  });

  describe('no slicing needed', () => {
    it('should return single slice when data points <= 100', () => {
      // 1 day interval, 50 days total = 50 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 50 * SECONDS_IN_DAY;
      const result = sliceRequest('1D', timeFrom, timeTo);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: timeFrom,
        to: timeTo,
        interval: '1D',
      });
    });

    it('should return single slice when data points exactly 100', () => {
      // 1 day interval, 100 days total = 100 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 100 * SECONDS_IN_DAY;
      const result = sliceRequest('1D', timeFrom, timeTo);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: timeFrom,
        to: timeTo,
        interval: '1D',
      });
    });
  });

  describe('slicing required', () => {
    it('should slice when data points > 100', () => {
      // 1 day interval, 365 days total = 365 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 365 * SECONDS_IN_DAY;
      const result = sliceRequest('1D', timeFrom, timeTo);

      expect(result.length).toBeGreaterThan(1);
      expect(result.length).toBe(4); // Math.ceil(365 / 100) = 4

      // Check first slice
      expect(result[0].from).toBe(timeFrom);
      expect(result[0].to).toBeGreaterThan(timeFrom);

      // Check last slice ends at correct time
      expect(result[result.length - 1].to).toBe(timeTo);

      // Check slices are continuous
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }
    });

    it('should handle large data sets correctly', () => {
      // 1 minute interval, 1000 minutes = 1000 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 1000 * SECONDS_IN_MINUTE;
      const result = sliceRequest('1m', timeFrom, timeTo);

      expect(result.length).toBe(10); // Math.ceil(1000 / 100) = 10

      // Verify continuity
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }

      // Verify bounds
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle hour intervals correctly', () => {
      // 1 hour interval, 500 hours = 500 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 500 * SECONDS_IN_HOUR;
      const result = sliceRequest('1H', timeFrom, timeTo);

      expect(result.length).toBe(5); // Math.ceil(500 / 100) = 5

      // Check each slice has roughly equal time span except the last one
      const expectedTimePerSlice = Math.floor((timeTo - timeFrom) / 5);

      for (let i = 0; i < result.length - 1; i += 1) {
        const sliceTime = result[i].to - result[i].from;
        expect(sliceTime).toBe(expectedTimePerSlice);
      }
    });

    it('should handle week intervals correctly', () => {
      // 1 week interval, 200 weeks = 200 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 200 * SECONDS_IN_WEEK;
      const result = sliceRequest('1W', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(200 / 100) = 2

      // Verify continuity and bounds
      expect(result[0].from).toBe(timeFrom);
      expect(result[1].from).toBe(result[0].to);
      expect(result[1].to).toBe(timeTo);
    });

    it('should handle month intervals correctly', () => {
      // 1 month interval, 300 months = 300 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 300 * SECONDS_IN_MONTH;
      const result = sliceRequest('1M', timeFrom, timeTo);

      expect(result.length).toBe(3); // Math.ceil(300 / 100) = 3

      // Verify all slices
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);

      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }
    });

    it('should handle year intervals correctly', () => {
      // 1 year interval, 150 years = 150 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 150 * SECONDS_IN_YEAR;
      const result = sliceRequest('1y', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(150 / 100) = 2

      // Verify all slices
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);

      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle when timeFrom equals timeTo', () => {
      const result = sliceRequest('1D', mockTimeFrom, mockTimeFrom);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom,
        interval: '1D',
      });
    });

    it('should handle very small time ranges', () => {
      const result = sliceRequest(
        '1m',
        mockTimeFrom,
        mockTimeFrom + SECONDS_IN_MINUTE,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + SECONDS_IN_MINUTE,
        interval: '1m',
      });
    });

    it('should handle exactly 101 data points', () => {
      // 1 day interval, 101 days total = 101 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 101 * SECONDS_IN_DAY;
      const result = sliceRequest('1D', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(101 / 100) = 2
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle very large intervals', () => {
      const result = sliceRequest('999M', mockTimeFrom, mockTimeFrom + 1000);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: mockTimeFrom,
        to: mockTimeFrom + 1000,
        interval: '999M',
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should handle 1 year of daily data (typical case)', () => {
      // 1 day interval, 365 days = 365 data points
      const timeFrom = 1_640_995_200; // 2022-01-01
      const timeTo = 1_672_531_200; // 2023-01-01
      const result = sliceRequest('1D', timeFrom, timeTo);

      expect(result.length).toBe(4); // Math.ceil(365 / 100) = 4

      // Verify total coverage
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);

      // Verify continuity
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }
    });

    it('should handle 1 week of hourly data', () => {
      // 1 hour interval, 168 hours = 168 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + SECONDS_IN_WEEK;
      const result = sliceRequest('1H', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(168 / 100) = 2
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle 1 day of minute data', () => {
      // 1 minute interval, 1440 minutes = 1440 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + SECONDS_IN_DAY;
      const result = sliceRequest('1m', timeFrom, timeTo);

      expect(result.length).toBe(15); // Math.ceil(1440 / 100) = 15
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle multi-year monthly data', () => {
      // 1 month interval, 120 months (10 years) = 120 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 120 * SECONDS_IN_MONTH;
      const result = sliceRequest('1M', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(120 / 100) = 2
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle multi-century yearly data', () => {
      // 1 year interval, 200 years = 200 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 200 * SECONDS_IN_YEAR;
      const result = sliceRequest('1y', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(200 / 100) = 2
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });
  });

  describe('return type validation', () => {
    it('should return array of ITimeSlice objects', () => {
      const result = sliceRequest('1D', mockTimeFrom, mockTimeTo);

      expect(Array.isArray(result)).toBe(true);

      result.forEach((slice) => {
        expect(typeof slice).toBe('object');
        expect(typeof slice.from).toBe('number');
        expect(typeof slice.to).toBe('number');
        expect(typeof slice.interval).toBe('string');
        expect(slice.interval).toBe('1D');
        expect(slice.from).toBeLessThanOrEqual(slice.to);
      });
    });

    it('should ensure all slices have valid time ranges', () => {
      const result = sliceRequest('1H', mockTimeFrom, mockTimeTo);

      result.forEach((slice) => {
        expect(slice.from).toBeGreaterThanOrEqual(mockTimeFrom);
        expect(slice.to).toBeLessThanOrEqual(mockTimeTo);
        expect(slice.from).toBeLessThanOrEqual(slice.to);
      });
    });
  });
});
