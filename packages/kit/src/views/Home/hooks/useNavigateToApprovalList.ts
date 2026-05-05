import { useCallback } from 'react';

import { rootNavigationRef, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';

export function useNavigateToApprovalList() {
  const navigation = useAppNavigation();
  const media = useMedia();

  const navigateToApprovalList = useCallback(
    async ({
      networkId,
      accountId,
      walletId,
      indexedAccountId,
    }: {
      networkId: string | undefined;
      accountId: string | undefined;
      walletId: string | undefined;
      indexedAccountId: string | undefined;
    }) => {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        const path = '/approval-list';

        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path,
          params: {
            networkId,
            accountId,
            walletId,
            indexedAccountId,
          },
        });
      } else if (media.gtMd) {
        rootNavigationRef.current?.navigate(
          ERootRoutes.Main,
          {
            screen: ETabRoutes.Home,
            params: {
              screen: ETabHomeRoutes.TabHomeApprovalList,
              params: {
                networkId,
                accountId,
                walletId,
                indexedAccountId,
              },
            },
          },
          {
            pop: true,
          },
        );
      } else {
        navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
          screen: EModalApprovalManagementRoutes.ApprovalList,
          params: {
            networkId: networkId ?? '',
            accountId: accountId ?? '',
            walletId: walletId ?? '',
            indexedAccountId,
          },
        });
      }
    },
    [navigation, media.gtMd],
  );

  return navigateToApprovalList;
}
