import { zcashHexToBytes } from './hex';

describe('zcashHexToBytes', () => {
  it('decodes well-formed hex, with or without 0x', () => {
    expect(Array.from(zcashHexToBytes('0aff'))).toEqual([10, 255]);
    expect(Array.from(zcashHexToBytes('0x0aff'))).toEqual([10, 255]);
  });

  it('refuses odd length and non-hex characters', () => {
    expect(() => zcashHexToBytes('abc')).toThrow('malformed hex');
    expect(() => zcashHexToBytes('zz')).toThrow('malformed hex');
  });
});
