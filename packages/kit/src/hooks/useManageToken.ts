import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

// import backgroundApiProxy from '../background/instance/backgroundApiProxy';

// import { usePromiseResult } from './usePromiseResult';

function useManageToken({
  accountId,
  networkId,
  walletId,
  isOthersWallet,
  indexedAccountId,
  deriveType,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
  isOthersWallet?: boolean;
  indexedAccountId?: string;
  deriveType: IAccountDeriveTypes | undefined;
}) {
  const navigation = useAppNavigation();

  // const { result: vaultSettings } = usePromiseResult(
  //   () =>
  //     backgroundApiProxy.serviceNetwork.getVaultSettings({
  //       networkId,
  //     }),
  //   [networkId],
  // );

  const handleOnManageToken = useCallback(() => {
    if (!deriveType) {
      throw new OneKeyLocalError('deriveType is required');
    }
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenManagerModal,
      params: {
        walletId,
        isOthersWallet,
        indexedAccountId,
        networkId,
        accountId,
        deriveType,
      },
    });
  }, [
    navigation,
    walletId,
    isOthersWallet,
    indexedAccountId,
    networkId,
    accountId,
    deriveType,
  ]);

  return {
    manageTokenEnabled: true,
    handleOnManageToken,
  };
}

export { useManageToken };
