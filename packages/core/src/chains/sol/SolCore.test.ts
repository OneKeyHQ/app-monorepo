import { SolCore } from './SolCore';

describe('SolCore', () => {
  let solCore: SolCore;

  beforeEach(() => {
    solCore = new SolCore();
  });

  describe('initialization', () => {
    it('should create SolCore instance', () => {
      expect(solCore).toBeInstanceOf(SolCore);
    });
  });

  describe('address methods', () => {
    it('should have validateAddress method', () => {
      expect(typeof solCore.validateAddress).toBe('function');
    });

    it('should have normalizeAddress method', () => {
      expect(typeof solCore.normalizeAddress).toBe('function');
    });

    it('should have isValidPublicKey method', () => {
      expect(typeof solCore.isValidPublicKey).toBe('function');
    });
  });

  describe('transaction methods', () => {
    it('should have buildTransaction method', () => {
      expect(typeof solCore.buildTransaction).toBe('function');
    });

    it('should have signTransaction method', () => {
      expect(typeof solCore.signTransaction).toBe('function');
    });

    it('should have buildTransferInstruction method', () => {
      expect(typeof solCore.buildTransferInstruction).toBe('function');
    });
  });

  describe('token methods', () => {
    it('should have getTokenAccounts method', () => {
      expect(typeof solCore.getTokenAccounts).toBe('function');
    });

    it('should have buildTokenTransfer method', () => {
      expect(typeof solCore.buildTokenTransfer).toBe('function');
    });
  });
});
