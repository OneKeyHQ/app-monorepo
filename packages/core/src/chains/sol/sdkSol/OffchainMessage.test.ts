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
        // Use Buffer.toString instead of TextDecoder for cross-engine compat
        // (Hermes may not expose TextDecoder as a bare global after poly-filling)
        const decodedDomain = Buffer.from(
          domainBytes.slice(0, customDomain.length),
        ).toString('utf-8');
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

  // Golden vectors produced by the reference implementation,
  // `getOffchainMessageV1Encoder()` from `@solana/offchain-messages@7`.
  describe('Version 1', () => {
    const key = (fill: number) => new Uint8Array(32).fill(fill);

    it('should match the reference encoder for a single signer', () => {
      expect(
        OffchainMessage.createOffChainMessageV1({
          message: testMessage,
          requiredSigners: [key(1)],
        }),
      ).toBe(
        'ff736f6c616e61206f6666636861696e0101010101010101010101010101010101010101010101010101010101010101010148656c6c6f2c20536f6c616e6121',
      );
    });

    it('should sort required signers lexicographically', () => {
      const sorted = OffchainMessage.createOffChainMessageV1({
        message: testMessage,
        requiredSigners: [key(1), key(2)],
      });
      const unsorted = OffchainMessage.createOffChainMessageV1({
        message: testMessage,
        requiredSigners: [key(2), key(1)],
      });

      expect(sorted).toBe(unsorted);
      expect(sorted).toBe(
        'ff736f6c616e61206f6666636861696e01020101010101010101010101010101010101010101010101010101010101010101020202020202020202020202020202020202020202020202020202020202020248656c6c6f2c20536f6c616e6121',
      );
    });

    it('should encode multi-byte UTF-8 content', () => {
      expect(
        OffchainMessage.createOffChainMessageV1({
          message: '你好 🔑',
          requiredSigners: [key(1)],
        }),
      ).toBe(
        'ff736f6c616e61206f6666636861696e01010101010101010101010101010101010101010101010101010101010101010101e4bda0e5a5bd20f09f9491',
      );
    });

    it('should encode three unsorted signers in order', () => {
      expect(
        OffchainMessage.createOffChainMessageV1({
          message: 'multi',
          requiredSigners: [key(3), key(1), key(2)],
        }),
      ).toBe(
        'ff736f6c616e61206f6666636861696e01030101010101010101010101010101010101010101010101010101010101010101020202020202020202020202020202020202020202020202020202020202020203030303030303030303030303030303030303030303030303030303030303036d756c7469',
      );
    });

    it('should not carry version 0 fields', () => {
      const bytes = OffchainMessage.createOffChainMessageV1Bytes({
        message: testMessage,
        requiredSigners: [key(1)],
      });

      // 16 signing domain + 1 version + 1 signer count + 32 signer + content.
      // No application domain (32), no message format (1), no u16 length prefix.
      expect(bytes.length).toBe(16 + 1 + 1 + 32 + testMessage.length);
      expect(bytes[16]).toBe(1); // version byte
      expect(bytes[17]).toBe(1); // signer count
    });

    it('should reject an empty message', () => {
      expect(() =>
        OffchainMessage.createOffChainMessageV1({
          message: '',
          requiredSigners: [key(1)],
        }),
      ).toThrow('Message cannot be empty');
    });

    it('should reject an empty signer list', () => {
      expect(() =>
        OffchainMessage.createOffChainMessageV1({
          message: testMessage,
          requiredSigners: [],
        }),
      ).toThrow('At least one required signer is required');
    });

    it('should reject duplicate signers', () => {
      expect(() =>
        OffchainMessage.createOffChainMessageV1({
          message: testMessage,
          requiredSigners: [key(1), key(1)],
        }),
      ).toThrow('Required signers must be unique');
    });

    it('should reject a body past the version 1 ceiling', () => {
      const oversized = 'a'.repeat(1024 * 1024 + 1);
      expect(() =>
        OffchainMessage.createOffChainMessageV1({
          message: oversized,
          requiredSigners: [key(1)],
        }),
      ).toThrow('exceeds the maximum');
    });

    it('should accept a body at the version 1 ceiling', () => {
      const atLimit = 'a'.repeat(1024 * 1024);
      expect(() =>
        OffchainMessage.createOffChainMessageV1Bytes({
          message: atLimit,
          requiredSigners: [key(1)],
        }),
      ).not.toThrow();
    });

    it('should reject a signer that is not 32 bytes', () => {
      expect(() =>
        OffchainMessage.createOffChainMessageV1({
          message: testMessage,
          requiredSigners: [new Uint8Array(31).fill(1)],
        }),
      ).toThrow('Each required signer must be 32 bytes');
    });
  });

  describe('Version 1 Detection', () => {
    const key = (fill: number) => new Uint8Array(32).fill(fill);

    const detectV1 = (message: string, requiredSigners: Uint8Array[]) =>
      OffchainMessage.detectOffChainMessageType(
        OffchainMessage.createOffChainMessageV1Bytes({
          message,
          requiredSigners,
        }),
      );

    it('should detect a version 1 message', () => {
      const detected = detectV1(testMessage, [key(1), key(2)]);

      expect(detected.type).toBe(EOffChainMessageType.V1);
      expect(detected.header).toEqual({
        version: 1,
        signersCount: 2,
        requiredSigners: [key(1), key(2)],
      });
    });

    it('should not report a long version 1 message as standard', () => {
      // A version 1 body long enough to satisfy the version 0 length checks used to be parsed
      // with the version 0 layout, reporting signer bytes as the application domain.
      expect(detectV1(` ${'a'.repeat(1100)}`, [key(1)]).type).toBe(
        EOffChainMessageType.V1,
      );
    });

    it('should reject a version 1 message truncated before the signer count', () => {
      const domainAndVersion = OffchainMessage.createOffChainMessageV1Bytes({
        message: 'x',
        requiredSigners: [key(1)],
      }).slice(0, 17);

      expect(
        OffchainMessage.detectOffChainMessageType(domainAndVersion).type,
      ).toBe(EOffChainMessageType.INVALID);
    });

    it('should reject a version 1 message without content', () => {
      const preamble = OffchainMessage.createOffChainMessageV1Bytes({
        message: 'x',
        requiredSigners: [key(1)],
      }).slice(0, -1);

      expect(OffchainMessage.detectOffChainMessageType(preamble).type).toBe(
        EOffChainMessageType.INVALID,
      );
    });

    it('should not parse an unknown version with the version 0 layout', () => {
      const bytes = OffchainMessage.createOffChainMessageV1Bytes({
        message: testMessage,
        requiredSigners: [key(1)],
      });
      bytes[16] = 2; // version byte

      expect(OffchainMessage.detectOffChainMessageType(bytes).type).toBe(
        EOffChainMessageType.INVALID,
      );
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
