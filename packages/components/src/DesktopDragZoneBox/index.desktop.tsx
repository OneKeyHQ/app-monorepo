import type { ComponentProps, ComponentPropsWithoutRef, FC } from 'react';

import { Pressable } from 'react-native';

import Box from '../Box';

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
    window.desktopApi.toggleMaximizeWindow();
  }
};

const DesktopDragZoneBox: FC<ComponentPropsWithoutRef<typeof Pressable>> = ({
  children,
  style,
  ...rest
}) => (
  <Pressable
    {...rest}
    onPress={toggleMaxWindow}
    style={[
      {
        // @ts-ignore
        WebkitAppRegion: 'drag',
        WebkitUserSelect: 'none',
        cursor: 'default',
      },
      // @ts-ignore
      style,
    ]}
  >
    {children}
  </Pressable>
);

export function DesktopDragZoneAbsoluteBar({
  w = '100%',
  h = 8,
  ...others
}: ComponentProps<typeof Box>) {
  // const highlightDragZone = platformEnv.isDev;
  const highlightDragZone = false;

  return (
    <Box
      position="absolute"
      zIndex={highlightDragZone ? 1 : -1}
      left={0}
      top={0}
      w={w}
      h={h}
      {...others}
    >
      <DesktopDragZoneBox
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: highlightDragZone ? 'rgba(0,0,0,0.3)' : undefined,
        }}
      />
    </Box>
  );
}

export default DesktopDragZoneBox;
