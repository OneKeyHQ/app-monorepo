import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IAccountDeriveTypes,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

function useManageToken({
  accountId,
  networkId,
  walletId,
  isOthersWallet,
  indexedAccountId,
  deriveType,
  vaultSettings: syncVaultSettings,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
  isOthersWallet?: boolean;
  indexedAccountId?: string;
  deriveType: IAccountDeriveTypes | undefined;
  /**
   * Vault settings already resolved with the active account (the account
   * selector ships them in the same atom write as the account/network), so
   * `manageTokenEnabled` is correct on the FIRST render after a switch instead
   * of flipping false → true once the async lookup below lands (OK-63873: the
   * home tab-bar settings icon used to blink out on every switch).
   */
  vaultSettings?: IVaultSettings;
}) {
  const navigation = useAppNavigation();

  const { result: fetchedVaultSettings } = usePromiseResult<
    IVaultSettings | undefined
  >(
    async () => {
      if (!networkId) {
        return undefined;
      }

      return backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      });
    },
    [networkId],
    {
      undefinedResultIfError: true,
      undefinedResultIfReRun: true,
    },
  );

  // The sync value wins: it always belongs to the CURRENT account/network,
  // whereas the async result still holds the previous network's settings for
  // the first render after a switch (usePromiseResult only clears it in an
  // effect), which would flip the icon the wrong way for a frame.
  const vaultSettings = syncVaultSettings ?? fetchedVaultSettings;

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
    manageTokenEnabled:
      !!networkId && !!vaultSettings && !vaultSettings.isSingleToken,
    handleOnManageToken,
  };
}

export { useManageToken };
