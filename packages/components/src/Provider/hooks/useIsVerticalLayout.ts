import { useMemo } from 'react';

import { Dimensions } from 'react-native';

import { getScreenSize } from '../device';

import useUserDevice from './useUserDevice';

export default function useIsVerticalLayout() {
  const { size } = useUserDevice();
  return size === 'SMALL';
}

export function getIsVerticalLayout() {
  const windowWidth = Dimensions.get('window').width;
  const size = getScreenSize(windowWidth);
  return size === 'SMALL';
}

export function useIsVerticalOrMiddleLayout() {
  const { size } = useUserDevice();
  return useMemo(() => ['SMALL', 'NORMAL'].includes(size), [size]);
}
