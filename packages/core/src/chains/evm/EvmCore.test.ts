import { EvmCore } from './EvmCore';

describe('EvmCore', () => {
  let evmCore: EvmCore;

  beforeEach(() => {
    evmCore = new EvmCore();
  });

  describe('initialization', () => {
    it('should create EvmCore instance', () => {
      expect(evmCore).toBeInstanceOf(EvmCore);
    });
  });

  describe('address methods', () => {
    it('should have validateAddress method', () => {
      expect(typeof evmCore.validateAddress).toBe('function');
    });

    it('should have normalizeAddress method', () => {
      expect(typeof evmCore.normalizeAddress).toBe('function');
    });

    it('should have isContractAddress method', () => {
      expect(typeof evmCore.isContractAddress).toBe('function');
    });
  });

  describe('transaction methods', () => {
    it('should have buildTransaction method', () => {
      expect(typeof evmCore.buildTransaction).toBe('function');
    });

    it('should have signTransaction method', () => {
      expect(typeof evmCore.signTransaction).toBe('function');
    });

    it('should have encodeTransactionData method', () => {
      expect(typeof evmCore.encodeTransactionData).toBe('function');
    });
  });

  describe('token methods', () => {
    it('should have getTokenInfo method', () => {
      expect(typeof evmCore.getTokenInfo).toBe('function');
    });

    it('should have buildTokenTransfer method', () => {
      expect(typeof evmCore.buildTokenTransfer).toBe('function');
    });
  });
});
