import { StatusBar } from 'react-native';

import type { ColorValue, StatusBarAnimation } from 'react-native';

export const setTranslucent = (translucent: boolean): void => {
  StatusBar.setTranslucent(translucent);
};

export const setBackgroundColor = (
  color: ColorValue,
  animated?: boolean,
): void => {
  StatusBar.setBackgroundColor(color, animated);
};

export const setHidden = (
  hidden: boolean,
  animation?: StatusBarAnimation,
): void => {
  StatusBar.setHidden(hidden, animation);
};
