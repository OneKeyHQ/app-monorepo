import {
  getNetworkId,
  getNetworkName,
  isAllNetwork,
} from './networkUtils';

describe('networkUtils', () => {
  describe('getNetworkId', () => {
    it('should return networkId from network object', () => {
      const network = { id: 'evm--1', name: 'Ethereum' };
      const result = getNetworkId(network as any);
      expect(result).toBe('evm--1');
    });

    it('should return empty string for null network', () => {
      const result = getNetworkId(null as any);
      expect(result).toBe('');
    });

    it('should return empty string for undefined network', () => {
      const result = getNetworkId(undefined as any);
      expect(result).toBe('');
    });
  });

  describe('getNetworkName', () => {
    it('should return network name', () => {
      const network = { id: 'evm--1', name: 'Ethereum' };
      const result = getNetworkName(network as any);
      expect(result).toBe('Ethereum');
    });

    it('should return empty string for null network', () => {
      const result = getNetworkName(null as any);
      expect(result).toBe('');
    });
  });

  describe('isAllNetwork', () => {
    it('should return true for all network id', () => {
      const result = isAllNetwork('all');
      expect(result).toBe(true);
    });

    it('should return false for specific network', () => {
      const result = isAllNetwork('evm--1');
      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = isAllNetwork('');
      expect(result).toBe(false);
    });
  });
});
