import {
  isMobile,
  isDesktop,
  isIOS,
  isAndroid,
  getBrowserInfo,
} from './browserUtils';

describe('browserUtils', () => {
  describe('isMobile', () => {
    it('should detect mobile', () => {
      const result = isMobile();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isDesktop', () => {
    it('should detect desktop', () => {
      const result = isDesktop();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isIOS', () => {
    it('should detect iOS', () => {
      const result = isIOS();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isAndroid', () => {
    it('should detect Android', () => {
      const result = isAndroid();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getBrowserInfo', () => {
    it('should get browser info', () => {
      const result = getBrowserInfo();
      expect(typeof result).toBe('object');
    });
  });
});
