import { useMemo } from 'react';

import { Dimensions } from 'react-native';

import { getScreenSize } from '../device';

import useDeviceScreenSize from './useDeviceScreenSize';
import useProviderIsVerticalLayout from './useProviderIsVerticalLayout';

export default function useIsVerticalLayout() {
  return useProviderIsVerticalLayout();
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
