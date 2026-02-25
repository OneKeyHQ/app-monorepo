import { vaultFactory } from './factory';

describe('vaultFactory', () => {
  describe('factory methods', () => {
    it('should have getVault method', () => {
      expect(typeof vaultFactory.getVault).toBe('function');
    });

    it('should have createVault method', () => {
      expect(typeof vaultFactory.createVault).toBe('function');
    });
  });
});
