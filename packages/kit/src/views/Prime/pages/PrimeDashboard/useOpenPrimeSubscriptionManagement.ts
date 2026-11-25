import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { APPLE_SUBSCRIPTION_MANAGEMENT_URL } from '@onekeyhq/shared/src/consts/primeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeManageSubscriptionEntryPoint } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IPrimeSubscriptionManagementTarget } from './primeSubscriptionManagementUtils';

export function useOpenPrimeSubscriptionManagement({
  managementTarget,
  entryPoint,
}: {
  managementTarget: IPrimeSubscriptionManagementTarget | undefined;
  entryPoint: IPrimeManageSubscriptionEntryPoint;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return useCallback(async () => {
    if (managementTarget?.type === 'infini') {
      defaultLogger.prime.subscription.primeManageSubscriptionClick({
        target: 'infiniPage',
        entryPoint,
      });
      navigation.push(EPrimePages.PrimeInfiniSubscription);
      return;
    }
    if (managementTarget?.type === 'external') {
      defaultLogger.prime.subscription.primeManageSubscriptionClick({
        target: 'externalUrl',
        entryPoint,
      });
      if (
        platformEnv.isDesktopMac &&
        managementTarget.url === APPLE_SUBSCRIPTION_MANAGEMENT_URL
      ) {
        try {
          const opened =
            await globalThis.desktopApiProxy?.system?.openAppStoreSubscriptions?.();
          if (opened) {
            return;
          }
        } catch {
          // Older shells reject unknown proxy methods. Fall back to Apple's
          // HTTPS entry point if the API or native handoff is unavailable.
        }
      }
      if (entryPoint === 'billingIssueAlert') {
        // The billing issue entry refreshes when the app comes back to the
        // foreground; the in-app browser closes without leaving the app.
        openUrlUtils.openUrlExternal(managementTarget.url, {
          useSystemBrowser: true,
        });
        return;
      }
      openUrlUtils.openUrlExternal(managementTarget.url);
      return;
    }
    defaultLogger.prime.subscription.primeManageSubscriptionClick({
      target: 'unresolved',
      entryPoint,
    });
    Toast.message({
      title: intl.formatMessage({
        id: ETranslations.prime_subscription_management_unsupported__msg,
      }),
    });
  }, [entryPoint, intl, managementTarget, navigation]);
}
