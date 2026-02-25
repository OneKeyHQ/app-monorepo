import {
  unique,
  flatten,
  chunk,
  groupBy,
  sortBy,
} from './arrayUtils';

describe('arrayUtils', () => {
  describe('unique', () => {
    it('should remove duplicates', () => {
      const result = unique([1, 2, 2, 3, 3, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('flatten', () => {
    it('should flatten nested arrays', () => {
      const result = flatten([[1, 2], [3, 4], [5]]);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const result = chunk([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe('groupBy', () => {
    it('should group by key', () => {
      const arr = [{ type: 'a', val: 1 }, { type: 'b', val: 2 }, { type: 'a', val: 3 }];
      const result = groupBy(arr, 'type');
      expect(result).toEqual({
        a: [{ type: 'a', val: 1 }, { type: 'a', val: 3 }],
        b: [{ type: 'b', val: 2 }],
      });
    });
  });

  describe('sortBy', () => {
    it('should sort by key', () => {
      const arr = [{ val: 3 }, { val: 1 }, { val: 2 }];
      const result = sortBy(arr, 'val');
      expect(result).toEqual([{ val: 1 }, { val: 2 }, { val: 3 }]);
    });
  });
});
