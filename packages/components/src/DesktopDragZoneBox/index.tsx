import type { ComponentProps, ComponentPropsWithoutRef, FC } from 'react';
import { Fragment } from 'react';

import type Box from '../Box';
import type { Pressable } from 'react-native';

export const DesktopDragZoneAbsoluteBar = Fragment as FC<
  ComponentProps<typeof Box>
>;
export default Fragment as FC<ComponentPropsWithoutRef<typeof Pressable>>;
