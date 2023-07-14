import type { ForwardedRef, ReactNode } from 'react';

import { Dimensions } from 'react-native';
import { makeMutable, withSpring } from 'react-native-reanimated';

import type { FontProps } from '@onekeyhq/components/src/Typography';

import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export const getDrawerWidth = () => {
  const { width } = Dimensions.get('window');
  const expectedWidth = width * 0.85;
  const maxWidth = 400;
  return Math.min(maxWidth, expectedWidth);
};

export const nestedTabStartX = makeMutable(0);

// to control drawer translation
export const nestedTabTransX = makeMutable(-getDrawerWidth());

export const resetNestedTabTransX = () => {
  nestedTabTransX.value = withSpring(-getDrawerWidth(), {
    velocity: 50,
    stiffness: 1000,
    damping: 500,
    mass: 3,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  });
};

type TabViewStyle = {
  height: number;
  paddingX?: number;
  paddingY?: number;

  backgroundColor?: string;
  activeColor?: string;
  inactiveColor?: string;
  indicatorColor?: string;
  bottomLineColor?: string;
  labelStyle?: FontProps;

  // label
  tabSpaceEqual?: boolean;
  activeLabelColor?: string;
  labelColor?: string;
};

export type TabProps = {
  name: string;
  label: string;
};

export interface NativeNestedTabViewProps {
  defaultIndex?: number;
  values: TabProps[];
  headerHeight?: number;
  scrollEnabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tabViewStyle?: TabViewStyle;
  refresh?: boolean;
  disableRefresh?: boolean;
  spinnerColor?: string;
  onRefreshCallBack?: (e: NativeSyntheticEvent<{ refresh: boolean }>) => void;
  onChange?: (
    e: NativeSyntheticEvent<{ tabName: string; index: number }>,
  ) => void;

  // Android only
  slideDisable?: boolean;
}

export interface NestedTabViewProps extends NativeNestedTabViewProps {
  renderHeader?: () => ReactNode;
  gestureRef?: ForwardedRef<any>;
  canOpenDrawer?: boolean;
}
