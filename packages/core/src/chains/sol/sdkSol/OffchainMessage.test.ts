import { EOffChainMessageType } from '../types';

import { OffchainMessage } from './OffchainMessage';

import type {
  IOffChainMessageHeaderLegacy,
  IOffChainMessageHeaderStandard,
} from '../types';

// yarn jest packages/core/src/chains/sol/sdkSol/OffchainMessage.test.ts

describe('OffchainMessage.createOffChainMessage', () => {
  const testMessage = 'Hello, Solana!';
  const testPublicKey = new Uint8Array(32).fill(1);
  const testAppDomain = 'test.app';

  describe('Standard Format', () => {
    it('should create standard message correctly', () => {
      const result = OffchainMessage.createOffChainMessage({
        message: testMessage,
        signerPublicKeys: [testPublicKey],
        applicationDomain: testAppDomain,
        format: 0,
        isLegacy: false,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.STANDARD);
      expect(detected.header).toBeDefined();
      if (detected.header && 'format' in detected.header) {
        expect(detected.header.format).toBe(0);
        expect(detected.header.version).toBe(0);
        expect(
          (detected.header as IOffChainMessageHeaderStandard).signersCount,
        ).toBe(1);
      }
    });

    it('should handle multiple signers', () => {
      const secondPublicKey = new Uint8Array(32).fill(2);
      const result = OffchainMessage.createOffChainMessage({
        message: testMessage,
        signerPublicKeys: [testPublicKey, secondPublicKey],
        applicationDomain: testAppDomain,
        format: 0,
        isLegacy: false,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.STANDARD);
      expect(detected.header).toBeDefined();
      if (detected.header && 'signersCount' in detected.header) {
        expect(detected.header.signersCount).toBe(2);
      }
    });

    it('should handle custom application domain', () => {
      const customDomain = 'custom.domain';
      const result = OffchainMessage.createOffChainMessage({
        message: testMessage,
        signerPublicKeys: [testPublicKey],
        applicationDomain: customDomain,
        format: 0,
        isLegacy: false,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.STANDARD);
      if (detected.header && 'applicationDomain' in detected.header) {
        const domainBytes = detected.header.applicationDomain;
        const decoder = new TextDecoder();
        const decodedDomain = decoder.decode(
          domainBytes.slice(0, customDomain.length),
        );
        expect(decodedDomain).toBe(customDomain);
      }
    });
  });

  describe('Legacy Format', () => {
    it('should create legacy message correctly', () => {
      const result = OffchainMessage.createOffChainMessage({
        message: testMessage,
        isLegacy: true,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.LEGACY);
      expect(detected.header).toBeDefined();
      if (detected.header && 'format' in detected.header) {
        expect(detected.header.version).toBe(0);
        expect((detected.header as IOffChainMessageHeaderLegacy).length).toBe(
          testMessage.length,
        );
      }
    });

    it('should create legacy message with format 0 (ASCII)', () => {
      const asciiMessage = 'Hello ASCII!';
      const result = OffchainMessage.createOffChainMessage({
        message: asciiMessage,
        format: 0,
        isLegacy: true,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.LEGACY);
      if (detected.header && 'format' in detected.header) {
        expect(detected.header.format).toBe(0);
      }
    });
  });

  describe('Error Cases', () => {
    it('should throw on empty message', () => {
      expect(() =>
        OffchainMessage.createOffChainMessage({
          message: '',
          isLegacy: false,
        }),
      ).toThrow('Message cannot be empty');
    });

    it('should throw on non-ASCII characters in format 0', () => {
      expect(() =>
        OffchainMessage.createOffChainMessage({
          message: 'Hello, 世界!',
          format: 0,
          isLegacy: false,
        }),
      ).toThrow('Format 0 only supports printable ASCII characters');
    });

    it('should throw on missing signer public keys for standard format', () => {
      expect(() =>
        OffchainMessage.createOffChainMessage({
          message: testMessage,
          signerPublicKeys: [],
          isLegacy: false,
        }),
      ).toThrow('At least one signer public key is required');
    });

    it('should throw on invalid signer public key length', () => {
      const invalidPublicKey = new Uint8Array(31); // Wrong length
      expect(() =>
        OffchainMessage.createOffChainMessage({
          message: testMessage,
          signerPublicKeys: [invalidPublicKey],
          isLegacy: false,
        }),
      ).toThrow('Each signer public key must be 32 bytes');
    });

    it('should throw on message too long for format', () => {
      const longMessage = 'a'.repeat(1233); // Exceeds 1232 limit for format 0/1
      expect(() =>
        OffchainMessage.createOffChainMessage({
          message: longMessage,
          signerPublicKeys: [testPublicKey],
          format: 0,
          isLegacy: false,
        }),
      ).toThrow('Total message length');
    });
  });

  describe('Message Format Validation', () => {
    it('should handle UTF-8 messages in format 1', () => {
      const utf8Message = 'Hello, 世界!';
      const result = OffchainMessage.createOffChainMessage({
        message: utf8Message,
        signerPublicKeys: [testPublicKey],
        format: 1,
        isLegacy: false,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.STANDARD);
      if (detected.header && 'format' in detected.header) {
        expect(detected.header.format).toBe(1);
      }
    });

    it('should handle long UTF-8 messages in format 2', () => {
      const longUtf8Message = '世界'.repeat(500); // Long UTF-8 message
      const result = OffchainMessage.createOffChainMessage({
        message: longUtf8Message,
        signerPublicKeys: [testPublicKey],
        format: 2,
        isLegacy: false,
      });

      const messageBytes = Buffer.from(result, 'hex');
      const detected = OffchainMessage.detectOffChainMessageType(messageBytes);

      expect(detected.type).toBe(EOffChainMessageType.STANDARD);
      if (detected.header && 'format' in detected.header) {
        expect(detected.header.format).toBe(2);
      }
    });
  });
});
