import { createContext, useContext, useMemo } from 'react';

import { Dimensions } from 'react-native';

import useProviderIsVerticalLayout from '../hocs/Provider/hooks/useProviderIsVerticalLayout';

export { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useIsVerticalLayout() {
  return useProviderIsVerticalLayout();
}

export const SCREEN_SIZE = {
  MEDIUM: 768, // tablets
  LARGE: 1024, // laptops/desktops
  XLARGE: 1280, // extra Large laptops/desktops
  ULTRALARGE: 9999,
} as const;

export type IDeviceScreenSize = 'SMALL' | 'NORMAL' | 'LARGE' | 'XLARGE';

export const getScreenSize = (screenWidth: number): IDeviceScreenSize => {
  if (!screenWidth) {
    return 'NORMAL';
  }

  // (0, SCREEN_SIZE.MEDIUM)
  // https://www.ios-resolution.com/
  // iPad Mini (6th gen)	744
  // iPad Mini (5th gen)	768
  if (screenWidth <= SCREEN_SIZE.MEDIUM) {
    return 'SMALL';
  }

  // [SCREEN_SIZE.MEDIUM, SCREEN_SIZE.LARGE)
  if (screenWidth <= SCREEN_SIZE.LARGE) {
    return 'NORMAL';
  }

  // [SCREEN_SIZE.LARGE, SCREEN_SIZE.XLARGE)
  if (screenWidth <= SCREEN_SIZE.XLARGE) {
    return 'LARGE';
  }

  // [SCREEN_SIZE.XLARGE, ∞)
  if (screenWidth > SCREEN_SIZE.XLARGE) {
    return 'XLARGE';
  }

  return 'NORMAL';
};

export const ContextDeviceScreenSize =
  createContext<IDeviceScreenSize>('NORMAL');
export const useProviderDeviceScreenSize = () =>
  useContext(ContextDeviceScreenSize);

export function useDeviceScreenSize() {
  return useProviderDeviceScreenSize();
}

export function getIsVerticalLayout() {
  const windowWidth = Dimensions.get('window').width;
  const size = getScreenSize(windowWidth);
  return size === 'SMALL';
}

export function useIsVerticalOrMiddleLayout() {
  const size = useDeviceScreenSize();
  return useMemo(() => ['SMALL', 'NORMAL'].includes(size), [size]);
}
