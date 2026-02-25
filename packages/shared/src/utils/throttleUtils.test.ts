import {
  throttle,
  debounce,
  leadingThrottle,
  trailingThrottle,
} from './throttleUtils';

describe('throttleUtils', () => {
  describe('throttle', () => {
    it('should throttle function calls', async () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);
      
      throttled();
      throttled();
      throttled();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      await new Promise(r => setTimeout(r, 150));
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);
      
      debounced();
      debounced();
      debounced();
      
      expect(fn).not.toHaveBeenCalled();
      
      await new Promise(r => setTimeout(r, 150));
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('leadingThrottle', () => {
    it('should call on leading edge', () => {
      const fn = jest.fn();
      const throttled = leadingThrottle(fn, 100);
      
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('trailingThrottle', () => {
    it('should call on trailing edge', async () => {
      const fn = jest.fn();
      const throttled = trailingThrottle(fn, 100);
      
      throttled();
      expect(fn).not.toHaveBeenCalled();
      
      await new Promise(r => setTimeout(r, 150));
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
