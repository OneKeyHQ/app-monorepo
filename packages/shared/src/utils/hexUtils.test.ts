import hexUtils from './hexUtils';

describe('hexUtils', () => {
  describe('hasHexPrefix', () => {
    it('detects lowercase 0x prefix', () => {
      expect(hexUtils.hasHexPrefix('0x1234')).toBe(true);
    });

    it('detects uppercase 0X prefix', () => {
      expect(hexUtils.hasHexPrefix('0X1234')).toBe(true);
    });

    it('returns false for strings without prefix', () => {
      expect(hexUtils.hasHexPrefix('1234')).toBe(false);
      expect(hexUtils.hasHexPrefix('')).toBe(false);
    });
  });

  describe('stripHexPrefix', () => {
    it('strips lowercase 0x prefix', () => {
      expect(hexUtils.stripHexPrefix('0x1234')).toBe('1234');
    });

    it('strips uppercase 0X prefix', () => {
      expect(hexUtils.stripHexPrefix('0X1234')).toBe('1234');
    });

    it('returns original string if no prefix is present', () => {
      expect(hexUtils.stripHexPrefix('1234')).toBe('1234');
      expect(hexUtils.stripHexPrefix('')).toBe('');
    });
  });

  describe('addHexPrefix', () => {
    it('adds 0x prefix if missing', () => {
      expect(hexUtils.addHexPrefix('1234')).toBe('0x1234');
    });

    it('preserves existing 0x or 0X prefix', () => {
      expect(hexUtils.addHexPrefix('0x1234')).toBe('0x1234');
      expect(hexUtils.addHexPrefix('0X1234')).toBe('0X1234');
    });
  });

  describe('stripHexZeros', () => {
    it('strips leading zeros from hex string', () => {
      expect(hexUtils.stripHexZeros('0x000102')).toBe('0x102');
    });

    it('returns 0x for zero hex value', () => {
      expect(hexUtils.stripHexZeros('0x0000')).toBe('0x');
    });
  });

  describe('hexlify', () => {
    it('hexlifies bytes with 0x prefix', () => {
      expect(hexUtils.hexlify(Buffer.from([0, 1, 2]))).toBe('0x000102');
    });

    it('respects removeZeros option', () => {
      expect(
        hexUtils.hexlify(Buffer.from([0, 1, 2]), { removeZeros: true }),
      ).toBe('0x102');
    });

    it('respects noPrefix option', () => {
      expect(
        hexUtils.hexlify(Buffer.from([0, 1, 2]), { noPrefix: true }),
      ).toBe('000102');
    });

    it('respects removeZeros and noPrefix options combined', () => {
      expect(
        hexUtils.hexlify(Buffer.from([0, 1, 2]), {
          removeZeros: true,
          noPrefix: true,
        }),
      ).toBe('102');
    });
  });

  describe('hexStringToUtf8String', () => {
    it('converts hex string with lowercase 0x prefix to UTF-8', () => {
      expect(hexUtils.hexStringToUtf8String('0x68656c6c6f')).toBe('hello');
    });

    it('converts hex string with uppercase 0X prefix to UTF-8', () => {
      expect(hexUtils.hexStringToUtf8String('0X68656c6c6f')).toBe('hello');
    });

    it('converts hex string without prefix to UTF-8', () => {
      expect(hexUtils.hexStringToUtf8String('68656c6c6f')).toBe('hello');
    });

    it('returns empty string for empty input', () => {
      expect(hexUtils.hexStringToUtf8String('')).toBe('');
    });
  });

  describe('utf8StringToHexString', () => {
    it('converts UTF-8 string to hex string with 0x prefix', () => {
      expect(hexUtils.utf8StringToHexString('hello')).toBe('0x68656c6c6f');
    });

    it('performs round-trip conversion correctly', () => {
      const original = 'OneKey Crypto Wallet';
      const hex = hexUtils.utf8StringToHexString(original);
      const decoded = hexUtils.hexStringToUtf8String(hex);
      expect(decoded).toBe(original);
    });
  });

  describe('stringToUtf8Bytes', () => {
    it('converts string to UTF-8 Buffer bytes', () => {
      const bytes = hexUtils.stringToUtf8Bytes('abc');
      expect(Buffer.isBuffer(bytes)).toBe(true);
      expect(Array.from(bytes)).toEqual([97, 98, 99]);
    });
  });

  describe('isHexString', () => {
    it('validates valid hex strings', () => {
      expect(hexUtils.isHexString('0x1234')).toBe(true);
      expect(hexUtils.isHexString('1234')).toBe(true);
    });

    it('returns false for invalid hex strings', () => {
      expect(hexUtils.isHexString('0xzz')).toBe(false);
    });
  });
});
