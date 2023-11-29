/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ColorValue, StatusBarAnimation } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setTranslucent = (translucent: boolean): void => {};

export const setBackgroundColor = (
  color: ColorValue,
  animated?: boolean,
): void => {};

export const setHidden = (
  hidden: boolean,
  animation?: StatusBarAnimation,
): void => {};

export const setLightContent = (isAnimated = true) => {};

export const setDarkContent = (isAnimated = true) => {};
