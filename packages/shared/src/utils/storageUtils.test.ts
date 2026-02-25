import {
  getItem,
  setItem,
  removeItem,
  clearStorage,
} from './storageUtils';

describe('storageUtils', () => {
  describe('setItem & getItem', () => {
    it('should store and retrieve string value', () => {
      setItem('test-key', 'test-value');
      const result = getItem('test-key');
      expect(result).toBe('test-value');
    });

    it('should store and retrieve object value', () => {
      const obj = { name: 'test', value: 123 };
      setItem('test-obj', obj);
      const result = getItem('test-obj');
      expect(result).toEqual(obj);
    });

    it('should return null for non-existent key', () => {
      const result = getItem('non-existent-key');
      expect(result).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('should remove item from storage', () => {
      setItem('remove-test', 'value');
      removeItem('remove-test');
      const result = getItem('remove-test');
      expect(result).toBeNull();
    });
  });

  describe('clearStorage', () => {
    it('should have clearStorage method', () => {
      expect(typeof clearStorage).toBe('function');
    });
  });
});
