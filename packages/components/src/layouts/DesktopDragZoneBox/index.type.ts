import type { StackProps } from '@onekeyhq/components/src/shared/tamagui';

export type IDesktopDragZoneAbsoluteBarProps = StackProps;

export type IDesktopDragZoneBoxProps = StackProps & {
  renderAs?: 'Pressable' | 'Stack';
};
