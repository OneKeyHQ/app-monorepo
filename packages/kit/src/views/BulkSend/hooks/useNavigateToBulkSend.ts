import { useCallback } from 'react';

import { rootNavigationRef, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalBulkSendRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IToken } from '@onekeyhq/shared/types/token';

export function useNavigateToBulkSend() {
  const navigation = useAppNavigation();
  const media = useMedia();

  const navigateToBulkSend = useCallback(
    async ({
      networkId,
      accountId,
      indexedAccountId,
      tokenInfo,
    }: {
      networkId: string | undefined;
      accountId: string | undefined;
      indexedAccountId: string | undefined;
      tokenInfo?: IToken;
    }) => {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        const path = '/bulk-send-addresses';

        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path,
          params: {
            networkId,
            accountId,
            indexedAccountId,
            tokenInfo,
          },
        });
      } else if (media.gtMd) {
        rootNavigationRef.current?.navigate(
          ERootRoutes.Main,
          {
            screen: ETabRoutes.Home,
            params: {
              screen: ETabHomeRoutes.TabHomeBulkSendAddressesInput,
              params: {
                networkId,
                accountId,
                indexedAccountId,
                tokenInfo,
              },
            },
          },
          {
            pop: true,
          },
        );
      } else {
        navigation.pushModal(EModalRoutes.BulkSendModal, {
          screen: EModalBulkSendRoutes.BulkSendAddressesInput,
          params: {
            networkId,
            accountId,
            indexedAccountId,
            tokenInfo,
            isInModal: true,
          },
        });
      }
    },
    [navigation, media.gtMd],
  );

  return navigateToBulkSend;
}
