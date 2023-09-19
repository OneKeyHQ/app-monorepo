import type { ReactElement, ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';
import type {
  OnPageScrollStateChangeEvent,
  TabProps,
} from 'src/CollapsibleTabView/NativeNestedTabView/types';

export interface CollapsibleContainerProps {
  stickyTabBar?: boolean;
  disableRefresh?: boolean;
  initialTabName?: string;
  headerView?: ReactNode;
  onRefresh?: () => void;
  onIndexChange?: (index: number) => void;
  onPageScrollStateChange?: (e: OnPageScrollStateChangeEvent) => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  canOpenDrawer?: boolean;
  children?: ReactElement<TabProps> | ReactElement<TabProps>[];
}
