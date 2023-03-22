import type { ComponentProps, ComponentPropsWithoutRef, FC } from 'react';
import { Fragment } from 'react';

import type Box from '../Box';
import type { Pressable } from 'react-native';

export const DesktopDragZoneAbsoluteBar: FC<ComponentProps<typeof Box>> =
  __DEV__
    ? // @ts-ignore to stop the warning about Fragment under development
      ({ children }) => <>{children}</>
    : Fragment;
export default Fragment as FC<ComponentPropsWithoutRef<typeof Pressable>>;
