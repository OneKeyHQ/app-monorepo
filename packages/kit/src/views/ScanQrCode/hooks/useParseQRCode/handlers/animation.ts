import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type {
  IAnimationValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

let CACHE_ANIMATION_DATA_LIST: (string | undefined)[];

export const animation: IQRCodeHandler<IAnimationValue> = (value, options) => {
  const urlValue = urlHandler(value, options);
  let result: IQRCodeHandlerResult<IAnimationValue> = null;
  if (urlValue) {
    if (['ur'].findIndex((item) => item === urlValue.data.urlSchema) !== -1) {
      const pathList = urlValue.data.urlPathList;
      const partList = pathList?.[1].split('-');

      const partIndex = Number(partList?.[0]);
      const partSize = Number(partList?.[1]);
      if (partSize !== (CACHE_ANIMATION_DATA_LIST?.length ?? -1)) {
        CACHE_ANIMATION_DATA_LIST = new Array(partSize).fill(undefined);
      }
      const partData = pathList?.[2];
      CACHE_ANIMATION_DATA_LIST[partIndex - 1] = partData ?? '';
      const fullData =
        CACHE_ANIMATION_DATA_LIST.findIndex(
          (item) => typeof item !== 'string',
        ) === -1
          ? (CACHE_ANIMATION_DATA_LIST as string[]).join('')
          : undefined;
      if (fullData) {
        CACHE_ANIMATION_DATA_LIST = [];
      }
      const animationData = {
        partIndex,
        partSize,
        partData,
        fullData,
      };
      result = {
        type: EQRCodeHandlerType.ANIMATION_CODE,
        data: animationData,
      };
    }
  }
  return result;
};
