import React, { ComponentPropsWithoutRef, FC } from 'react';

import { Pressable } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

let lastTime: Date | undefined;
let num = 0;

const DesktopDragZoneBox: FC<ComponentPropsWithoutRef<typeof Pressable>> = ({
  children,
  ...rest
}) => {
  const toggleMaxWindow = () => {
    const nowTime = new Date();
    if (
      lastTime === undefined ||
      Math.round(nowTime.getTime() - lastTime.getTime()) > 500
    ) {
      // reset
      lastTime = nowTime;
      num = 0;
    } else {
      num += 1;
    }
    if (num === 1) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (platformEnv.isDesktop) {
        window?.desktopApi?.toggleMaximizeWindow();
      }
    }
  };

  const { style = {} } = rest;
  return (
    <Pressable
      {...rest}
      onPress={toggleMaxWindow}
      style={{
        // @ts-expect-error
        WebkitAppRegion: 'drag',
        WebkitUserSelect: 'none',
        cursor: 'default',
        ...(typeof style === 'object' ? style : {}),
      }}
    >
      {children}
    </Pressable>
  );
};

export default DesktopDragZoneBox;
