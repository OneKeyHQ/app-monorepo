import { getDefaultHeaderHeight } from '@react-navigation/elements';
import { Platform, useWindowDimensions } from 'react-native';

import { useSafeAreaInsets } from '@onekeyhq/components';

/**
 * What react-navigation's native stack reports for a pushed screen before its
 * bar is measured — the same inputs NativeStackView uses.
 *
 * Pass it to useSettledHeaderHeight so the estimate can be recognized for what
 * it is. Without it that hook can only guess from whether a height has moved,
 * and a late native measurement is indistinguishable from an estimate that
 * never changed.
 *
 * Kept out of useSettledHeaderHeight itself: this pulls in react-navigation
 * and react-native, and that hook runs under jsdom tests.
 */
export function useNativeStackHeaderHeightEstimate(): number {
  const { width, height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const isIPhoneLandscape =
    Platform.OS === 'ios' && !Platform.isPad && width > height;
  return getDefaultHeaderHeight(
    { width, height },
    false,
    isIPhoneLandscape ? 0 : top,
  );
}
