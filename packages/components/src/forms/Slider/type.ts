import type { IFormFieldProps } from '../types';
import type { StackStyle } from '@tamagui/web/types/types';

type INonGestureStackStyleProps = Omit<
  StackStyle,
  | 'onPanStart'
  | 'onPanMove'
  | 'onPanEnd'
  | 'onHover'
  | 'hoverStyle'
  | 'pressStyle'
  | 'focusVisibleStyle'
  | 'onTouchStart'
  | 'onTouchMove'
  | 'onTouchEnd'
  | 'pointerEvents'
>;

interface IBaseGestureSliderProps extends INonGestureStackStyleProps {
  disabled?: boolean;
  min: number;
  max: number;
  step: number;
  onSlideStart?: () => void;
  onSlideMove?: (value: number) => void;
  onSlideEnd?: () => void;
}

export type IBaseSliderProps = IFormFieldProps<number, IBaseGestureSliderProps>;
