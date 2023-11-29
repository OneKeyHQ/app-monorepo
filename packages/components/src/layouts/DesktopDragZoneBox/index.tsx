import type { ComponentProps, FC } from 'react';

import { Stack } from '../../primitives';

export const DesktopDragZoneAbsoluteBar: FC<
  ComponentProps<typeof Stack>
> = () => <Stack />;

export const DesktopDragZoneBox: FC<ComponentProps<typeof Stack>> = ({
  ...rest
}) => <Stack {...rest} />;
