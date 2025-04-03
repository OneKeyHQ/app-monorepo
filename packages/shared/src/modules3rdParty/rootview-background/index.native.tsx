import { colord } from 'colord';
import { NativeModules } from 'react-native';

import type { IUpdateRootViewBackgroundColor } from './type';

const { RootViewBackground } = NativeModules as {
  RootViewBackground: {
    setBackground: (r: number, g: number, b: number, a: number) => void;
  };
};

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
) => {
  const parsedColor = colord(color);
  RootViewBackground.setBackground(
    parsedColor.toRgb().r,
    parsedColor.toRgb().g,
    parsedColor.toRgb().b,
    255,
  );
};
