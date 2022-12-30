import { useMemo } from 'react';

import { useIsVerticalLayout, useUserDevice } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIntroductionBigImage = () => {
  const { screenHeight, screenWidth } = useUserDevice();
  const isVertical = useIsVerticalLayout();
  const imageWidth = useMemo(() => {
    if (isVertical) {
      return screenWidth - 48 > 352 ? 352 : screenWidth - 48;
    }
    return 352;
  }, [isVertical, screenWidth]);
  const ratio = 1100 / 352;
  const imageHeight = useMemo(() => imageWidth * ratio, [imageWidth, ratio]);
  const marginT = useMemo(() => {
    const ySpace = platformEnv.isNative ? 84 : 64;
    if (isVertical) {
      return screenHeight - ySpace - 32 - 270 - imageHeight;
    }
    return screenHeight - ySpace - 32 - 80 - imageHeight > 0
      ? 0
      : screenHeight - ySpace - 32 - 80 - imageHeight;
  }, [isVertical, screenHeight, imageHeight]);
  return { imageHeight, imageWidth, marginT };
};

export const useStartedKeyTagImage = () => {
  const { screenWidth } = useUserDevice();
  const isVertical = useIsVerticalLayout();
  const ratio = 240 / 342;
  const imageWidth = useMemo(() => {
    if (isVertical) {
      return screenWidth - 48 > 342 ? 342 : screenWidth - 48;
    }
    return 342;
  }, [isVertical, screenWidth]);
  const imageHeight = useMemo(() => imageWidth * ratio, [imageWidth, ratio]);
  return { imageHeight, imageWidth };
};
