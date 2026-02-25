import {
  OneKeyError,
  OneKeyInternalError,
  OneKeyLocalError,
} from './errors';

describe('errors', () => {
  describe('OneKeyError', () => {
    it('should create OneKeyError with message', () => {
      const error = new OneKeyError('test error');
      expect(error.message).toBe('test error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create OneKeyError with code', () => {
      const error = new OneKeyError('test error', 'TEST_CODE');
      expect(error.code).toBe('TEST_CODE');
    });
  });

  describe('OneKeyInternalError', () => {
    it('should create OneKeyInternalError', () => {
      const error = new OneKeyInternalError('internal error');
      expect(error.message).toBe('internal error');
      expect(error).toBeInstanceOf(OneKeyError);
    });
  });

  describe('OneKeyLocalError', () => {
    it('should create OneKeyLocalError', () => {
      const error = new OneKeyLocalError('local error');
      expect(error.message).toBe('local error');
      expect(error).toBeInstanceOf(OneKeyError);
    });
  });
});
