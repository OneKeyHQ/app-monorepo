import {
  backgroundClass,
  backgroundMethod,
} from './backgroundDecorators';

describe('backgroundDecorators', () => {
  describe('backgroundClass', () => {
    it('should be a function', () => {
      expect(typeof backgroundClass).toBe('function');
    });
  });

  describe('backgroundMethod', () => {
    it('should be a function', () => {
      expect(typeof backgroundMethod).toBe('function');
    });
  });
});
