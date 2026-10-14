import { UR, UREncoder } from '@ngraveio/bc-ur';
import urWords from '@ngraveio/bc-ur/dist/bytewords';

import {
  OneKeyErrorAirGapInvalidQrCode,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

import { resetAnimationQrcodeScan } from './handlers/animation';

import { parseQRCode } from '.';

jest.mock('./handlers', () => {
  const actual =
    jest.requireActual<typeof import('./handlers')>('./handlers');
  return {
    ...actual,
    getParseHandler: (name: EQRCodeHandlerNames) =>
      name === EQRCodeHandlerNames.bitcoin
        ? Promise.resolve(async () => {
            throw new OneKeyLocalError('handler failed');
          })
        : actual.getParseHandler(name),
  };
});

const animationOnly = { handlers: [EQRCodeHandlerNames.animation] };

describe('parseQRCode handler failures', () => {
  beforeEach(() => resetAnimationQrcodeScan());

  it('ends the scan visibly for a code beyond the size or part limits', async () => {
    // [seqNum 1, seqLen 100000, messageLen 1000000, checksum 0, 10-byte fragment]
    const cbor = `85011a000186a01a000f4240004a${'07'.repeat(10)}`;
    const frame = `ur:bytes/1-100000/${urWords.encode(
      cbor,
      urWords.STYLES.MINIMAL,
    )}`;
    await expect(parseQRCode(frame, animationOnly)).rejects.toBeInstanceOf(
      OneKeyErrorAirGapInvalidQrCode,
    );
  });

  it('ends the scan visibly for a code that completes into unbounded CBOR', async () => {
    // An indefinite-length array: the frames pass, the completed payload does not.
    const message = Buffer.from(`9f${'01'.repeat(40)}ff`, 'hex');
    const parts = new UREncoder(
      new UR(message, 'bytes'),
      10,
      0,
      10,
    ).encodeWhole();
    const last = parts.pop() as string;
    for (const part of parts) {
      await expect(parseQRCode(part, animationOnly)).resolves.toMatchObject({
        type: EQRCodeHandlerType.ANIMATION_CODE,
      });
    }
    await expect(parseQRCode(last, animationOnly)).rejects.toBeInstanceOf(
      OneKeyErrorAirGapInvalidQrCode,
    );
  });

  it('still falls back to an unknown code when an ordinary handler fails', async () => {
    await expect(
      parseQRCode('not a payment code', {
        handlers: [EQRCodeHandlerNames.bitcoin],
      }),
    ).resolves.toMatchObject({ type: EQRCodeHandlerType.UNKNOWN });
  });
});
