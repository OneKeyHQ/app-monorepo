import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IBorrowToken } from '@onekeyhq/shared/types/staking';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

// Generic type for any asset with a token
export type IAssetWithToken = {
  token: IBorrowToken;
};

type IUseSupplyActionsParams = {
  accountId: string;
  walletId: string;
  networkId: string;
  indexedAccountId?: string;
};

export const useSupplyActions = ({
  accountId,
  walletId,
  networkId,
  indexedAccountId,
}: IUseSupplyActionsParams) => {
  const navigation = useAppNavigation();

  const handleSwap = useCallback(
    async (item: IAssetWithToken) => {
      if (!networkId || !accountId) {
        console.warn('Network ID or Account ID not defined');
        return;
      }

      const { token } = item;
      const isNative = !token.address || token.address === '';

      // Check if network supports swap
      const { isSupportSwap, isSupportCrossChain } =
        await backgroundApiProxy.serviceSwap.checkSupportSwap({
          networkId,
        });

      if (!isSupportSwap && !isSupportCrossChain) {
        console.warn('Swap not supported for this network');
        return;
      }

      // Get network details
      const onekeyNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      });

      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importFromToken: {
            ...onekeyNetwork,
            logoURI: isNative ? onekeyNetwork.logoURI : token.logoURI,
            contractAddress: token.address,
            networkId,
            isNative,
            networkLogoURI: onekeyNetwork.logoURI,
            symbol: token.symbol,
            name: token.name,
          },
          swapTabSwitchType: isSupportSwap
            ? ESwapTabSwitchType.SWAP
            : ESwapTabSwitchType.BRIDGE,
          swapSource: ESwapSource.MARKET,
        },
      });
    },
    [navigation, networkId, accountId],
  );

  const handleBridge = useCallback(
    async (item: IAssetWithToken) => {
      if (!networkId || !accountId) {
        console.warn('Network ID or Account ID not defined');
        return;
      }

      const { token } = item;
      const isNative = !token.address || token.address === '';

      // Check if network supports cross-chain
      const { isSupportCrossChain } =
        await backgroundApiProxy.serviceSwap.checkSupportSwap({
          networkId,
        });

      if (!isSupportCrossChain) {
        console.warn('Bridge not supported for this network');
        return;
      }

      // Get network details
      const onekeyNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      });

      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importFromToken: {
            ...onekeyNetwork,
            logoURI: isNative ? onekeyNetwork.logoURI : token.logoURI,
            contractAddress: token.address,
            networkId,
            isNative,
            networkLogoURI: onekeyNetwork.logoURI,
            symbol: token.symbol,
            name: token.name,
          },
          swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
          swapSource: ESwapSource.MARKET,
        },
      });
    },
    [navigation, networkId, accountId],
  );

  const handleReceive = useCallback(
    async (item: IAssetWithToken) => {
      if (!networkId || !accountId || !walletId) {
        console.warn('Network ID, Account ID, or Wallet ID not defined');
        return;
      }

      const { token } = item;

      // Get or create network account
      const networkAccount =
        await backgroundApiProxy.serviceAccount.createAddressIfNotExists(
          {
            walletId,
            networkId,
            accountId,
            indexedAccountId,
          },
          {
            allowWatchAccount: true,
          },
        );

      if (!networkAccount) {
        console.warn('Failed to get network account');
        return;
      }

      const receiveToken: IToken = {
        name: token.name,
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals,
        logoURI: token.logoURI,
        isNative: !token.address || token.address === '',
      };

      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId,
          accountId: networkAccount.id,
          walletId,
          token: receiveToken,
        },
      });
    },
    [navigation, networkId, accountId, walletId, indexedAccountId],
  );

  return {
    handleSwap,
    handleBridge,
    handleReceive,
  };
};
