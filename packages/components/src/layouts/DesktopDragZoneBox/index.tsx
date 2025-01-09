import type { FC } from 'react';

import { Stack } from '../../primitives';

import type { StackProps } from 'tamagui';

export type IDesktopDragZoneAbsoluteBarProps = StackProps;
export const DesktopDragZoneAbsoluteBar: FC<
  IDesktopDragZoneAbsoluteBarProps
> = () => <Stack />;

export type IDesktopDragZoneBoxProps = StackProps;

export const DesktopDragZoneBox: FC<IDesktopDragZoneBoxProps> = ({
  ...rest
}) => <Stack {...rest} />;

export * from './index.type';
