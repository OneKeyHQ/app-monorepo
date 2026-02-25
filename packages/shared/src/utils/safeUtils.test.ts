import {
  safeJsonParse,
  safeJsonStringify,
  safeExecute,
} from './safeUtils';

describe('safeUtils', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"a":1}');
      expect(result).toEqual({ a: 1 });
    });

    it('should return default value for invalid JSON', () => {
      const result = safeJsonParse('invalid', {});
      expect(result).toEqual({});
    });

    it('should return null for invalid JSON without default', () => {
      const result = safeJsonParse('invalid');
      expect(result).toBeNull();
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify object', () => {
      const result = safeJsonStringify({ a: 1 });
      expect(result).toBe('{"a":1}');
    });

    it('should return null for circular reference', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      const result = safeJsonStringify(obj);
      expect(result).toBeNull();
    });
  });

  describe('safeExecute', () => {
    it('should execute function safely', () => {
      const fn = () => 'success';
      const result = safeExecute(fn);
      expect(result).toBe('success');
    });

    it('should return default on error', () => {
      const fn = () => { throw new Error('error'); };
      const result = safeExecute(fn, 'default');
      expect(result).toBe('default');
    });
  });
});
