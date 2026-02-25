import {
  sortByDate,
  sortByNumber,
  sortByString,
  sortByBoolean,
} from './sortUtils';

describe('sortUtils', () => {
  describe('sortByDate', () => {
    it('should sort by date ascending', () => {
      const arr = [
        { date: '2024-01-15' },
        { date: '2024-01-10' },
        { date: '2024-01-20' },
      ];
      const result = sortByDate(arr, 'date', 'asc');
      expect(result[0].date).toBe('2024-01-10');
      expect(result[2].date).toBe('2024-01-20');
    });

    it('should sort by date descending', () => {
      const arr = [
        { date: '2024-01-15' },
        { date: '2024-01-10' },
        { date: '2024-01-20' },
      ];
      const result = sortByDate(arr, 'date', 'desc');
      expect(result[0].date).toBe('2024-01-20');
      expect(result[2].date).toBe('2024-01-10');
    });
  });

  describe('sortByNumber', () => {
    it('should sort by number ascending', () => {
      const arr = [{ val: 3 }, { val: 1 }, { val: 2 }];
      const result = sortByNumber(arr, 'val', 'asc');
      expect(result[0].val).toBe(1);
      expect(result[2].val).toBe(3);
    });
  });

  describe('sortByString', () => {
    it('should sort by string alphabetically', () => {
      const arr = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
      const result = sortByString(arr, 'name', 'asc');
      expect(result[0].name).toBe('Alice');
      expect(result[2].name).toBe('Charlie');
    });
  });

  describe('sortByBoolean', () => {
    it('should sort by boolean', () => {
      const arr = [{ active: false }, { active: true }, { active: false }];
      const result = sortByBoolean(arr, 'active', 'asc');
      expect(result[0].active).toBe(false);
      expect(result[2].active).toBe(true);
    });
  });
});
