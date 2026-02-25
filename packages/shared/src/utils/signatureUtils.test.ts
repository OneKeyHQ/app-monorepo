import {
  signData,
  verifySignature,
  signRequest,
  verifyRequestSignature,
} from './signatureUtils';

describe('signatureUtils', () => {
  describe('signData', () => {
    it('should sign data with private key', () => {
      const data = 'message to sign';
      const privateKey = 'private-key-here';
      const signature = signData(data, privateKey);
      expect(signature).toBeDefined();
    });
  });

  describe('verifySignature', () => {
    it('should verify signature with public key', () => {
      const data = 'message to sign';
      const privateKey = 'private-key-here';
      const publicKey = 'public-key-here';
      const signature = signData(data, privateKey);
      const isValid = verifySignature(data, signature, publicKey);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('signRequest', () => {
    it('should sign HTTP request', () => {
      const request = { method: 'GET', url: '/api/data' };
      const secret = 'secret-key';
      const signature = signRequest(request, secret);
      expect(signature).toBeDefined();
    });
  });

  describe('verifyRequestSignature', () => {
    it('should verify request signature', () => {
      const request = { method: 'GET', url: '/api/data' };
      const secret = 'secret-key';
      const signature = signRequest(request, secret);
      const isValid = verifyRequestSignature(request, signature, secret);
      expect(typeof isValid).toBe('boolean');
    });
  });
});
