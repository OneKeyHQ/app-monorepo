import {
  safeJsonParse,
  safeJsonStringify,
  formatJson,
  minifyJson,
} from './jsonUtils';

describe('jsonUtils', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"a":1}');
      expect(result).toEqual({ a: 1 });
    });

    it('should return default for invalid JSON', () => {
      const result = safeJsonParse('invalid', {});
      expect(result).toEqual({});
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify object', () => {
      const result = safeJsonStringify({ a: 1 });
      expect(result).toBe('{"a":1}');
    });
  });

  describe('formatJson', () => {
    it('should format JSON with indentation', () => {
      const result = formatJson('{"a":1}');
      expect(result).toContain('\n');
    });
  });

  describe('minifyJson', () => {
    it('should remove whitespace from JSON', () => {
      const result = minifyJson('{ "a": 1 }');
      expect(result).toBe('{"a":1}');
    });
  });
});
