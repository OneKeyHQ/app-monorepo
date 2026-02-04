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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IToken } from '@onekeyhq/shared/types/token';
import { useMedia } from '@onekeyhq/components';

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
        const path = '/bulk-send';

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
        navigation.switchTab(ETabRoutes.Home);
        await timerUtils.wait(50);
        navigation.push(ETabHomeRoutes.TabHomeBulkSendAddressesInput, {
          networkId,
          accountId,
          indexedAccountId,
          tokenInfo,
        });
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
