import type { IDotStyle } from './PaginationItem';
import type { IStackStyle, IXStackProps, IYStackProps } from '../../primitives';

export interface ICarouselInstance {
  prev: () => void;
  next: () => void;
  getCurrentIndex: () => number;
  scrollTo: ({ index }: { index: number }) => void;
}

export interface IPaginationItemProps<T> {
  data: T;
  dotStyle?: IDotStyle;
  activeDotStyle?: IDotStyle;
  onPress: () => void;
}

export interface ICarouselProps<T> {
  data?: T[];
  autoPlayInterval?: number;
  loop?: boolean;
  ref?: React.RefObject<ICarouselInstance>;
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactNode;
  containerStyle?: IXStackProps;
  paginationContainerStyle?: IStackStyle;
  activeDotStyle?: IYStackProps;
  dotStyle?: IYStackProps;
  marginRatio?: number;
  maxPageWidth?: number;
  onPageChanged?: (index: number) => void;
  renderPaginationItem?: (
    item: IPaginationItemProps<T>,
    index: number,
  ) => React.ReactNode;
}
