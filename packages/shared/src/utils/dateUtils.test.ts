import {
  formatDate,
  getDateDiff,
  isSameDay,
} from './dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toContain('2024');
    });

    it('should format with custom format', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date, 'YYYY-MM-DD');
      expect(result).toBe('2024-01-15');
    });
  });

  describe('getDateDiff', () => {
    it('should calculate day difference', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-20');
      const result = getDateDiff(date1, date2, 'day');
      expect(result).toBe(5);
    });

    it('should calculate hour difference', () => {
      const date1 = new Date('2024-01-15 10:00');
      const date2 = new Date('2024-01-15 15:00');
      const result = getDateDiff(date1, date2, 'hour');
      expect(result).toBe(5);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const date1 = new Date('2024-01-15 10:00');
      const date2 = new Date('2024-01-15 20:00');
      const result = isSameDay(date1, date2);
      expect(result).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const result = isSameDay(date1, date2);
      expect(result).toBe(false);
    });
  });
});
