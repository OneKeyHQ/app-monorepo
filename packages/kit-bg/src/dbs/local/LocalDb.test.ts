import { LocalDb } from './LocalDb';

describe('LocalDb', () => {
  describe('database methods', () => {
    it('should have init method', () => {
      expect(typeof LocalDb.prototype.init).toBe('function');
    });

    it('should have getContext method', () => {
      expect(typeof LocalDb.prototype.getContext).toBe('function');
    });

    it('should have reset method', () => {
      expect(typeof LocalDb.prototype.reset).toBe('function');
    });
  });
});
