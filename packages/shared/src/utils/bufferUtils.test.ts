import bufferUtils from './bufferUtils';

describe('bufferUtils', () => {
  describe('toBuffer', () => {
    test('converts hex string to Buffer', () => {
      const buf = bufferUtils.toBuffer('68656c6c6f', 'hex');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('utf8')).toBe('hello');
    });

    test('handles 0x prefixed hex string', () => {
      const buf = bufferUtils.toBuffer('0x68656c6c6f', 'hex');
      expect(buf.toString('utf8')).toBe('hello');
    });

    test('converts Uint8Array to Buffer', () => {
      const uint8 = new Uint8Array([104, 101, 108, 108, 111]);
      const buf = bufferUtils.toBuffer(uint8);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('utf8')).toBe('hello');
    });

    test('converts ArrayBuffer to Buffer', () => {
      const uint8 = new Uint8Array([104, 101, 108, 108, 111]);
      const buf = bufferUtils.toBuffer(uint8.buffer);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('utf8')).toBe('hello');
    });
  });

  describe('textToHex & hexToText', () => {
    test('converts utf8 text to hex and back', () => {
      const text = 'OneKey Monorepo';
      const hex = bufferUtils.textToHex(text);
      expect(typeof hex).toBe('string');

      const restored = bufferUtils.hexToText(hex);
      expect(restored).toBe(text);
    });
  });

  describe('bytesToHex & hexToBytes', () => {
    test('converts bytes to hex string', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const hex = bufferUtils.bytesToHex(bytes);
      expect(hex).toBe('0102030405');
    });

    test('returns string input as-is for bytesToHex', () => {
      expect(bufferUtils.bytesToHex('010203')).toBe('010203');
    });

    test('converts hex back to Uint8Array', () => {
      const hex = '0102030405';
      const bytes = bufferUtils.hexToBytes(hex);
      expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('utf8ToBytes & bytesToUtf8', () => {
    test('converts utf8 string to bytes Buffer', () => {
      const buf = bufferUtils.utf8ToBytes('hello');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(Array.from(buf)).toEqual([104, 101, 108, 108, 111]);
    });

    test('converts bytes to utf8 text', () => {
      const bytes = new Uint8Array([104, 101, 108, 108, 111]);
      expect(bufferUtils.bytesToUtf8(bytes)).toBe('hello');
    });

    test('validates valid utf8 with checkIsValidUtf8 option', () => {
      const bytes = new Uint8Array([104, 101, 108, 108, 111]);
      expect(
        bufferUtils.bytesToUtf8(bytes, { checkIsValidUtf8: true }),
      ).toBe('hello');
    });

    test('throws error for invalid utf8 when checkIsValidUtf8 is true', () => {
      const invalidBytes = new Uint8Array([0xff, 0xff]);
      expect(() =>
        bufferUtils.bytesToUtf8(invalidBytes, { checkIsValidUtf8: true }),
      ).toThrow();
    });
  });

  describe('bytesToBase64 & base64ToBytes', () => {
    test('converts bytes to base64 string and back', () => {
      const originalText = 'Crypto Wallet Security';
      const bytes = bufferUtils.utf8ToBytes(originalText);
      const base64 = bufferUtils.bytesToBase64(bytes);

      expect(typeof base64).toBe('string');

      const restoredBytes = bufferUtils.base64ToBytes(base64);
      expect(restoredBytes.toString('utf8')).toBe(originalText);
    });
  });
});
