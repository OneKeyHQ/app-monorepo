import {
  parseCSV,
  stringifyCSV,
  downloadCSV,
} from './csvUtils';

describe('csvUtils', () => {
  describe('parseCSV', () => {
    it('should parse CSV string', () => {
      const csv = 'name,age\nAlice,30\nBob,25';
      const result = parseCSV(csv);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
    });
  });

  describe('stringifyCSV', () => {
    it('should stringify to CSV', () => {
      const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      const result = stringifyCSV(data);
      expect(result).toContain('name,age');
      expect(result).toContain('Alice,30');
    });
  });

  describe('downloadCSV', () => {
    it('should have downloadCSV method', () => {
      expect(typeof downloadCSV).toBe('function');
    });
  });
});
