import { useCallback } from 'react';

import { useClipboard } from '@onekeyhq/components';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import useAppNavigation from './useAppNavigation';

export const useCopyAccountAddress = () => {
  const appNavigation = useAppNavigation();
  const { copyText } = useClipboard();
  return useCallback(
    async ({
      accountId,
      networkId,
      deriveType,
    }: {
      accountId: string;
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }) => {
      if (
        accountUtils.isHwAccount({ accountId }) ||
        accountUtils.isQrAccount({ accountId })
      ) {
        const deriveInfo =
          await backgroundApiProxy.serviceNetwork.getDeriveInfoOfNetwork({
            networkId,
            deriveType,
          });
        const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
        appNavigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveToken,
          params: {
            networkId,
            accountId,
            walletId,
            deriveInfo,
            deriveType,
          },
        });
      } else {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        copyText(account.address);
      }
    },
    [appNavigation, copyText],
  );
};
