import type { ForwardedRef, ReactNode } from 'react';

import { Dimensions } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

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

export type OnPageChangeEventData = Readonly<{
  tabName: string;
  index: number;
}>;
export type OnPageChangeEvent = NativeSyntheticEvent<OnPageChangeEventData>;

export type OnRefreshCallBackEventData = Readonly<{
  refresh: boolean;
}>;
export type OnRefreshCallBackEvent =
  NativeSyntheticEvent<OnRefreshCallBackEventData>;

export type PageScrollState = 'idle' | 'dragging' | 'settling';
export type OnPageScrollStateChangeEventData = Readonly<{
  state: PageScrollState;
}>;
export type OnPageScrollStateChangeEvent =
  NativeSyntheticEvent<OnPageScrollStateChangeEventData>;

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
  values: TabProps[];
  headerHeight?: number;
  scrollEnabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tabViewStyle?: TabViewStyle;
  refresh?: boolean;
  disableRefresh?: boolean;
  spinnerColor?: string;
  onRefreshCallBack?: (e: OnRefreshCallBackEvent) => void;
  onPageChange?: (e: OnPageChangeEvent) => void;
  onPageScrollStateChange?: (e: OnPageScrollStateChangeEvent) => void;

  // iOS only
  onPageVerticalScroll?: () => void;

  // Android only
  slideDisable?: boolean;
}

export interface NestedTabViewProps extends NativeNestedTabViewProps {
  headerView?: ReactNode;
  gestureRef?: ForwardedRef<any>;
  canOpenDrawer?: boolean;
}
