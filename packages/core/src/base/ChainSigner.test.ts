import { ChainSigner } from './ChainSigner';

describe('ChainSigner', () => {
  let signer: ChainSigner;

  beforeEach(() => {
    signer = new ChainSigner();
  });

  describe('initialization', () => {
    it('should create ChainSigner instance', () => {
      expect(signer).toBeInstanceOf(ChainSigner);
    });
  });

  describe('signTransaction', () => {
    it('should have signTransaction method', () => {
      expect(typeof signer.signTransaction).toBe('function');
    });
  });

  describe('signMessage', () => {
    it('should have signMessage method', () => {
      expect(typeof signer.signMessage).toBe('function');
    });
  });

  describe('signTypedData', () => {
    it('should have signTypedData method', () => {
      expect(typeof signer.signTypedData).toBe('function');
    });
  });
});
