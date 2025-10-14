import type { StackProps } from '../../shared/tamagui';

export type IDesktopDragZoneAbsoluteBarProps = StackProps;

export type IDesktopDragZoneBoxProps = StackProps & {
  renderAs?: 'Pressable' | 'Stack';
};
