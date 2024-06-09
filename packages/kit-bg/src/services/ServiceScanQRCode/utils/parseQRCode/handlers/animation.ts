import { URDecoder, UREncoder } from '@ngraveio/bc-ur';

import { airGapUrUtils } from '@onekeyhq/qr-wallet-sdk';

import { EQRCodeHandlerType } from '../type';

import type { IAnimationValue, IQRCodeHandler } from '../type';

let decoder: URDecoder = new URDecoder();
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
  decoder.receivePart(value);
  parts.push(value);

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
    animationData.parts = parts;
    animationData.fullUr = airGapUrUtils.urToJson({ ur });
    animationData.fullData = UREncoder.encodeSinglePart(ur).toUpperCase();
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
