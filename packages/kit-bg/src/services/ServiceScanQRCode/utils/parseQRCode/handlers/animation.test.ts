import { UR, UREncoder } from '@ngraveio/bc-ur';

import animation, { resetAnimationQrcodeScan } from './animation';

const singlePart = (cborHex: string) =>
  UREncoder.encodeSinglePart(new UR(Buffer.from(cborHex, 'hex'), 'bytes'));

describe('animated QR handler', () => {
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
