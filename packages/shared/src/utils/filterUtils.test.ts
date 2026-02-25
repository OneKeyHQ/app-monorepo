import {
  filterByKeyword,
  filterByDateRange,
  filterByNumberRange,
  filterByStatus,
} from './filterUtils';

describe('filterUtils', () => {
  describe('filterByKeyword', () => {
    it('should filter by keyword', () => {
      const arr = [
        { name: 'Alice', desc: 'Developer' },
        { name: 'Bob', desc: 'Designer' },
        { name: 'Charlie', desc: 'Developer' },
      ];
      const result = filterByKeyword(arr, 'Developer', ['desc']);
      expect(result).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const arr = [{ name: 'Alice' }];
      const result = filterByKeyword(arr, 'alice', ['name']);
      expect(result).toHaveLength(1);
    });
  });

  describe('filterByDateRange', () => {
    it('should filter by date range', () => {
      const arr = [
        { date: '2024-01-10' },
        { date: '2024-01-15' },
        { date: '2024-01-20' },
      ];
      const result = filterByDateRange(arr, 'date', '2024-01-12', '2024-01-18');
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-15');
    });
  });

  describe('filterByNumberRange', () => {
    it('should filter by number range', () => {
      const arr = [{ val: 10 }, { val: 20 }, { val: 30 }];
      const result = filterByNumberRange(arr, 'val', 15, 25);
      expect(result).toHaveLength(1);
      expect(result[0].val).toBe(20);
    });
  });

  describe('filterByStatus', () => {
    it('should filter by status', () => {
      const arr = [
        { status: 'active' },
        { status: 'inactive' },
        { status: 'active' },
      ];
      const result = filterByStatus(arr, 'status', 'active');
      expect(result).toHaveLength(2);
    });
  });
});
