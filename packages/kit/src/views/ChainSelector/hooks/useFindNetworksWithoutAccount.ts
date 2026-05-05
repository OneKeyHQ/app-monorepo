import { useCallback } from 'react';

import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IServerNetworkMatch } from '../types';

/**
 * Find enabled networks that don't have a corresponding account/address yet.
 * Shared between UnifiedNetworkSelector and AllNetworksManager.
 */
function useFindNetworksWithoutAccount() {
  const findNetworksWithoutAccount = useCallback(
    async ({
      accountId,
      indexedAccountId,
      enabledNetworks,
    }: {
      accountId: string;
      indexedAccountId: string | undefined;
      enabledNetworks: IServerNetworkMatch[];
    }) => {
      const { accountsInfo } =
        await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
          accountId,
          indexedAccountId,
          networkId: getNetworkIdsMap().onekeyall,
          deriveType: undefined,
          excludeTestNetwork: true,
        });

      const networkAccountMap: Record<string, IAllNetworkAccountInfo> = {};
      for (let i = 0; i < accountsInfo.length; i += 1) {
        const item = accountsInfo[i];
        const { networkId, deriveType, dbAccount } = item;
        if (dbAccount) {
          networkAccountMap[`${networkId}_${deriveType ?? ''}`] = item;
        }
      }

      const result: {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[] = [];

      for (let i = 0; i < enabledNetworks.length; i += 1) {
        const network = enabledNetworks[i];

        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network.id,
          });

        const networkAccount = networkAccountMap[`${network.id}_${deriveType}`];
        if (!networkAccount) {
          result.push({
            networkId: network.id,
            deriveType,
          });
        }
      }

      return result;
    },
    [],
  );

  return { findNetworksWithoutAccount };
}

export { useFindNetworksWithoutAccount };
