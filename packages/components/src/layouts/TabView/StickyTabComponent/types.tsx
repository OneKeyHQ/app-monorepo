import type { ComponentType, ReactElement } from 'react';

import type { IStackProps } from '../../../primitives';
import type { IScrollViewProps } from '../../ScrollView';
import type { IHeaderProps } from '../Header';
import type { Animated } from 'react-native';

export type ITabPageProps = {
  showWalletActions?: boolean;
};

export type ITabPageType = ComponentType<ITabPageProps>;

export interface ITabProps extends IScrollViewProps {
  data: { title: string; page: ITabPageType }[];
  disableRefresh?: boolean;
  initialScrollIndex?: number;
  tabContentContainerStyle?: IStackProps;
  ListHeaderComponent?: ReactElement;
  headerProps?: Omit<IHeaderProps, 'data'>;
  contentItemWidth?: Animated.Value;
  contentWidth?: number;
  onSelectedPageIndex?: (pageIndex: number) => void;
  shouldSelectedPageIndex?: (pageIndex: number) => boolean;
  onRefresh?: () => void;
  initialHeaderHeight?: number;
}
