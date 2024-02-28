import type { IFormFieldProps } from '../types';
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
