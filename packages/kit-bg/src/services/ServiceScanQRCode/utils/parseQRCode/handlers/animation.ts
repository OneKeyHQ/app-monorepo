import { URDecoder } from '@ngraveio/bc-ur';

import { EQRCodeHandlerType } from '../type';

import type { IAnimationValue, IQRCodeHandler } from '../type';

let decoder = new URDecoder();

// ur://bytes/1-3/1ABC
// ur://bytes/2-3/2ABC
// ur://bytes/3-3/3ABC
export const animation: IQRCodeHandler<IAnimationValue> = async (value) => {
  if (!/^ur:/i.test(value)) {
    return null;
  }

  if (!decoder.receivePart(value) || decoder.isError()) {
    decoder = new URDecoder();
    decoder.receivePart(value);
  }
  const partSize = decoder.expectedPartCount();
  const partIndexes = decoder.lastPartIndexes();
  const progress = decoder.estimatedPercentComplete();

  const animationData: IAnimationValue = {
    fullData: undefined,
    partSize,
    partIndexes,
    progress,
  };
  if (!decoder.isComplete()) {
    return {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      data: animationData,
    };
  }
  if (decoder.isSuccess()) {
    const ur = decoder.resultUR();
    const decoded = ur.decodeCBOR();
    if (Buffer.isBuffer(decoded)) {
      animationData.fullData = decoded.toString();
    } else {
      animationData.fullData = JSON.stringify(decoded);
    }
    return {
      type: EQRCodeHandlerType.ANIMATION_CODE,
      data: animationData,
    };
  }
  return null;
};
