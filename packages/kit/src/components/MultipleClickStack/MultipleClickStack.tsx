import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { GestureResponderEvent } from 'react-native';

export function MultipleClickStack({
  children,
  onPress,
  showDevBgColor = false,
  triggerAt = 10,
  ...others
}: {
  showDevBgColor?: boolean;
  triggerAt?: number;
  onPress?: ((event: GestureResponderEvent) => void) | null | undefined;
  children?: ReactNode;
} & ComponentProps<typeof Stack>) {
  const [clickCount, setClickCount] = useState(0);

  return (
    <Stack
      bg={showDevBgColor && platformEnv.isDev ? '$bgCritical' : undefined}
      {...others}
      onPress={(event) => {
        if (clickCount > triggerAt) {
          onPress?.(event);
        }
        setClickCount((prev) => prev + 1);
      }}
    >
      {children}
    </Stack>
  );
}
