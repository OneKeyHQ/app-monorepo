import { defaultLogger } from './logger';

describe('logger', () => {
  describe('defaultLogger', () => {
    it('should have debug method', () => {
      expect(typeof defaultLogger.debug).toBe('function');
    });

    it('should have info method', () => {
      expect(typeof defaultLogger.info).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof defaultLogger.warn).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof defaultLogger.error).toBe('function');
    });

    it('should have log method', () => {
      expect(typeof defaultLogger.log).toBe('function');
    });
  });
});
