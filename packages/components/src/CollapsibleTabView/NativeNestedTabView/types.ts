import type { ForwardedRef, ReactNode } from 'react';

import { Dimensions } from 'react-native';

import type { VariableVal } from '@tamagui/core';
import type {
  NativeSyntheticEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';

export const getDrawerWidth = () => {
  const { width } = Dimensions.get('window');
  const expectedWidth = width * 0.85;
  const maxWidth = 400;
  return Math.min(maxWidth, expectedWidth);
};

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

export type TabViewStyle = {
  // Recommendation passing, iOS not support
  height?: number;
  paddingX?: number;
  paddingY?: number;

  // background
  backgroundColor?: VariableVal;
  indicatorColor?: VariableVal;
  bottomLineColor?: VariableVal;

  // label
  tabSpaceEqual?: boolean;
  activeLabelColor?: VariableVal;
  labelColor?: VariableVal;
  itemPaddingX?: number;
  itemPaddingY?: number;
  labelStyle?: TextStyle;
};

export type TabProps = {
  name: string;
  label: string;
};

export interface NativeNestedTabViewProps {
  values: TabProps[];
  scrollEnabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tabViewStyle?: TabViewStyle;
  refresh?: boolean;
  disableRefresh?: boolean;
  spinnerColor?: VariableVal;
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
