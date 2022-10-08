import { ComponentProps, ComponentPropsWithoutRef, FC, Fragment } from 'react';

import { Pressable } from 'react-native';

import Box from '../Box';

export const DesktopDragZoneAbsoluteBar = Fragment as FC<
  ComponentProps<typeof Box>
>;
export default Fragment as FC<ComponentPropsWithoutRef<typeof Pressable>>;
