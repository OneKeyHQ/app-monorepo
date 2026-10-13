import { UR, UREncoder } from '@ngraveio/bc-ur';

import { assertBoundedCbor, assertBoundedUrPart } from './boundedUr';

const bytes = (hex: string) => Buffer.from(hex, 'hex');
const singlePart = (cborHex: string) =>
  UREncoder.encodeSinglePart(new UR(bytes(cborHex), 'bytes'));

describe('assertBoundedCbor', () => {
  it.each([
    ['a byte string', '44deadbeef'],
    ['an array', '83010203'],
    ['a map', 'a201020304'],
    ['a tagged item', 'd9012f44deadbeef'],
  ])('accepts %s', (_case, hex) => {
    expect(() => assertBoundedCbor(bytes(hex))).not.toThrow();
  });

  // Each of these exhausts memory or hangs the vendor decoders.
  it.each([
    ['an indefinite array', '9f'],
    ['an indefinite map', 'bf'],
    ['an array declaring 4 billion items', '9affffffff'],
    ['a byte string longer than the payload', '5affffffff'],
    ['trailing bytes', '0101'],
    ['nesting deeper than any payload', `${'81'.repeat(100)}00`],
  ])('refuses %s', (_case, hex) => {
    expect(() => assertBoundedCbor(bytes(hex))).toThrow(/Malformed QR payload/);
  });
});

describe('assertBoundedUrPart', () => {
  it('accepts a well-formed single-part UR', () => {
    expect(() => assertBoundedUrPart(singlePart('44deadbeef'))).not.toThrow();
  });

  it('accepts the parts of an animated UR', () => {
    const encoder = new UREncoder(
      new UR(bytes(`5901f4${'ab'.repeat(500)}`), 'bytes'),
      100,
    );
    for (let i = 0; i < encoder.fragmentsLength; i += 1) {
      expect(() => assertBoundedUrPart(encoder.nextPart())).not.toThrow();
    }
  });

  it.each([
    ['an unbounded CBOR payload', () => singlePart('9f')],
    [
      'more parts than any code has',
      () => 'ur:bytes/1-5000/lpadaxcsencylobemohsgm',
    ],
    ['a broken checksum', () => `${singlePart('44deadbeef').slice(0, -2)}aa`],
    ['text that is not a UR', () => 'ur:bytes/1-2/not-bytewords!'],
  ])('refuses %s', (_case, part) => {
    expect(() => assertBoundedUrPart(part())).toThrow();
  });
});
