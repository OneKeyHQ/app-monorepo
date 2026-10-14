import { UR, UREncoder } from '@ngraveio/bc-ur';
import urWords from '@ngraveio/bc-ur/dist/bytewords';
import { InvalidSchemeError } from '@ngraveio/bc-ur/dist/errors';

import airGapUrUtils from './airGapUrUtils';
import {
  MAX_UR_MESSAGE_BYTES,
  assertBoundedCbor,
  checkUrPart,
} from './boundedUr';

const bytes = (hex: string) => Buffer.from(hex, 'hex');
const singlePart = (cborHex: string) =>
  UREncoder.encodeSinglePart(new UR(bytes(cborHex), 'bytes'));

/** CBOR head for a major type and an unsigned argument. */
function cborHead(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([major * 32 + value]);
  if (value < 0x1_00_00) {
    const out = Buffer.alloc(3);
    out[0] = major * 32 + 25;
    out.writeUInt16BE(value, 1);
    return out;
  }
  const out = Buffer.alloc(5);
  out[0] = major * 32 + 26;
  out.writeUInt32BE(value, 1);
  return out;
}

/** A fountain frame whose headers say whatever the test needs. */
function fountainFrame(options: {
  seqNum: number;
  seqLength: number;
  messageLength: number;
  fragmentLength: number;
  textSeqLength?: number;
}): string {
  const cbor = Buffer.concat([
    Buffer.from([0x85]),
    cborHead(0, options.seqNum),
    cborHead(0, options.seqLength),
    cborHead(0, options.messageLength),
    cborHead(0, 0),
    cborHead(2, options.fragmentLength),
    Buffer.alloc(options.fragmentLength, 7),
  ]);
  const body = urWords.encode(cbor.toString('hex'), urWords.STYLES.MINIMAL);
  return `ur:bytes/${options.seqNum}-${options.textSeqLength ?? options.seqLength}/${body}`;
}

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

describe('checkUrPart', () => {
  it('accepts a well-formed single-part code', () => {
    expect(checkUrPart(singlePart('44deadbeef'))).toBe('ok');
  });

  it.each([200, 60, 40])(
    'accepts every frame of an animated code cut into %s-byte fragments',
    (fragmentLength) => {
      const encoder = new UREncoder(
        new UR(bytes(`5901f4${'ab'.repeat(500)}`), 'bytes'),
        fragmentLength,
        0,
        10,
      );
      // Twice the part count includes mixed fountain frames, as a code shown in a loop has.
      for (let i = 0; i < encoder.fragmentsLength * 2; i += 1) {
        expect(checkUrPart(encoder.nextPart())).toBe('ok');
      }
    },
  );

  it('accepts a 1 MB code cut into 40-byte fragments', () => {
    const fragmentLength = 40;
    const seqLength = Math.ceil(MAX_UR_MESSAGE_BYTES / fragmentLength);
    expect(
      checkUrPart(
        fountainFrame({
          seqNum: seqLength * 2,
          seqLength,
          messageLength: MAX_UR_MESSAGE_BYTES,
          fragmentLength,
        }),
      ),
    ).toBe('ok');
  });

  it.each([
    ['a broken checksum', () => `${singlePart('44deadbeef').slice(0, -2)}aa`],
    ['text that is not a UR', () => 'ur:bytes/1-2/not-bytewords!'],
    ['a payload that is not bounded CBOR', () => singlePart('9f')],
    [
      'a part count that does not fit its sizes',
      () =>
        fountainFrame({
          seqNum: 1,
          seqLength: 5000,
          messageLength: 10,
          fragmentLength: 1,
        }),
    ],
    [
      'a text header that disagrees with the frame',
      () =>
        fountainFrame({
          seqNum: 1,
          seqLength: 10,
          messageLength: 10,
          fragmentLength: 1,
          textSeqLength: 11,
        }),
    ],
  ])('drops %s as malformed', (_case, part) => {
    expect(checkUrPart(part())).toBe('malformed');
  });

  it.each([
    [
      'more than 1 MB of data',
      { messageLength: 2 * MAX_UR_MESSAGE_BYTES, fragmentLength: 200 },
    ],
    [
      'more parts than the decoder can take',
      { messageLength: 1_000_000, fragmentLength: 10 },
    ],
  ])('flags a code with %s as too large', (_case, sizes) => {
    const seqLength = Math.ceil(sizes.messageLength / sizes.fragmentLength);
    expect(checkUrPart(fountainFrame({ seqNum: 1, seqLength, ...sizes }))).toBe(
      'too-large',
    );
  });
});

/** Settles `run()` or fails the test, so a promise that never settles cannot pass. */
async function settledWithin<T>(run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('did not settle')), 1000);
  });
  try {
    return await Promise.race([Promise.resolve().then(run), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

describe('scanning with airGapUrUtils', () => {
  it('drops a malformed frame on the live decoder and decodes the code that follows', async () => {
    const { receivePart, promiseResultUR } =
      airGapUrUtils.createAnimatedURDecoder();
    receivePart?.(`${singlePart('44deadbeef').slice(0, -2)}aa`);
    receivePart?.('0x1234abcd');
    receivePart?.(singlePart('44deadbeef'));
    const ur = await settledWithin(() => promiseResultUR);
    expect(ur.cbor.toString('hex')).toBe('44deadbeef');
  });

  it.each([
    ['plain hex text', '0x1234abcd'],
    ['a bitcoin address', 'bc1qxyz'],
    ['a UR with a broken checksum', `${singlePart('44deadbeef').slice(0, -2)}aa`],
  ])('fails one-shot decoding of %s as an invalid scheme', async (_case, qr) => {
    await expect(
      settledWithin(() => airGapUrUtils.qrcodeToUr(qr)),
    ).rejects.toBeInstanceOf(InvalidSchemeError);
  });

  it('decodes a valid code in one shot', async () => {
    const single = await settledWithin(() =>
      airGapUrUtils.qrcodeToUr(singlePart('44deadbeef')),
    );
    expect(single.cbor.toString('hex')).toBe('44deadbeef');

    const message = bytes(`5901f4${'ab'.repeat(500)}`);
    const encoder = new UREncoder(new UR(message, 'bytes'), 100, 0, 10);
    const multi = await settledWithin(() =>
      airGapUrUtils.qrcodeToUr(encoder.encodeWhole().join('\n')),
    );
    expect(multi.cbor.equals(message)).toBe(true);
  });

  it('ends with an error for a code beyond the limits', async () => {
    await expect(
      airGapUrUtils.qrcodeToUr([
        fountainFrame({
          seqNum: 1,
          seqLength: 100_000,
          messageLength: 1_000_000,
          fragmentLength: 10,
        }),
      ]),
    ).rejects.toThrow(/too large to scan/);
  });
});
