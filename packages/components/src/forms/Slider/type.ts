import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IFormFieldProps } from '../types';
import type { LayoutChangeEvent } from 'react-native';

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
  defaultValue?: number;
  onSlideStart?: () => void;
  onSlideMove?: (value: number) => void;
  onSlideEnd?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  segments?: number;
}

export type IBaseSliderProps = IFormFieldProps<number, IBaseGestureSliderProps>;
