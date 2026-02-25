import hexUtils from './hexUtils';

/*
yarn test packages/shared/src/utils/hexUtils.test.ts
*/

describe('hexUtils', () => {
  describe('hasHexPrefix', () => {
    it('should return true for 0x prefix', () => {
      expect(hexUtils.hasHexPrefix('0x1234')).toBe(true);
    });

    it('should return true for 0X prefix', () => {
      expect(hexUtils.hasHexPrefix('0X1234')).toBe(true);
    });

    it('should return false for string without prefix', () => {
      expect(hexUtils.hasHexPrefix('1234')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hexUtils.hasHexPrefix('')).toBe(false);
    });
  });

  describe('stripHexPrefix', () => {
    it('should remove 0x prefix', () => {
      expect(hexUtils.stripHexPrefix('0x1234')).toBe('1234');
    });

    it('should remove 0X prefix', () => {
      expect(hexUtils.stripHexPrefix('0X1234')).toBe('1234');
    });

    it('should return string as is without prefix', () => {
      expect(hexUtils.stripHexPrefix('1234')).toBe('1234');
    });
  });

  describe('addHexPrefix', () => {
    it('should add 0x prefix to string without prefix', () => {
      expect(hexUtils.addHexPrefix('1234')).toBe('0x1234');
    });

    it('should not add prefix to string with 0x prefix', () => {
      expect(hexUtils.addHexPrefix('0x1234')).toBe('0x1234');
    });

    it('should not add prefix to string with 0X prefix', () => {
      expect(hexUtils.addHexPrefix('0X1234')).toBe('0X1234');
    });
  });

  describe('hexlify', () => {
    it('should convert number to hex string', () => {
      const result = hexUtils.hexlify(255);
      expect(result).toBe('0xff');
    });

    it('should convert bigint to hex string', () => {
      const result = hexUtils.hexlify(BigInt(255));
      expect(result).toBe('0xff');
    });

    it('should convert bytes to hex string', () => {
      const bytes = new Uint8Array([0, 1, 255]);
      const result = hexUtils.hexlify(bytes);
      expect(result).toBe('0x0001ff');
    });

    it('should handle hex string input', () => {
      const result = hexUtils.hexlify('0x1234');
      expect(result).toBe('0x1234');
    });

    it('should remove zeros when removeZeros option is true', () => {
      const result = hexUtils.hexlify('0x00001234', { removeZeros: true });
      expect(result).toBe('0x1234');
    });

    it('should strip prefix when noPrefix option is true', () => {
      const result = hexUtils.hexlify('0x1234', { noPrefix: true });
      expect(result).toBe('1234');
    });

    it('should remove zeros and strip prefix when both options are true', () => {
      const result = hexUtils.hexlify('0x00001234', { removeZeros: true, noPrefix: true });
      expect(result).toBe('1234');
    });
  });

  describe('isHexString', () => {
    it('should return true for valid hex string with prefix', () => {
      expect(hexUtils.isHexString('0x1234')).toBe(true);
    });

    it('should return true for valid hex string without prefix', () => {
      expect(hexUtils.isHexString('1234')).toBe(true);
    });

    it('should return true for valid hex string with uppercase', () => {
      expect(hexUtils.isHexString('0xABCD')).toBe(true);
    });

    it('should return false for invalid hex string', () => {
      expect(hexUtils.isHexString('0xGGGG')).toBe(false);
    });

    it('should return true for empty string (0x is valid hex)', () => {
      expect(hexUtils.isHexString('')).toBe(true);
    });

    it('should validate length when specified', () => {
      expect(hexUtils.isHexString('0x1234', 2)).toBe(true);
      expect(hexUtils.isHexString('0x123456', 2)).toBe(false);
    });
  });

  describe('hexStringToUtf8String', () => {
    it('should convert hex string to utf8 string', () => {
      const result = hexUtils.hexStringToUtf8String('0x48656c6c6f');
      expect(result).toBe('Hello');
    });

    it('should convert hex string without prefix', () => {
      const result = hexUtils.hexStringToUtf8String('48656c6c6f');
      expect(result).toBe('Hello');
    });

    it('should handle empty hex string', () => {
      const result = hexUtils.hexStringToUtf8String('');
      expect(result).toBe('');
    });

    it('should handle hex string with 0x prefix only', () => {
      const result = hexUtils.hexStringToUtf8String('0x');
      expect(result).toBe('');
    });

    it('should handle unicode characters', () => {
      const result = hexUtils.hexStringToUtf8String('0xe4b8ade69687');
      expect(result).toBe('中文');
    });

    it('should handle invalid hex gracefully', () => {
      const result = hexUtils.hexStringToUtf8String('0xZZ');
      // Invalid hex pairs are parsed as NaN which becomes 0, resulting in null byte
      expect(result).toBe('\x00');
    });
  });

  describe('utf8StringToHexString', () => {
    it('should convert utf8 string to hex string', () => {
      const result = hexUtils.utf8StringToHexString('Hello');
      expect(result).toBe('0x48656c6c6f');
    });

    it('should handle empty string', () => {
      const result = hexUtils.utf8StringToHexString('');
      expect(result).toBe('0x');
    });

    it('should handle unicode characters', () => {
      const result = hexUtils.utf8StringToHexString('中文');
      expect(result).toBe('0xe4b8ade69687');
    });
  });

  describe('stringToUtf8Bytes', () => {
    it('should convert string to utf8 bytes', () => {
      const result = hexUtils.stringToUtf8Bytes('Hello');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('hex')).toBe('48656c6c6f');
    });

    it('should handle unicode characters', () => {
      const result = hexUtils.stringToUtf8Bytes('中文');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('hex')).toBe('e4b8ade69687');
    });
  });

  describe('stripHexZeros', () => {
    it('should strip leading zeros from hex string', () => {
      const result = hexUtils.stripHexZeros('0x00001234');
      expect(result).toBe('0x1234');
    });

    it('should return 0x for all zeros (ethers behavior)', () => {
      const result = hexUtils.stripHexZeros('0x0000');
      expect(result).toBe('0x');
    });

    it('should handle hex without leading zeros', () => {
      const result = hexUtils.stripHexZeros('0x1234');
      expect(result).toBe('0x1234');
    });
  });
});
