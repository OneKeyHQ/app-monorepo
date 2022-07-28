import type { ReactNode } from 'react';

import { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

import { FontProps } from '@onekeyhq/components/src/Typography';

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
  onChange?: (
    e: NativeSyntheticEvent<{ tabName: string; index: number | string }>,
  ) => void;
  onRefresh?: (e: NativeSyntheticEvent<{ refresh: boolean }>) => void;
}
