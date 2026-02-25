import {
  scrollToTop,
  scrollToBottom,
  scrollToElement,
} from './scrollUtils';

describe('scrollUtils', () => {
  describe('scrollToTop', () => {
    it('should have scrollToTop method', () => {
      expect(typeof scrollToTop).toBe('function');
    });
  });

  describe('scrollToBottom', () => {
    it('should have scrollToBottom method', () => {
      expect(typeof scrollToBottom).toBe('function');
    });
  });

  describe('scrollToElement', () => {
    it('should have scrollToElement method', () => {
      expect(typeof scrollToElement).toBe('function');
    });
  });
});
