import type { StackProps } from '@tamagui/web';

export type IDesktopDragZoneAbsoluteBarProps = StackProps;

export type IDesktopDragZoneBoxProps = StackProps & {
  renderAs?: 'Pressable' | 'Stack';
};
