import type { ReactNode } from 'react';

import { StyleProp, ViewStyle } from 'react-native';

export interface PagingViewManagerProps {
  defaultIndex?: number;
  headerHeight?: number;
  scrollEnabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}
