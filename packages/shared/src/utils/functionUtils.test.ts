import {
  memoize,
  once,
  curry,
  pipe,
} from './functionUtils';

describe('functionUtils', () => {
  describe('memoize', () => {
    it('should cache results', () => {
      const fn = jest.fn((x: number) => x * 2);
      const memoized = memoize(fn);
      
      memoized(5);
      memoized(5);
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('should only execute once', () => {
      const fn = jest.fn();
      const onceFn = once(fn);
      
      onceFn();
      onceFn();
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('curry', () => {
    it('should curry function', () => {
      const add = (a: number, b: number, c: number) => a + b + c;
      const curriedAdd = curry(add);
      
      expect(curriedAdd(1)(2)(3)).toBe(6);
      expect(curriedAdd(1, 2)(3)).toBe(6);
    });
  });

  describe('pipe', () => {
    it('should pipe functions', () => {
      const add1 = (x: number) => x + 1;
      const multiply2 = (x: number) => x * 2;
      const result = pipe(add1, multiply2)(5);
      
      expect(result).toBe(12); // (5 + 1) * 2
    });
  });
});
