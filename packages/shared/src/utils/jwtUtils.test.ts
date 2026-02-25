import {
  encodeJWT,
  decodeJWT,
  verifyJWT,
  isJWTExpired,
} from './jwtUtils';

describe('jwtUtils', () => {
  describe('encodeJWT', () => {
    it('should encode payload to JWT', () => {
      const payload = { userId: '123', role: 'admin' };
      const secret = 'secret';
      const token = encodeJWT(payload, secret);
      expect(token).toContain('.');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('decodeJWT', () => {
    it('should decode JWT payload', () => {
      const payload = { userId: '123' };
      const secret = 'secret';
      const token = encodeJWT(payload, secret);
      const decoded = decodeJWT(token);
      expect(decoded.userId).toBe('123');
    });
  });

  describe('verifyJWT', () => {
    it('should verify valid JWT', () => {
      const payload = { userId: '123' };
      const secret = 'secret';
      const token = encodeJWT(payload, secret);
      const isValid = verifyJWT(token, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid JWT', () => {
      const isValid = verifyJWT('invalid.token.here', 'secret');
      expect(isValid).toBe(false);
    });
  });

  describe('isJWTExpired', () => {
    it('should check if JWT is expired', () => {
      const payload = { exp: Date.now() / 1000 - 1000 }; // expired 1000 seconds ago
      const secret = 'secret';
      const token = encodeJWT(payload, secret);
      const expired = isJWTExpired(token);
      expect(expired).toBe(true);
    });
  });
});
