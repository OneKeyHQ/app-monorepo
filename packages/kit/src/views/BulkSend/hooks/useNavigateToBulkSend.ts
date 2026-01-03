import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalBulkSendRoutes,
  EModalRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IToken } from '@onekeyhq/shared/types/token';

export function useNavigateToBulkSend() {
  const navigation = useAppNavigation();

  const navigateToBulkSend = useCallback(
    async ({
      networkId,
      accountId,
      tokenInfo,
    }: {
      networkId: string | undefined;
      accountId: string | undefined;
      tokenInfo?: IToken;
    }) => {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        const path = '/bulk-send';

        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path,
          params: {
            networkId,
            accountId,
            tokenInfo,
          },
        });
      } else if (platformEnv.isNative) {
        navigation.pushModal(EModalRoutes.BulkSendModal, {
          screen: EModalBulkSendRoutes.BulkSendAddressesInput,
          params: {
            networkId,
            accountId,
            tokenInfo,
          },
        });
      } else {
        navigation.switchTab(ETabRoutes.Home, {
          screen: ETabHomeRoutes.TabHomeBulkSend,
          params: {
            networkId,
            accountId,
            tokenInfo,
          },
        });
      }
    },
    [navigation],
  );

  return navigateToBulkSend;
}
