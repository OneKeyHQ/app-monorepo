import { Pressable } from 'react-native';

import { Stack } from '../../primitives';

import type {
  IDesktopDragZoneBoxProps,
} from './index.type';
import { useIsFocused } from '@react-navigation/native';

let lastTime: Date | undefined;
let num = 0;

const toggleMaxWindow = () => {
  const nowTime = new Date();
  if (
    lastTime === undefined ||
    Math.round(nowTime.getTime() - lastTime.getTime()) > 200
  ) {
    // reset
    lastTime = nowTime;
    num = 0;
  } else {
    num += 1;
  }
  if (num === 1) {
    void globalThis.desktopApiProxy.system.toggleMaximizeWindow();
  }
};

export function DesktopDragZoneBox({
  children,
  style,
  disabled,
  renderAs = 'Pressable',
  ...rest
}: IDesktopDragZoneBoxProps) {
  const Component = renderAs === 'Pressable' ? Pressable : Stack;
  const isPageFocus = useIsFocused();

  return (
    // @ts-expect-error - Component type varies based on renderAs prop
    <Component
      {...rest}
      onPress={toggleMaxWindow}
      disabled={disabled}
      style={
        [
          !disabled && {
            WebkitAppRegion: 'drag',
          },
          {
            userSelect: 'none',
            cursor: 'default',
            zIndex: isPageFocus ? 1 : -1,
          },
          style,
        ] as any
      }
    >
      {children}
    </Component>
  );
}

