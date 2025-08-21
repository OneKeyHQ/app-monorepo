import type { IDotStyle } from './PaginationItem';
import type { IStackStyle, IXStackProps, IYStackProps } from '../../primitives';
import type { PagerViewProps } from 'react-native-pager-view';

export interface ICarouselInstance {
  prev: () => void;
  next: () => void;
  getCurrentIndex: () => number;
  scrollTo: ({ index }: { index: number }) => void;
  setScrollEnabled: (scrollEnabled: boolean) => void;
}

export interface IPaginationItemProps<T> {
  data: T;
  dotStyle?: IDotStyle;
  activeDotStyle?: IDotStyle;
  onPress: () => void;
}

export interface ICarouselProps<T> {
  pageWidth?: number | string;
  data?: T[];
  autoPlayInterval?: number;
  loop?: boolean;
  ref?: React.RefObject<ICarouselInstance | null>;
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactNode;
  containerStyle?: IXStackProps;
  showPagination?: boolean;
  paginationContainerStyle?: IStackStyle;
  activeDotStyle?: IYStackProps;
  dotStyle?: IYStackProps;
  marginRatio?: number;
  maxPageWidth?: number;
  onPageChanged?: (index: number) => void;
  /**
   * @description Default index to show initially (0-based)
   * @default 0
   */
  defaultIndex?: number;
  renderPaginationItem?: (
    item: IPaginationItemProps<T>,
    index: number,
  ) => React.ReactNode;
  /**
   * @description Disable animation for page transitions
   */
  disableAnimation?: boolean;
  /**
   * @platform native
   * @description Props for the PagerView component
   */
  pagerProps?: PagerViewProps & {
    /**
     * @platform android
     * @description Sensitivity for scroll gestures to resolve conflicts between horizontal swipe gestures and long list scrolling
     */
    scrollSensitivity?: number;
  };
}
