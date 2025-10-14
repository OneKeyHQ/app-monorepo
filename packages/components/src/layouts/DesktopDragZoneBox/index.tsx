import type { FC } from 'react';

import type { StackProps } from '@onekeyhq/components/src/shared/tamagui';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

export type IDesktopDragZoneAbsoluteBarProps = StackProps;
export const DesktopDragZoneAbsoluteBar: FC<
  IDesktopDragZoneAbsoluteBarProps
> = () => <Stack />;

export const DesktopDragZoneBox: FC<IDesktopDragZoneBoxProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderAs,
  ...rest
}) => <Stack {...rest} />;

export * from './index.type';
