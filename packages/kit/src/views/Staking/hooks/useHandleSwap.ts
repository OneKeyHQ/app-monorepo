import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { getImportFromToken } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function useHandleSwap() {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleSwap = useCallback(
    async ({ token, networkId }: { token: IToken; networkId: string }) => {
      const { isSupportSwap } =
        await backgroundApiProxy.serviceSwap.checkSupportSwap({
          networkId,
        });
      const network = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      });
      const { importFromToken, swapTabSwitchType } = getImportFromToken({
        networkId,
        isSupportSwap,
        tokenAddress: token.address,
      });
      defaultLogger.wallet.walletActions.actionTrade({
        walletType: wallet?.type ?? '',
        networkId,
        source: 'earn',
        tradeType: ESwapTabSwitchType.SWAP,
        isSoftwareWalletOnlyUser,
      });
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importToToken: {
            ...token,
            contractAddress: token.address,
            networkId,
            networkLogoURI: network.logoURI,
          },
          importFromToken,
          swapTabSwitchType,
          swapSource: ESwapSource.EARN,
        },
      });
    },
    [navigation, wallet?.type, isSoftwareWalletOnlyUser],
  );

  return { handleSwap };
}
