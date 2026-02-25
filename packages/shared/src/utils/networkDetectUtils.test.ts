import {
  detectNetworkType,
  isValidNetworkUrl,
  getNetworkLatency,
} from './networkDetectUtils';

describe('networkDetectUtils', () => {
  describe('detectNetworkType', () => {
    it('should detect mainnet type', () => {
      const result = detectNetworkType('https://mainnet.infura.io');
      expect(result).toBe('mainnet');
    });

    it('should detect testnet type', () => {
      const result = detectNetworkType('https://goerli.infura.io');
      expect(result).toBe('testnet');
    });

    it('should return unknown for custom url', () => {
      const result = detectNetworkType('https://custom.node.com');
      expect(result).toBe('unknown');
    });
  });

  describe('isValidNetworkUrl', () => {
    it('should return true for valid http url', () => {
      const result = isValidNetworkUrl('http://localhost:8545');
      expect(result).toBe(true);
    });

    it('should return true for valid https url', () => {
      const result = isValidNetworkUrl('https://mainnet.infura.io/v3/key');
      expect(result).toBe(true);
    });

    it('should return false for invalid url', () => {
      const result = isValidNetworkUrl('not-a-url');
      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = isValidNetworkUrl('');
      expect(result).toBe(false);
    });
  });

  describe('getNetworkLatency', () => {
    it('should have getNetworkLatency method', () => {
      expect(typeof getNetworkLatency).toBe('function');
    });
  });
});
