import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Pressable from '../Pressable';

let lastTime: Date | undefined;
let num = 0;

const DesktopDragZoneBox: FC<IBoxProps> = ({ ...props }) => {
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
      if (platformEnv.isDesktop) window?.desktopApi?.toggleMaximizeWindow();
    }
  };

  return (
    <Pressable
      {...props}
      onPress={toggleMaxWindow}
      style={{
        // @ts-expect-error
        WebkitAppRegion: 'drag',
        WebkitUserSelect: 'none',
        cursor: 'default',
      }}
    >
      {props.children}
    </Pressable>
  );
};

export default DesktopDragZoneBox;
