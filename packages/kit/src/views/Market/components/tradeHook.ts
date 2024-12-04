import { useCallback, useMemo, useRef, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Toast } from '@onekeyhq/components';
import {
  EModalStakingRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IFiatCryptoType } from '@onekeyhq/shared/types/fiatCrypto';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';
import {
  getImportFromToken,
  getNetworkIdBySymbol,
} from '@onekeyhq/shared/types/market/marketProvider.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export const useMarketTradeActions = (token: IMarketTokenDetail | null) => {
  const { detailPlatforms, image: logoURI, symbol = '', name } = token || {};
  const network = useMemo(
    () =>
      detailPlatforms
        ? detailPlatforms.ethereum ||
          detailPlatforms.solana ||
          detailPlatforms.base ||
          Object.values(detailPlatforms)[0]
        : null,
    [detailPlatforms],
  );

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const networkId = useMemo(() => {
    const { onekeyNetworkId } = network || {};
    return onekeyNetworkId ?? getNetworkIdBySymbol(symbol);
  }, [network, symbol]);

  const contractAddress = useMemo(
    () => network?.contract_address ?? '',
    [network],
  );

  const handleBuyOrSell = useCallback(
    async (type: IFiatCryptoType) => {
      if (!activeAccount.account || !networkId) {
        return;
      }

      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      const dbAccount =
        await backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId: activeAccount.account.indexedAccountId,
          networkId,
          deriveType,
        });
      const { url } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId,
          tokenAddress: contractAddress,
          accountId: dbAccount.id,
          type,
        });
      if (!url) {
        Toast.error({ title: 'Failed to get widget url' });
        return;
      }
      openUrlExternal(url);
    },
    [activeAccount.account, contractAddress, networkId],
  );

  const handleSwap = useCallback(async () => {
    if (!networkId) {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {},
      });
      return;
    }
    const { isSupportSwap } =
      await backgroundApiProxy.serviceSwap.checkSupportSwap({
        networkId,
        contractAddress,
      });
    const onekeyNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
      networkId,
    });
    const importFromTokenResponse = getImportFromToken({
      networkId,
      isSupportSwap,
      tokenSymbol: symbol,
      contractAddress,
    });
    const { importFromToken, swapTabSwitchType, isNative } =
      importFromTokenResponse || {};
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importToToken: {
          ...onekeyNetwork,
          contractAddress: isNative ? '' : contractAddress,
          networkId,
          networkLogoURI: onekeyNetwork.logoURI,
          symbol: symbol.toUpperCase(),
          name,
        },
        importFromToken,
        swapTabSwitchType,
      },
    });
  }, [contractAddress, name, navigation, networkId, symbol]);

  const handleStaking = useCallback(() => {
    if (networkId && activeAccount.account) {
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.AssetProtocolList,
        params: {
          networkId,
          accountId: activeAccount.account?.id,
          indexedAccountId: activeAccount.indexedAccount?.id,
          symbol,
        },
      });
    }
  }, [
    activeAccount.account,
    activeAccount.indexedAccount,
    navigation,
    networkId,
    symbol,
  ]);
  const canStaking = useMemo(() => isSupportStaking(symbol), [symbol]);

  return useMemo(
    () => ({
      onSwap: handleSwap,
      onStaking: handleStaking,
      onBuy: () => handleBuyOrSell('buy'),
      onSell: () => handleBuyOrSell('sell'),
      canStaking,
    }),
    [canStaking, handleBuyOrSell, handleStaking, handleSwap],
  );
};

export const useLazyMarketTradeActions = (coinGeckoId: string) => {
  const [token, setToken] = useState<null | IMarketTokenDetail>(null);
  const fetchMarketTokenDetail = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
        coinGeckoId,
      );
    setToken(response);
  }, [coinGeckoId]);

  const actions = useMarketTradeActions(token);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const compose = useCallback(
    async (actionName: 'onSwap' | 'onStaking' | 'onBuy' | 'onSell') => {
      if (!token) {
        await fetchMarketTokenDetail();
        await timerUtils.wait(50);
      }
      await actionsRef.current[actionName]();
    },
    [fetchMarketTokenDetail, token],
  );
  return useMemo(
    () => ({
      onSwap: () => compose('onSwap'),
      onStaking: () => compose('onStaking'),
      onBuy: () => compose('onBuy'),
      onSell: () => compose('onSell'),
    }),
    [compose],
  );
};
