import {
  md5,
  sha1,
  sha256,
  sha512,
  hmac,
} from './hashUtils';

describe('hashUtils', () => {
  describe('md5', () => {
    it('should generate MD5 hash', () => {
      const result = md5('hello');
      expect(result).toHaveLength(32);
      expect(result).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate consistent hash', () => {
      const hash1 = md5('hello');
      const hash2 = md5('hello');
      expect(hash1).toBe(hash2);
    });
  });

  describe('sha1', () => {
    it('should generate SHA1 hash', () => {
      const result = sha1('hello');
      expect(result).toHaveLength(40);
    });
  });

  describe('sha256', () => {
    it('should generate SHA256 hash', () => {
      const result = sha256('hello');
      expect(result).toHaveLength(64);
    });
  });

  describe('sha512', () => {
    it('should generate SHA512 hash', () => {
      const result = sha512('hello');
      expect(result).toHaveLength(128);
    });
  });

  describe('hmac', () => {
    it('should generate HMAC', () => {
      const result = hmac('hello', 'secret', 'sha256');
      expect(result).toBeDefined();
    });
  });
});
