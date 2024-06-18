import { useCallback, useMemo } from 'react';

import { useThrottledCallback } from 'use-debounce';

import { useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function useV4MigrationActions() {
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();

  const openV4MigrationOfExtension = useThrottledCallback(
    async () =>
      backgroundApiProxy.serviceApp.openExtensionExpandTab({
        routes: [
          ERootRoutes.Modal,
          EModalRoutes.OnboardingModal,
          EOnboardingPages.V4MigrationGetStarted,
        ],
        // params,
      }),
    1000,
    {
      leading: true,
      trailing: false,
    },
  );

  const navigateToV4MigrationPage = useCallback(
    async ({ isAutoStartOnMount }: { isAutoStartOnMount?: boolean } = {}) => {
      if (platformEnv.isExtensionUiPopup) {
        await openV4MigrationOfExtension();
        await timerUtils.wait(300);
        window.close();
        return;
      }
      // TODO navigation.pushFullModal
      navigation.navigate(ERootRoutes.Modal, {
        screen: EModalRoutes.OnboardingModal,
        params: {
          screen: EOnboardingPages.V4MigrationGetStarted,
          params: {
            isAutoStartOnMount,
          },
        },
      });
    },
    [navigation, openV4MigrationOfExtension],
  );

  const copyV4MigrationLogs = useCallback(async () => {
    const logs =
      await backgroundApiProxy.serviceV4Migration.getV4MigrationLogs();
    console.log('getV4MigrationLogs', logs);
    copyText(JSON.stringify(logs));
  }, [copyText]);
  return useMemo(
    () => ({
      navigateToV4MigrationPage,
      openV4MigrationOfExtension,
      copyV4MigrationLogs,
    }),
    [
      copyV4MigrationLogs,
      navigateToV4MigrationPage,
      openV4MigrationOfExtension,
    ],
  );
}
