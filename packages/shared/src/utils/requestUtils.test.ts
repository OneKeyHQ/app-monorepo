import {
  buildRequestUrl,
  parseResponse,
  handleRequestError,
} from './requestUtils';

describe('requestUtils', () => {
  describe('buildRequestUrl', () => {
    it('should build URL with base and path', () => {
      const result = buildRequestUrl('https://api.example.com', '/users');
      expect(result).toBe('https://api.example.com/users');
    });

    it('should build URL with query params', () => {
      const result = buildRequestUrl('https://api.example.com', '/users', { page: 1, limit: 10 });
      expect(result).toContain('page=1');
      expect(result).toContain('limit=10');
    });
  });

  describe('parseResponse', () => {
    it('should parse JSON response', () => {
      const response = { data: { name: 'test' } };
      const result = parseResponse(response);
      expect(result).toEqual({ name: 'test' });
    });

    it('should handle empty response', () => {
      const result = parseResponse(null);
      expect(result).toBeNull();
    });
  });

  describe('handleRequestError', () => {
    it('should have handleRequestError method', () => {
      expect(typeof handleRequestError).toBe('function');
    });
  });
});
