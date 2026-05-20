import { useEffect, useState } from 'react';

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

// Mirror the Android implementation: kit calls `setSplitViewLayoutDisabled`
// from <Container> at startup so non-dual-screen platforms (iPad) can also gate
// split-view-only width math behind the `enableSplitView` setting.
let splitViewLayoutDisabled = false;
const splitViewLayoutListeners = new Set<() => void>();

export function setSplitViewLayoutDisabled(disabled: boolean) {
  if (splitViewLayoutDisabled === disabled) return;
  splitViewLayoutDisabled = disabled;
  splitViewLayoutListeners.forEach((fn) => fn());
}

export const useIsSplitViewLayoutDisabled = () => {
  const [disabled, setDisabled] = useState(splitViewLayoutDisabled);
  useEffect(() => {
    const update = () => setDisabled(splitViewLayoutDisabled);
    splitViewLayoutListeners.add(update);
    return () => {
      splitViewLayoutListeners.delete(update);
    };
  }, []);
  return disabled;
};
