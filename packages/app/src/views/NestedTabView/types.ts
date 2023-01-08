import type { ForwardedRef, ReactNode } from 'react';

import { Dimensions } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

import type { FontProps } from '@onekeyhq/components/src/Typography';

import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export const getDrawerWidth = () => {
  const { width } = Dimensions.get('window');
  // must sync with drawer width
  return width * 0.85;
};

export const nestedTabStartX = makeMutable(0);

export const nestedTabTransX = makeMutable(getDrawerWidth());

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
}

export interface NestedTabViewProps extends NativeNestedTabViewProps {
  renderHeader?: () => ReactNode;
  gestureRef?: ForwardedRef<any>;
  canOpenDrawer?: boolean;
}
