import type { FC, ReactNode } from 'react';
import { memo, useEffect } from 'react';

import {
  AuthenticationType,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';
import { useRouter } from 'expo-router';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AppLock } from '@onekeyhq/kit/src/components/AppLock';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { updateVersionAndBuildNumber } from '@onekeyhq/kit/src/store/reducers/settings';
import { setAuthenticationType } from '@onekeyhq/kit/src/store/reducers/status';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useHtmlPreloadSplashLogoRemove } from '../../hooks/useHtmlPreloadSplashLogoRemove';
import { useKeyboardManager } from '../../hooks/useKeyboardManager';
import {
  ModalRoutes,
  RootRoutes,
  UpdateFeatureModalRoutes,
} from '../routesEnum';

type RootStackNavigatorProps = {
  children: ReactNode;
};

export const RootStackNavigator: FC<RootStackNavigatorProps> = memo(
  ({ children }: RootStackNavigatorProps) => {
    const { version, buildNumber } = useSettings();
    const { dispatch } = backgroundApiProxy;

    const router = useRouter();

    const hasVersionSet = !!process.env.VERSION && !!process.env.BUILD_NUMBER;
    const versionChanged =
      process.env.VERSION !== version ||
      process.env.BUILD_NUMBER !== buildNumber;

    /**
     * previous version number is stored at user local redux store
     * new version number is passed by process.env.VERSION
     *
     * compare two version number, get the log diff and store new user version code here.
     */
    // settings.version -> process.env.VERSION
    useEffect(() => {
      if (hasVersionSet && versionChanged && process.env.VERSION) {
        const newVersion = process.env.VERSION;
        if (!platformEnv.isWeb) {
          appUpdates.getChangeLog(version, newVersion).then((changeLog) => {
            if (!changeLog) return; // no change log
            router.push({
              pathname: `${RootRoutes.Modal}/${ModalRoutes.UpdateFeature}/${UpdateFeatureModalRoutes.UpdateFeatureModal}`,
              params: {
                changeLog,
                newVersion,
              },
            });
          });
        }

        dispatch(
          updateVersionAndBuildNumber({
            version: newVersion,
            buildNumber: process.env.BUILD_NUMBER,
          }),
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, hasVersionSet, versionChanged]);

    useEffect(() => {
      if (platformEnv.isNative) {
        supportedAuthenticationTypesAsync().then((types) => {
          // OPPO phone return [1,2]
          // iphone 11 return [2]
          // The fingerprint identification is preferred (android)
          if (types.includes(AuthenticationType.FINGERPRINT)) {
            dispatch(setAuthenticationType('FINGERPRINT'));
          } else if (types.includes(AuthenticationType.FACIAL_RECOGNITION)) {
            dispatch(setAuthenticationType('FACIAL'));
          }
        });
      }
    }, [dispatch]);

    useHtmlPreloadSplashLogoRemove({ isDelay: true });

    // TODO: ExpoRouter: KeyboardManager
    useKeyboardManager();

    return <AppLock>{children}</AppLock>;
  },
);
RootStackNavigator.displayName = 'RootStackNavigator';
