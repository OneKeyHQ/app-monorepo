import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IBorrowToken } from '@onekeyhq/shared/types/staking';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { ISwapConfig } from '../components/BorrowTableList';

// Generic type for any asset with a token
export type IAssetWithToken = {
  token: IBorrowToken;
};

type IUseSupplyActionsParams = {
  accountId: string;
  walletId: string;
  networkId: string;
  indexedAccountId?: string;
  swapConfig?: ISwapConfig;
};

// Build native token from network info (dynamically, not hardcoded)
function buildNativeSwapToken(network: IServerNetwork) {
  return {
    networkId: network.id,
    contractAddress: '',
    isNative: true,
    symbol: network.symbol,
    name: network.name,
    decimals: network.decimals,
    logoURI: network.logoURI,
    networkLogoURI: network.logoURI,
  };
}

// Build swap token from borrow token
function buildSwapToken(token: IBorrowToken, network: IServerNetwork) {
  const isNative = !token.address || token.address === '';
  return {
    networkId: network.id,
    contractAddress: token.address,
    isNative,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: isNative ? network.logoURI : token.logoURI,
    networkLogoURI: network.logoURI,
  };
}

// Get the default fromToken based on the selected token
// If the selected token is native (e.g., SOL), use the default toToken as fromToken
// to avoid native-to-native swap pairs (e.g., SOL to SOL)
function getDefaultFromToken(
  token: IBorrowToken,
  network: IServerNetwork,
): ReturnType<typeof buildNativeSwapToken> | ISwapToken {
  const isTokenNative = !token.address || token.address === '';

  if (isTokenNative) {
    // If the selected token is native, use the default toToken as fromToken
    const defaultConfig = swapDefaultSetTokens[network.id] as
      | { fromToken?: ISwapToken; toToken?: ISwapToken }
      | undefined;
    if (defaultConfig?.toToken) {
      return defaultConfig.toToken;
    }
  }

  // For non-native tokens or fallback, use native token as fromToken
  return buildNativeSwapToken(network);
}

// Get Ethereum ETH token from swap configuration for bridge
function getEthereumEthToken(): ISwapToken {
  const ethConfig = swapDefaultSetTokens['evm--1'] as {
    fromToken: ISwapToken;
    toToken?: ISwapToken;
  };
  return ethConfig.fromToken;
}

export const useSupplyActions = ({
  accountId,
  walletId,
  networkId,
  indexedAccountId,
  swapConfig,
}: IUseSupplyActionsParams) => {
  const navigation = useAppNavigation();

  // Use ref to cache the network to avoid redundant fetches within the same session
  const networkCacheRef = useRef<{
    networkId: string;
    network: IServerNetwork;
  } | null>(null);

  // Helper to get network with caching
  const getNetworkSafe = useCallback(
    async (targetNetworkId: string): Promise<IServerNetwork | null> => {
      if (!targetNetworkId) {
        return null;
      }

      // Return cached network if same networkId
      if (
        networkCacheRef.current?.networkId === targetNetworkId &&
        networkCacheRef.current?.network
      ) {
        return networkCacheRef.current.network;
      }

      try {
        const network = await backgroundApiProxy.serviceNetwork.getNetwork({
          networkId: targetNetworkId,
        });
        networkCacheRef.current = { networkId: targetNetworkId, network };
        return network;
      } catch (error) {
        console.error('Failed to get network:', error);
        return null;
      }
    },
    [],
  );

  const handleSwap = useCallback(
    async (item: IAssetWithToken) => {
      if (!networkId || !accountId) {
        console.warn('Network ID or Account ID not defined');
        return;
      }

      const { token } = item;

      try {
        // Use provided swapConfig or fetch if not available
        let supportSwap = swapConfig?.isSupportSwap;
        let supportCrossChain = swapConfig?.isSupportCrossChain;

        if (supportSwap === undefined || supportCrossChain === undefined) {
          const config = await backgroundApiProxy.serviceSwap.checkSupportSwap({
            networkId,
          });
          supportSwap = config.isSupportSwap;
          supportCrossChain = config.isSupportCrossChain;
        }

        if (!supportSwap && !supportCrossChain) {
          console.warn('Swap not supported for this network');
          return;
        }

        // Get network details with error handling
        const onekeyNetwork = await getNetworkSafe(networkId);
        if (!onekeyNetwork) {
          console.warn('Failed to get network details');
          return;
        }

        const fromToken = getDefaultFromToken(token, onekeyNetwork);

        navigation.pushModal(EModalRoutes.SwapModal, {
          screen: EModalSwapRoutes.SwapMainLand,
          params: {
            importFromToken: fromToken,
            importToToken: buildSwapToken(token, onekeyNetwork),
            swapTabSwitchType: supportSwap
              ? ESwapTabSwitchType.SWAP
              : ESwapTabSwitchType.BRIDGE,
            swapSource: ESwapSource.MARKET,
          },
        });
      } catch (error) {
        console.error('Error handling swap:', error);
      }
    },
    [navigation, networkId, accountId, swapConfig, getNetworkSafe],
  );

  const handleBridge = useCallback(
    async (item: IAssetWithToken) => {
      if (!networkId || !accountId) {
        console.warn('Network ID or Account ID not defined');
        return;
      }

      const { token } = item;

      try {
        // Use provided swapConfig or fetch if not available
        let supportCrossChain = swapConfig?.isSupportCrossChain;

        if (supportCrossChain === undefined) {
          const config = await backgroundApiProxy.serviceSwap.checkSupportSwap({
            networkId,
          });
          supportCrossChain = config.isSupportCrossChain;
        }

        if (!supportCrossChain) {
          console.warn('Bridge not supported for this network');
          return;
        }

        // Get network details with error handling
        const onekeyNetwork = await getNetworkSafe(networkId);
        if (!onekeyNetwork) {
          console.warn('Failed to get network details');
          return;
        }

        // For bridge, always use Ethereum ETH as fromToken
        const fromToken = getEthereumEthToken();

        navigation.pushModal(EModalRoutes.SwapModal, {
          screen: EModalSwapRoutes.SwapMainLand,
          params: {
            importFromToken: fromToken,
            importToToken: buildSwapToken(token, onekeyNetwork),
            swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
            swapSource: ESwapSource.MARKET,
          },
        });
      } catch (error) {
        console.error('Error handling bridge:', error);
      }
    },
    [navigation, networkId, accountId, swapConfig, getNetworkSafe],
  );

  const handleReceive = useCallback(
    async (item: IAssetWithToken) => {
      if (!networkId || !accountId || !walletId) {
        console.warn('Network ID, Account ID, or Wallet ID not defined');
        return;
      }

      const { token } = item;

      try {
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
      } catch (error) {
        console.error('Error handling receive:', error);
      }
    },
    [navigation, networkId, accountId, walletId, indexedAccountId],
  );

  return {
    handleSwap,
    handleBridge,
    handleReceive,
  };
};
