import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalWalletAddressRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EWalletAddressActionType } from '@onekeyhq/shared/types/address';

import { openExplorerAddressUrl } from '../utils/explorerUtils';

import useAppNavigation from './useAppNavigation';

export const useBlockExplorerNavigation = (
  network: IServerNetwork | undefined,
  walletId: string | undefined,
) => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const requiresNetworkSelection = useMemo(
    () =>
      network?.isAllNetworks &&
      !accountUtils.isOthersWallet({ walletId: walletId ?? '' }),
    [network?.isAllNetworks, walletId],
  );

  const openExplorer = useCallback(
    async ({
      accountId,
      indexedAccountId,
      networkId,
      address,
    }: {
      accountId?: string;
      indexedAccountId?: string;
      networkId?: string;
      address?: string;
    }) => {
      if (requiresNetworkSelection) {
        appNavigation.pushModal(EModalRoutes.WalletAddress, {
          screen: EModalWalletAddressRoutes.WalletAddress,
          params: {
            title: intl.formatMessage({
              id: ETranslations.global_select_network,
            }),
            accountId,
            walletId: walletId ?? '',
            indexedAccountId: indexedAccountId ?? '',
            actionType: EWalletAddressActionType.ViewInExplorer,
          },
        });
      } else {
        await openExplorerAddressUrl({
          networkId,
          address,
        });
      }
    },
    [requiresNetworkSelection, appNavigation, intl, walletId],
  );

  return {
    requiresNetworkSelection,
    openExplorer,
  };
};
