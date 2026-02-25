import {
  generateUUID,
  isAccountCompatibleWithNetwork,
} from './accountUtils';

describe('accountUtils', () => {
  describe('generateUUID', () => {
    it('should generate valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBe(36);
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('isAccountCompatibleWithNetwork', () => {
    it('should return true for compatible account and network', () => {
      const account = { coinType: '60' };
      const network = { impl: 'evm' };
      const result = isAccountCompatibleWithNetwork(account as any, network as any);
      expect(result).toBe(true);
    });

    it('should return false for incompatible account and network', () => {
      const account = { coinType: '0' };
      const network = { impl: 'evm' };
      const result = isAccountCompatibleWithNetwork(account as any, network as any);
      expect(result).toBe(false);
    });
  });
});
