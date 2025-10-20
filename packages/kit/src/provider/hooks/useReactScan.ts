import { useEffect, useRef } from 'react';

import { noop } from 'lodash';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  initReactScan,
  scanAsync,
} from '@onekeyhq/shared/src/modules3rdParty/react-scan';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useReactScan =
  (platformEnv.isWeb || platformEnv.isDesktop) && platformEnv.isDev
    ? () => {
        const [devSettings] = useDevSettingsPersistAtom();
        const hasInitialized = useRef(false);

        useEffect(() => {
          const setupReactScan = async () => {
            // Initialize react-scan on first mount
            if (!hasInitialized.current) {
              await initReactScan();
              hasInitialized.current = true;
            }

            // Apply settings
            if (devSettings.settings?.enableReactScan) {
              const animationSpeed =
                devSettings.settings.reactScanAnimationSpeed;
              await scanAsync({
                enabled: true,
                showToolbar: devSettings.settings.reactScanShowToolbar ?? true,
                animationSpeed: (animationSpeed === 'fast' ||
                animationSpeed === 'slow' ||
                animationSpeed === 'off'
                  ? animationSpeed
                  : 'fast') as 'fast' | 'slow' | 'off',
                trackUnnecessaryRenders:
                  devSettings.settings.reactScanTrackUnnecessaryRenders ?? true,
              });
            } else {
              await scanAsync({ enabled: false });
            }
          };

          void setupReactScan();
        }, [
          devSettings.settings?.enableReactScan,
          devSettings.settings?.reactScanShowToolbar,
          devSettings.settings?.reactScanAnimationSpeed,
          devSettings.settings?.reactScanTrackUnnecessaryRenders,
        ]);
      }
    : noop;
