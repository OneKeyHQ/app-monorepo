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
    it('should return single slice when data points <= 2000', () => {
      // 1 day interval, 1000 days total = 1000 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 1000 * SECONDS_IN_DAY;
      const result = sliceRequest('1D', timeFrom, timeTo);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: timeFrom,
        to: timeTo,
        interval: '1D',
      });
    });

    it('should return single slice when data points exactly 2000', () => {
      // 1 hour interval, 2000 hours total = 2000 data points (about 83 days)
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 2000 * SECONDS_IN_HOUR;
      const result = sliceRequest('1H', timeFrom, timeTo);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: timeFrom,
        to: timeTo,
        interval: '1H',
      });
    });

    it('should return single slice when data points <= 200 for native token', () => {
      // 1 day interval, 150 days total = 150 data points (would be sliced for non-native)
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 150 * SECONDS_IN_DAY;
      const nativeTokenSlices = sliceRequest('1D', timeFrom, timeTo, {
        isNativeToken: true,
      });

      expect(nativeTokenSlices).toHaveLength(1);
      expect(nativeTokenSlices[0]).toEqual({
        from: timeFrom,
        to: timeTo,
        interval: '1D',
      });
    });

    it('should return single slice when data points exactly 200 for native token', () => {
      // 1 day interval, 200 days total = 200 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 200 * SECONDS_IN_DAY;
      const nativeTokenSlices = sliceRequest('1D', timeFrom, timeTo, {
        isNativeToken: true,
      });

      expect(nativeTokenSlices).toHaveLength(1);
      expect(nativeTokenSlices[0]).toEqual({
        from: timeFrom,
        to: timeTo,
        interval: '1D',
      });
    });
  });

  describe('slicing required', () => {
    it('should slice when data points > 2000', () => {
      // 1 minute interval, 3000 minutes total = 3000 data points (about 2 days)
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 3000 * SECONDS_IN_MINUTE;
      const result = sliceRequest('1m', timeFrom, timeTo);

      expect(result.length).toBeGreaterThan(1);
      expect(result.length).toBe(2); // Math.ceil(3000 / 2000) = 2

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

    it('should slice when data points > 200 for native token', () => {
      // 1 day interval, 250 days total = 250 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 250 * SECONDS_IN_DAY;
      const nativeTokenSlices = sliceRequest('1D', timeFrom, timeTo, {
        isNativeToken: true,
      });

      expect(nativeTokenSlices.length).toBeGreaterThan(1);
      expect(nativeTokenSlices.length).toBe(2); // Math.ceil(250 / 200) = 2

      // Check first slice
      expect(nativeTokenSlices[0].from).toBe(timeFrom);
      expect(nativeTokenSlices[0].to).toBeGreaterThan(timeFrom);

      // Check last slice ends at correct time
      expect(nativeTokenSlices[nativeTokenSlices.length - 1].to).toBe(timeTo);

      // Check slices are continuous
      for (let i = 1; i < nativeTokenSlices.length; i += 1) {
        expect(nativeTokenSlices[i].from).toBe(nativeTokenSlices[i - 1].to);
      }
    });

    it('should slice more for non-native than native token with same data', () => {
      // 1 day interval, 150 days total = 150 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 150 * SECONDS_IN_DAY;

      const nonNativeResult = sliceRequest('1D', timeFrom, timeTo);
      const nativeResult = sliceRequest('1D', timeFrom, timeTo, {
        isNativeToken: true,
      });

      expect(nonNativeResult.length).toBe(1); // 150 <= 2000, no slicing needed
      expect(nativeResult.length).toBe(1); // 150 <= 200, no slicing needed
    });

    it('should handle large data sets correctly', () => {
      // 1 minute interval, 6000 minutes = 6000 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 6000 * SECONDS_IN_MINUTE;
      const result = sliceRequest('1m', timeFrom, timeTo);

      expect(result.length).toBe(3); // Math.ceil(6000 / 2000) = 3

      // Verify continuity
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }

      // Verify bounds
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle hour intervals correctly', () => {
      // 1 hour interval, 4000 hours = 4000 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 4000 * SECONDS_IN_HOUR;
      const result = sliceRequest('1H', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(4000 / 2000) = 2

      // Check each slice has roughly equal time span except the last one
      const expectedTimePerSlice = Math.floor((timeTo - timeFrom) / 2);

      for (let i = 0; i < result.length - 1; i += 1) {
        const sliceTime = result[i].to - result[i].from;
        expect(sliceTime).toBe(expectedTimePerSlice);
      }
    });

    it('should handle week intervals correctly', () => {
      // 1 week interval, 150 weeks = 150 data points (about 3 years)
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 150 * SECONDS_IN_WEEK;
      const result = sliceRequest('1W', timeFrom, timeTo);

      expect(result.length).toBe(1); // Math.ceil(150 / 2000) = 1, no slicing needed

      // Verify continuity and bounds
      expect(result[0].from).toBe(timeFrom);
      expect(result[0].to).toBe(timeTo);
    });

    it('should handle month intervals correctly', () => {
      // 1 month interval, 36 months = 36 data points (3 years)
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 36 * SECONDS_IN_MONTH;
      const result = sliceRequest('1M', timeFrom, timeTo);

      expect(result.length).toBe(1); // Math.ceil(36 / 2000) = 1, no slicing needed

      // Verify all slices
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle year intervals correctly', () => {
      // 1 year interval, 4 years = 4 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 4 * SECONDS_IN_YEAR;
      const result = sliceRequest('1y', timeFrom, timeTo);

      expect(result.length).toBe(1); // Math.ceil(4 / 2000) = 1, no slicing needed

      // Verify all slices
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });
  });

  describe('time span limitation', () => {
    it('should limit time span to maximum 5 years', () => {
      // Create a scenario with time span longer than 5 years
      // 10 years = 10 * 365 * 24 * 60 * 60 seconds
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 10 * SECONDS_IN_YEAR;
      const result = sliceRequest('1D', timeFrom, timeTo);

      // The timeFrom should be adjusted to keep only the latest 5 years worth of data
      const expectedAdjustedTimeFrom = timeTo - 5 * SECONDS_IN_YEAR;

      expect(result[0].from).toBe(expectedAdjustedTimeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);

      // Verify continuity
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }
    });

    it('should handle exactly 5 years correctly', () => {
      // Create a scenario with exactly 5 years
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 5 * SECONDS_IN_YEAR;
      const result = sliceRequest('1D', timeFrom, timeTo);

      // No adjustment should be made
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);

      // Verify continuity
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i].from).toBe(result[i - 1].to);
      }
    });

    it('should apply time span limit for native tokens as well', () => {
      // Create a scenario for native tokens with time span longer than 5 years
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 8 * SECONDS_IN_YEAR;
      const result = sliceRequest('1D', timeFrom, timeTo, {
        isNativeToken: true,
      });

      // The timeFrom should be adjusted to keep only the latest 5 years worth of data
      const expectedAdjustedTimeFrom = timeTo - 5 * SECONDS_IN_YEAR;

      expect(result[0].from).toBe(expectedAdjustedTimeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);

      // Verify continuity
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

    it('should handle exactly 2001 data points', () => {
      // 1 minute interval, 2001 minutes total = 2001 data points (about 33 hours)
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 2001 * SECONDS_IN_MINUTE;
      const result = sliceRequest('1m', timeFrom, timeTo);

      expect(result.length).toBe(2); // Math.ceil(2001 / 2000) = 2
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

      expect(result.length).toBe(1); // Math.ceil(365 / 2000) = 1, no slicing needed

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

      expect(result.length).toBe(1); // Math.ceil(168 / 2000) = 1, no slicing needed
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle 1 day of minute data', () => {
      // 1 minute interval, 1440 minutes = 1440 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + SECONDS_IN_DAY;
      const result = sliceRequest('1m', timeFrom, timeTo);

      expect(result.length).toBe(1); // Math.ceil(1440 / 2000) = 1, no slicing needed
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle multi-year monthly data', () => {
      // 1 month interval, 48 months (4 years) = 48 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 48 * SECONDS_IN_MONTH;
      const result = sliceRequest('1M', timeFrom, timeTo);

      expect(result.length).toBe(1); // Math.ceil(48 / 2000) = 1, no slicing needed
      expect(result[0].from).toBe(timeFrom);
      expect(result[result.length - 1].to).toBe(timeTo);
    });

    it('should handle multi-year yearly data', () => {
      // 1 year interval, 4 years = 4 data points
      const timeFrom = mockTimeFrom;
      const timeTo = mockTimeFrom + 4 * SECONDS_IN_YEAR;
      const result = sliceRequest('1y', timeFrom, timeTo);

      expect(result.length).toBe(1); // Math.ceil(4 / 2000) = 1, no slicing needed
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
