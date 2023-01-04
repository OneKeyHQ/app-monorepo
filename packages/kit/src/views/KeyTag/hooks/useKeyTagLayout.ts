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
      return screenHeight - ySpace - 109 - 220 - imageHeight;
    }
    return screenHeight - ySpace - 112 - 80 - imageHeight > 0
      ? 0
      : screenHeight - ySpace - 112 - 80 - imageHeight;
  }, [isVertical, screenHeight, imageHeight]);
  return { imageHeight, imageWidth, marginT };
};

export const useStartedKeyTagImage = () => {
  const { screenWidth } = useUserDevice();
  const isVertical = useIsVerticalLayout();
  const imageBoxWidth = useMemo(() => {
    if (isVertical) {
      return screenWidth - 48;
    }
    const fullWidth = screenWidth > 800 ? 800 : screenWidth;
    const space = screenWidth > 800 ? 24 : 72;
    return (fullWidth - space) / 2;
  }, [isVertical, screenWidth]);
  const imageRatio = 240 / 342;
  const imageBoxRatio = 241 / 342;
  const imageWidth = imageBoxWidth > 342 ? 342 : imageBoxWidth;
  const imageHeight = imageWidth * imageRatio;
  const imageBoxHeight =
    imageBoxWidth * imageBoxRatio > 241 ? 242 : imageBoxWidth * imageBoxRatio;
  return { imageHeight, imageBoxWidth, imageWidth, imageBoxHeight };
};

export const useImportKeytagSpaceSize = () => {
  const { screenWidth } = useUserDevice();
  const isVertical = useIsVerticalLayout();
  const size = useMemo(() => {
    let resSize = 5;
    const extraWidth = isVertical
      ? screenWidth - 256 - 36
      : screenWidth - 256 * 2 - 48 - 82 * 2;
    const spaceSizeWidth = isVertical ? 48 : 48 * 2;
    if (extraWidth > spaceSizeWidth) {
      resSize = 5 + Math.floor(extraWidth / spaceSizeWidth);
    }
    if (resSize > 7 && !isVertical) {
      return 7;
    }
    return resSize;
  }, [screenWidth, isVertical]);
  return { size };
};
