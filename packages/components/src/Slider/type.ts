import type { StackStyleProps } from '@tamagui/web/types/types';

type INonGestureStackStyleProps = Omit<
  StackStyleProps,
  | 'onPanStart'
  | 'onPanMove'
  | 'onPanEnd'
  | 'onHover'
  | 'hoverStyle'
  | 'pressStyle'
  | 'focusStyle'
  | 'onTouchStart'
  | 'onTouchMove'
  | 'onTouchEnd'
>;

export interface IBaseSliderProps extends INonGestureStackStyleProps {
  disabled?: boolean;
  value?: number;
  min: number;
  max: number;
  step: number;
  onChange?: (value: number) => void;
  onSlideStart?: () => void;
  onSlideMove?: (value: number) => void;
  onSlideEnd?: () => void;
}
