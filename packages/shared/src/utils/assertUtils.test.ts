import {
  assert,
  assertIsDefined,
  assertNever,
} from './assertUtils';

describe('assertUtils', () => {
  describe('assert', () => {
    it('should not throw for true condition', () => {
      expect(() => assert(true, 'error message')).not.toThrow();
    });

    it('should throw for false condition', () => {
      expect(() => assert(false, 'error message')).toThrow('error message');
    });

    it('should throw with default message', () => {
      expect(() => assert(false)).toThrow();
    });
  });

  describe('assertIsDefined', () => {
    it('should not throw for defined value', () => {
      expect(() => assertIsDefined('value', 'value')).not.toThrow();
    });

    it('should throw for undefined value', () => {
      expect(() => assertIsDefined(undefined, 'value')).toThrow();
    });

    it('should throw for null value', () => {
      expect(() => assertIsDefined(null, 'value')).toThrow();
    });
  });

  describe('assertNever', () => {
    it('should always throw', () => {
      expect(() => assertNever('value' as never)).toThrow();
    });
  });
});
