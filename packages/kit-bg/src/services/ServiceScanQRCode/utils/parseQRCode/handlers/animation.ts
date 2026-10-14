import { URDecoder, UREncoder } from '@ngraveio/bc-ur';

import {
  UrScanRejectedError,
  airGapUrUtils,
  assertBoundedCbor,
  checkUrPart,
  urTooLargeError,
} from '@onekeyhq/qr-wallet-sdk';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IAnimationValue, IQRCodeHandler } from '../type';

let decoder = new URDecoder();
let parts: string[] = [];

// ur://bytes/1-3/1ABC
// ur://bytes/2-3/2ABC
// ur://bytes/3-3/3ABC
const animation: IQRCodeHandler<IAnimationValue> = async (value) => {
  if (!/^ur:/i.test(value)) {
    return null;
  }

  // if (!decoder || !decoder.receivePart(value) || decoder.isError()) {
  //   parts = [];
  //   decoder = new URDecoder();
  // }
  // A scanned frame is untrusted. A malformed one is dropped and the scan goes on, as the vendor
  // decoder does for a bad checksum; a code beyond the size or part limits ends the scan instead
  // of leaving it waiting for frames that will never be accepted.
  if (parts.findIndex((part) => part === value) === -1) {
    const verdict = checkUrPart(value);
    if (verdict === 'too-large') throw urTooLargeError();
    if (verdict === 'ok') {
      decoder.receivePart(value);
      parts.push(value);
    }
  }

  const partSize = decoder.expectedPartCount();
  const partIndexes = decoder.lastPartIndexes();
  const progress = decoder.estimatedPercentComplete();

  const animationData: IAnimationValue = {
    partSize,
    partIndexes,
    progress,
    parts: [],
  };
  if (!decoder.isComplete()) {
    return {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      data: animationData,
    };
  }
  if (decoder.isSuccess()) {
    const ur = decoder.resultUR();
    try {
      assertBoundedCbor(ur.cbor);
    } catch (error) {
      throw new UrScanRejectedError((error as Error).message);
    }
    animationData.parts = parts;
    animationData.fullUr = airGapUrUtils.urToJson({ ur });
    animationData.fullData = UREncoder.encodeSinglePart(ur).toUpperCase();
    if (
      animationData.partSize === 0 &&
      animationData.partIndexes.length === 0 &&
      animationData.parts.length > 0 &&
      animationData.progress === 0
    ) {
      // When the data is very little, the hardware returns a static code, at this time, you need to manually set the progress to 100%
      animationData.progress = 1;
    }
    return {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      data: animationData,
    };
  }
  return null;
};

export default animation;

export function resetAnimationQrcodeScan() {
  console.log('resetAnimationQrcodeScan >>>>>> ');
  decoder = new URDecoder();
  parts = [];
}
