import type { ComponentProps, ReactNode } from 'react';
import { useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { GestureResponderEvent } from 'react-native';

export function MultipleClickStack({
  children,
  onPress,
  showDevBgColor = false,
  triggerAt = platformEnv.isDev ? 3 : 10,
  debugComponent,
  devSettingsOnly = false,
  ...others
}: {
  showDevBgColor?: boolean;
  triggerAt?: number;
  onPress?: ((event: GestureResponderEvent) => void) | null | undefined;
  children?: ReactNode;
  debugComponent?: ReactNode;
  // Restrict the whole trigger to developer mode. Off by default so entries
  // that are meant to stay reachable for ordinary users (log upload on the
  // lock screen, web dapp mode switch) keep working. Turn it on for entries
  // that must not be discoverable by tapping around a production build:
  // onPress alone is NOT gated on devSettings, only debugComponent is.
  devSettingsOnly?: boolean;
} & ComponentProps<typeof Stack>) {
  // Counted in a ref, not in state: two presses landing in the same React
  // batch (RNW dispatching onPress and onClick, or consecutive presses in one
  // native event batch) would both read the same stale render value and the
  // count would advance once, making the entry unreachable on some platforms.
  const clickCountRef = useRef(0);
  const [debugComponentVisible, setDebugComponentVisible] = useState(false);
  const [devSettings] = useDevSettingsPersistAtom();
  const isTriggerAllowed = !devSettingsOnly || devSettings.enabled;

  return (
    <>
      <Stack
        // bg={undefined}
        bg={showDevBgColor && platformEnv.isDev ? '$bgCritical' : undefined}
        {...others}
        onPress={(event) => {
          clickCountRef.current += 1;
          // Fires on the configured click and on every click after it
          if (clickCountRef.current >= triggerAt && isTriggerAllowed) {
            onPress?.(event);
            if (debugComponent && devSettings.enabled) {
              setDebugComponentVisible(true);
            }
          }
        }}
      >
        {children}
      </Stack>
      {debugComponentVisible ? debugComponent : null}
    </>
  );
}
