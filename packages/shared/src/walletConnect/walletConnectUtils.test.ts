import {
  parseUri,
  buildSession,
} from './walletConnectUtils';

describe('walletConnectUtils', () => {
  describe('parseUri', () => {
    it('should parse WalletConnect URI', () => {
      const uri = 'wc:1234567890@1?bridge=https://bridge.walletconnect.org&key=abc123';
      const result = parseUri(uri);
      expect(result).toBeDefined();
      expect(result.topic).toBe('1234567890');
    });

    it('should return null for invalid URI', () => {
      const result = parseUri('invalid-uri');
      expect(result).toBeNull();
    });
  });

  describe('buildSession', () => {
    it('should have buildSession method', () => {
      expect(typeof buildSession).toBe('function');
    });
  });
});
