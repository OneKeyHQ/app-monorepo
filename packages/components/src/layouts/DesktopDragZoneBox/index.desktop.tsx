import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';

import type { IDesktopDragZoneBoxProps } from './index.type';

function BaseDesktopDragZoneBox({
  children,
  ...rest
}: IDesktopDragZoneBoxProps) {
  return (
    <Stack
      {...rest}
      style={{
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {children}
    </Stack>
  );
}

function DesktopDragZoneBoxMac({
  children,
  style,
  disabled,
  ...rest
}: IDesktopDragZoneBoxProps) {
  return disabled ? (
    <Stack key="true" {...rest}>
      {children}
    </Stack>
  ) : (
    <Stack
      key="false"
      {...rest}
      className="app-region-drag"
      style={{
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {children}
    </Stack>
  );
}

export const DesktopDragZoneBox = platformEnv.isDesktopWithCustomTitleBar
  ? DesktopDragZoneBoxMac
  : BaseDesktopDragZoneBox;
