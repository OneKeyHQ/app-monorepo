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
