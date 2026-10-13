import { UR, UREncoder } from '@ngraveio/bc-ur';

import animation, { resetAnimationQrcodeScan } from './animation';

describe('animated QR handler', () => {
  beforeEach(() => resetAnimationQrcodeScan());

  it('refuses a frame declaring more parts than any code has', async () => {
    await expect(
      animation('ur:bytes/1-5000/lpadaxcsencylobemohsgm', {} as never),
    ).rejects.toThrow(/Malformed QR payload/);
  });

  it('refuses a frame whose payload is not bounded CBOR', async () => {
    await expect(
      animation(
        UREncoder.encodeSinglePart(new UR(Buffer.from('9f', 'hex'), 'bytes')),
        {} as never,
      ),
    ).rejects.toThrow(/Malformed QR payload/);
  });

  it('still completes a well-formed code', async () => {
    const part = UREncoder.encodeSinglePart(
      new UR(Buffer.from('44deadbeef', 'hex'), 'bytes'),
    );
    const result = await animation(part, {} as never);
    expect(result?.data.fullUr).toEqual({ type: 'bytes', cbor: '44deadbeef' });
  });
});
