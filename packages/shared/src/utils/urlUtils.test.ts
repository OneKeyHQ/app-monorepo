import {
  parseUrl,
  buildUrl,
  getQueryParams,
  setQueryParams,
} from './urlUtils';

describe('urlUtils', () => {
  describe('parseUrl', () => {
    it('should parse URL components', () => {
      const result = parseUrl('https://example.com/path?key=value');
      expect(result.protocol).toBe('https:');
      expect(result.hostname).toBe('example.com');
      expect(result.pathname).toBe('/path');
    });
  });

  describe('buildUrl', () => {
    it('should build URL from parts', () => {
      const result = buildUrl({
        protocol: 'https',
        hostname: 'example.com',
        pathname: '/path',
        search: '?key=value',
      });
      expect(result).toBe('https://example.com/path?key=value');
    });
  });

  describe('getQueryParams', () => {
    it('should get query parameters', () => {
      const result = getQueryParams('https://example.com?a=1&b=2');
      expect(result).toEqual({ a: '1', b: '2' });
    });
  });

  describe('setQueryParams', () => {
    it('should set query parameters', () => {
      const result = setQueryParams('https://example.com', { a: '1', b: '2' });
      expect(result).toBe('https://example.com?a=1&b=2');
    });
  });
});
