import { useCallback } from 'react';

import { useClipboard } from '@onekeyhq/components';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
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
      deriveInfo,
      deriveType,
    }: {
      accountId: string;
      networkId: string;
      deriveInfo: IAccountDeriveInfo;
      deriveType: IAccountDeriveTypes;
    }) => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      if (
        accountUtils.isHwAccount({ accountId }) ||
        accountUtils.isQrAccount({ accountId })
      ) {
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
        copyText(account.address);
      }
    },
    [appNavigation, copyText],
  );
};
