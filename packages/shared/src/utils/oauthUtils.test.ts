import {
  generateOAuthUrl,
  parseOAuthCallback,
  exchangeCodeForToken,
  refreshAccessToken,
} from './oauthUtils';

describe('oauthUtils', () => {
  describe('generateOAuthUrl', () => {
    it('should generate OAuth URL', () => {
      const params = {
        clientId: 'client123',
        redirectUri: 'https://example.com/callback',
        scope: 'read',
      };
      const url = generateOAuthUrl('https://auth.example.com', params);
      expect(url).toContain('client_id=client123');
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('parseOAuthCallback', () => {
    it('should parse callback URL', () => {
      const url = 'https://example.com/callback?code=abc123&state=xyz';
      const result = parseOAuthCallback(url);
      expect(result.code).toBe('abc123');
      expect(result.state).toBe('xyz');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should have exchangeCodeForToken method', () => {
      expect(typeof exchangeCodeForToken).toBe('function');
    });
  });

  describe('refreshAccessToken', () => {
    it('should have refreshAccessToken method', () => {
      expect(typeof refreshAccessToken).toBe('function');
    });
  });
});
