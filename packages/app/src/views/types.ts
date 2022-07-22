import type { ReactNode } from 'react';

import { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

import { FontProps } from '@onekeyhq/components/src/Typography';

type TabViewProps = {
  height: number;
  paddingX?: number;
  paddingY?: number;

  backgroundColor: string;
  activeColor?: string;
  inactiveColor?: string;
  indicatorColor?: string;
  labelStyle?: FontProps;
};

export type TabProps = {
  name: string;
  label: string;
};

export interface PagingViewManagerProps {
  defaultIndex?: number;
  values: TabProps[];
  headerHeight?: number;
  scrollEnabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tabViewStyle?: TabViewProps;
  onChange?: (
    e: NativeSyntheticEvent<{ tabName: string; index: number | string }>,
  ) => void;
}
