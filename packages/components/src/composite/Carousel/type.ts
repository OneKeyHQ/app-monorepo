import type { IStackStyle, IXStackProps } from '../../primitives';

export interface ICarouselInstance {
  prev: () => void;
  next: () => void;
  getCurrentIndex: () => number;
  scrollTo: ({ index }: { index: number }) => void;
}

export interface ICarouselProps<T> {
  data?: T[];
  autoPlayInterval?: number;
  loop?: boolean;
  ref?: React.RefObject<ICarouselInstance>;
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactNode;
  containerStyle?: IXStackProps;
  paginationContainerStyle?: IStackStyle;
  activeDotStyle?: IStackStyle;
  dotStyle?: IStackStyle;
  onPageChanged?: (index: number) => void;
}
