import {
  truncate,
  capitalize,
  camelCase,
  snakeCase,
  kebabCase,
} from './stringUtils';

describe('stringUtils', () => {
  describe('truncate', () => {
    it('should truncate long string', () => {
      const result = truncate('hello world', 5);
      expect(result).toBe('hello...');
    });

    it('should not truncate short string', () => {
      const result = truncate('hi', 10);
      expect(result).toBe('hi');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
  });

  describe('camelCase', () => {
    it('should convert to camelCase', () => {
      expect(camelCase('hello world')).toBe('helloWorld');
      expect(camelCase('hello-world')).toBe('helloWorld');
    });
  });

  describe('snakeCase', () => {
    it('should convert to snake_case', () => {
      expect(snakeCase('hello world')).toBe('hello_world');
      expect(snakeCase('helloWorld')).toBe('hello_world');
    });
  });

  describe('kebabCase', () => {
    it('should convert to kebab-case', () => {
      expect(kebabCase('hello world')).toBe('hello-world');
      expect(kebabCase('helloWorld')).toBe('hello-world');
    });
  });
});
