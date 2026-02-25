import { BtcCore } from './BtcCore';

describe('BtcCore', () => {
  let btcCore: BtcCore;

  beforeEach(() => {
    btcCore = new BtcCore();
  });

  describe('initialization', () => {
    it('should create BtcCore instance', () => {
      expect(btcCore).toBeInstanceOf(BtcCore);
    });
  });

  describe('address methods', () => {
    it('should have validateAddress method', () => {
      expect(typeof btcCore.validateAddress).toBe('function');
    });

    it('should have getAddressType method', () => {
      expect(typeof btcCore.getAddressType).toBe('function');
    });

    it('should have isValidAddress method', () => {
      expect(typeof btcCore.isValidAddress).toBe('function');
    });
  });

  describe('transaction methods', () => {
    it('should have buildTransaction method', () => {
      expect(typeof btcCore.buildTransaction).toBe('function');
    });

    it('should have signTransaction method', () => {
      expect(typeof btcCore.signTransaction).toBe('function');
    });

    it('should have buildPsbt method', () => {
      expect(typeof btcCore.buildPsbt).toBe('function');
    });
  });

  describe('UTXO methods', () => {
    it('should have selectUtxos method', () => {
      expect(typeof btcCore.selectUtxos).toBe('function');
    });

    it('should have calculateFee method', () => {
      expect(typeof btcCore.calculateFee).toBe('function');
    });
  });
});
