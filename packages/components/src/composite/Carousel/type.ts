import type { IStackStyle, IXStackProps } from '../../primitives';
import type {
  ICarouselInstance,
  TCarouselProps,
} from 'react-native-reanimated-carousel';

export type ICarouselProps = Omit<
  TCarouselProps,
  'width' | 'height' | 'ref' | 'onProgressChange'
> & {
  containerStyle?: IXStackProps;
  ref?: React.RefObject<ICarouselInstance>;
  paginationContainerStyle?: IStackStyle;
  activeDotStyle?: IStackStyle;
  dotStyle?: IStackStyle;
};
