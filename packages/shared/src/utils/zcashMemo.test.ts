import {
  encodeZcashMemo,
  getZcashMemoDisplay,
  validateZcashMemoHex,
} from './zcashMemo';

describe('ZIP 302 memo field', () => {
  it('preserves spaces, Unicode and line breaks without guessing HEX text', () => {
    const text = ' 0x1234 中文\n🙂 ';
    const hex = encodeZcashMemo(text, 'utf8');
    expect(hex).toHaveLength(1024);
    expect(getZcashMemoDisplay(hex!).text).toBe(text);
    expect(encodeZcashMemo('0x1234', 'utf8')).not.toBe(
      encodeZcashMemo('0x1234', 'hex'),
    );
  });
  it('checks UTF-8 bytes at the 512-byte boundary', () => {
    expect(encodeZcashMemo('🙂'.repeat(128), 'utf8')).toHaveLength(1024);
    expect(() => encodeZcashMemo('🙂'.repeat(129), 'utf8')).toThrow();
    expect(() => encodeZcashMemo('\ud800', 'utf8')).toThrow();
  });
  it('accepts exact HEX bytes with optional prefix and pads to 512 bytes', () => {
    expect(encodeZcashMemo('0xFF000102', 'hex')).toBe(
      `ff000102${'00'.repeat(508)}`,
    );
    expect(encodeZcashMemo('ff'.repeat(512), 'hex')).toHaveLength(1024);
    for (const value of ['f', 'ffz0', 'ff 00', 'ff'.repeat(513)]) {
      expect(() => encodeZcashMemo(value, 'hex')).toThrow();
    }
  });
  it('matches the independent BLAKE2b-256 vector of the complete padded field', () => {
    expect(getZcashMemoDisplay(`ff000102${'00'.repeat(508)}`)).toEqual({
      hex: `ff000102${'00'.repeat(508)}`,
      hash: '372a583679ed9562946f4b0a3e9da8b267259960d2531492000cbff7f2ed626b',
      text: undefined,
    });
  });
  it('does not coerce binary, future or malformed UTF-8 bytes into readable text', () => {
    for (const hex of ['ff00', 'f700', 'c328']) {
      expect(
        getZcashMemoDisplay(encodeZcashMemo(hex, 'hex')!).text,
      ).toBeUndefined();
    }
    expect(encodeZcashMemo('', 'utf8')).toBeUndefined();
    expect(validateZcashMemoHex(undefined)).toBeUndefined();
    expect(() => validateZcashMemoHex('FF'.repeat(512))).toThrow();
  });
});
