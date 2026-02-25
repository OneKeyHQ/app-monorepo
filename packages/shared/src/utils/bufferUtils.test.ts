import { Buffer } from 'buffer';

import bufferUtils from './bufferUtils';

/*
yarn test packages/shared/src/utils/bufferUtils.test.ts
*/

describe('bufferUtils', () => {
  describe('toBuffer', () => {
    it('should convert hex string to Buffer', () => {
      const result = bufferUtils.toBuffer('0x48656c6c6f');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });

    it('should convert hex string without prefix to Buffer', () => {
      const result = bufferUtils.toBuffer('48656c6c6f');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });

    it('should convert utf8 string to Buffer', () => {
      const result = bufferUtils.toBuffer('Hello', 'utf8');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });

    it('should return Buffer as is', () => {
      const buff = Buffer.from('Hello');
      const result = bufferUtils.toBuffer(buff);
      expect(result).toBe(buff);
    });

    it('should convert Uint8Array to Buffer', () => {
      const arr = new Uint8Array([72, 101, 108, 108, 111]);
      const result = bufferUtils.toBuffer(arr);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });

    it('should convert ArrayBuffer to Buffer', () => {
      const arr = new Uint8Array([72, 101, 108, 108, 111]);
      const result = bufferUtils.toBuffer(arr.buffer);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });

    it('should throw error for invalid encoding', () => {
      expect(() => bufferUtils.toBuffer('invalid', 'hex')).toThrow();
    });
  });

  describe('textToHex', () => {
    it('should convert text to hex string', () => {
      const result = bufferUtils.textToHex('Hello');
      expect(result).toBe('48656c6c6f');
    });

    it('should convert text with custom encoding', () => {
      const result = bufferUtils.textToHex('Hello', 'utf8');
      expect(result).toBe('48656c6c6f');
    });
  });

  describe('hexToText', () => {
    it('should convert hex string to text', () => {
      const result = bufferUtils.hexToText('48656c6c6f');
      expect(result).toBe('Hello');
    });

    it('should convert hex with prefix to text', () => {
      const result = bufferUtils.hexToText('0x48656c6c6f');
      expect(result).toBe('Hello');
    });
  });

  describe('bytesToHex', () => {
    it('should convert Buffer to hex string', () => {
      const buff = Buffer.from('Hello');
      const result = bufferUtils.bytesToHex(buff);
      expect(result).toBe('48656c6c6f');
    });

    it('should convert Uint8Array to hex string', () => {
      const arr = new Uint8Array([72, 101, 108, 108, 111]);
      const result = bufferUtils.bytesToHex(arr);
      expect(result).toBe('48656c6c6f');
    });

    it('should return hex string as is', () => {
      const hex = '0x48656c6c6f';
      const result = bufferUtils.bytesToHex(hex);
      expect(result).toBe(hex);
    });
  });

  describe('bytesToUtf8', () => {
    it('should convert Buffer to utf8 string', () => {
      const buff = Buffer.from('Hello');
      const result = bufferUtils.bytesToUtf8(buff);
      expect(result).toBe('Hello');
    });

    it('should validate utf8 when checkIsValidUtf8 is true', () => {
      const buff = Buffer.from([0xff, 0xfe]);
      expect(() =>
        bufferUtils.bytesToUtf8(buff, { checkIsValidUtf8: true }),
      ).toThrow();
    });
  });

  describe('utf8ToBytes', () => {
    it('should convert utf8 string to Buffer', () => {
      const result = bufferUtils.utf8ToBytes('Hello');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });
  });

  describe('bytesToText', () => {
    it('should convert Buffer to text with default utf8', () => {
      const buff = Buffer.from('Hello');
      const result = bufferUtils.bytesToText(buff);
      expect(result).toBe('Hello');
    });

    it('should convert Buffer with custom encoding', () => {
      const buff = Buffer.from('Hello');
      const result = bufferUtils.bytesToText(buff, 'hex');
      expect(result).toBe('48656c6c6f');
    });
  });

  describe('bytesToBase64', () => {
    it('should convert Buffer to base64', () => {
      const buff = Buffer.from('Hello');
      const result = bufferUtils.bytesToBase64(buff);
      expect(result).toBe('SGVsbG8=');
    });
  });

  describe('base64ToBytes', () => {
    it('should convert base64 to Buffer', () => {
      const result = bufferUtils.base64ToBytes('SGVsbG8=');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('Hello');
    });
  });
});
