import { Dimensions } from 'react-native';

export const isDualScreenDevice = () => {
  return false;
};

export const isRawSpanning = () => {
  return false;
};

export const isSpanning = () => {
  return isRawSpanning();
};

export const useIsSpanningInDualScreen = () => {
  return false;
};

export const useDualScreenWidth = () => {
  return Dimensions.get('window').width;
};

export function setSplitViewLayoutDisabled(_disabled: boolean) {
  // no-op outside Android dual-screen devices
}
