import type { FC } from 'react';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

const dragZoneStyle = {
  userSelect: 'none',
  cursor: 'default',
} as const;

export const DesktopDragZoneBox: FC<IDesktopDragZoneBoxProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderAs,
  ...rest
}) => <Stack {...rest} style={dragZoneStyle} />;

export * from './index.type';
