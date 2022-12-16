import { useContext } from 'react';

import BottomTabBarHeightContext from './BottomTabBarHeightContext';

export default function useFloatingBottomTabBarHeight() {
  const height = useContext(BottomTabBarHeightContext);

  if (height === undefined) {
    throw new Error(
      "Couldn't find the bottom tab bar height. Are you inside a screen in Bottom Tab Navigator?",
    );
  }

  return height;
}
