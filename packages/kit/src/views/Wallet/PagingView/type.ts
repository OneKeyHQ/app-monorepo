import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  OnTabChangeCallback,
  TabBarProps,
} from '@onekeyhq/components/src/CollapsibleTabView';

export type TabItemProps = {
  name: string;
  label: string;
  view: React.ReactElement;
};

type TabName = string | number;
export type PageViewProps = {
  initialTabName?: TabName;

  items: TabItemProps[];
  renderHeader: () => React.ReactElement | null;
  renderTabBar?: (props: TabBarProps<TabName>) => React.ReactElement | null; // for web site
  // renderTabBar?: () => React.ReactElement | null; // for native
  onTabChange?: OnTabChangeCallback<string | number>;
  onIndexChange?: (index: number) => void;

  width?: number;
  headerHeight?: number;
  scrollEnabled: boolean;
  //   maxWidth?: number | string | undefined;

  containerStyle?: StyleProp<ViewStyle>;
  headerContainerStyle?: StyleProp<Animated.AnimateStyle<ViewStyle>>;
};

// type PageViewProps = Omit<Tabs.Container, 'renderItem'>;
