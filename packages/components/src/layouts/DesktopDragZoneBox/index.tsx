import type { FC } from 'react';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

export const DesktopDragZoneBox: FC<IDesktopDragZoneBoxProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderAs,
  ...rest
}) => <Stack {...rest} />;

export * from './index.type';
