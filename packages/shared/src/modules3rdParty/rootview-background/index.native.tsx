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
  const { r, g, b, a } = parsedColor.toRgb();
  RootViewBackground.setBackground(r, g, b, Math.round(a * 255));
};
