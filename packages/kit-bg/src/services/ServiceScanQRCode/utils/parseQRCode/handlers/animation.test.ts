import { UR, UREncoder } from '@ngraveio/bc-ur';

import animation, { resetAnimationQrcodeScan } from './animation';

const singlePart = (cborHex: string) =>
  UREncoder.encodeSinglePart(new UR(Buffer.from(cborHex, 'hex'), 'bytes'));

describe('animated QR handler', () => {
  it('ends the scan for a code beyond the size or part limits', async () => {
    resetAnimationQrcodeScan();
    const urWords = (await import('@ngraveio/bc-ur/dist/bytewords')).default;
    // [seqNum 1, seqLen 100000, messageLen 1000000, checksum 0, 10-byte fragment]
    const cbor = `85011a000186a01a000f4240004a${'07'.repeat(10)}`;
    const body = urWords.encode(cbor, urWords.STYLES.MINIMAL);
    await expect(
      animation(`ur:bytes/1-100000/${body}`, {} as never),
    ).rejects.toThrow(/too large to scan/);
  });

  beforeEach(() => resetAnimationQrcodeScan());

  it.each([
    [
      'declaring more parts than any code has',
      'ur:bytes/1-5000/lpadaxcsencylobemohsgm',
    ],
    ['whose payload is not bounded CBOR', singlePart('9f')],
    ['with a broken checksum', `${singlePart('44deadbeef').slice(0, -2)}aa`],
  ])('drops a frame %s and keeps scanning', async (_case, frame) => {
    const dropped = await animation(frame, {} as never);
    expect(dropped?.data.fullUr).toBeUndefined();

    // The next good frame still completes the scan.
    const completed = await animation(singlePart('44deadbeef'), {} as never);
    expect(completed?.data.fullUr).toEqual({
      type: 'bytes',
      cbor: '44deadbeef',
    });
  });
});
