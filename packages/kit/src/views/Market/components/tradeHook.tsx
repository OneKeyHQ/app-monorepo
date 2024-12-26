import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Dialog, SizableText, Toast } from '@onekeyhq/components';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalStakingRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { isSupportStaking } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IFiatCryptoType } from '@onekeyhq/shared/types/fiatCrypto';
import type {
  IMarketDetailPlatformNetwork,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';
import { getNetworkIdBySymbol } from '@onekeyhq/shared/types/market/marketProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export const useMarketTradeNetwork = (token: IMarketTokenDetail | null) => {
  const { detailPlatforms, platforms = {} } = token || {};
  const network = useMemo(() => {
    if (detailPlatforms) {
      const values = Object.values(detailPlatforms);
      const nativePlatform = values.find((i) => i.isNative);
      if (nativePlatform) {
        return nativePlatform;
      }

      const tokenAddress = Object.values(platforms)[0];
      const tokenAddressPlatform = values.find(
        (i) => i.tokenAddress === tokenAddress,
      );
      return tokenAddressPlatform ?? values[0];
    }
  }, [detailPlatforms, platforms]);
  return network;
};

export const useMarketTradeNetworkId = (
  network: IMarketDetailPlatformNetwork | null | undefined,
  symbol: string,
) =>
  useMemo(() => {
    const { onekeyNetworkId } = network || {};
    return onekeyNetworkId ?? getNetworkIdBySymbol(symbol);
  }, [network, symbol]);

function BasicCreateAddressDialogContent({
  onCreate,
  networkId,
  indexedAccountId,
}: {
  onCreate: () => void;
  networkId: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { createAddress } = useAccountSelectorCreateAddress();
  const handleCreateAddress = useCallback(async () => {
    setIsLoading(true);
    try {
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      await createAddress({
        num: 0,
        account: {
          walletId: wallet?.id,
          networkId,
          indexedAccountId,
          deriveType: networkUtils.isBTCNetwork(networkId)
            ? 'BIP86'
            : deriveType,
        },
        selectAfterCreate: false,
      });
      onCreate();
    } finally {
      setIsLoading(false);
    }
  }, [networkId, createAddress, wallet?.id, indexedAccountId, onCreate]);
  return (
    <Button onPress={handleCreateAddress} loading={isLoading}>
      {intl.formatMessage({ id: ETranslations.global_create })}
    </Button>
  );
}
function CreateAddressDialogContent({
  onCreate,
  networkId,
  indexedAccountId,
}: {
  onCreate: () => void;
  networkId: string;
  indexedAccountId?: string;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BasicCreateAddressDialogContent
        onCreate={onCreate}
        networkId={networkId}
        indexedAccountId={indexedAccountId}
      />
    </AccountSelectorProviderMirror>
  );
}

export const useMarketTradeActions = (token: IMarketTokenDetail | null) => {
  const { symbol = '', name } = token || {};
  const intl = useIntl();
  const network = useMarketTradeNetwork(token);
  const networkId = useMarketTradeNetworkId(network, symbol);

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const { activeAccount } = useActiveAccount({ num: 0 });

  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    linkNetwork: true,
  });

  const contractAddress = useMemo(
    () => network?.contract_address ?? '',
    [network],
  );

  const { isNative = false, tokenAddress: realContractAddress = '' } =
    network || {};

  const remindUnsupportedToken = useCallback(
    (action: 'buy' | 'sell' | 'trade', showDialog = true) => {
      defaultLogger.market.token.unsupportedToken({ name: symbol, action });
      if (showDialog) {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.earn_unsupported_token,
          }),
          tone: 'warning',
          icon: 'ErrorOutline',
          renderContent: (
            <SizableText size="$bodyLg">
              {intl.formatMessage({
                id: ETranslations.earn_unsupported_token_desc,
              })}
            </SizableText>
          ),
          onConfirmText: intl.formatMessage({
            id: ETranslations.explore_got_it,
          }),
        });
      }
    },
    [intl, symbol],
  );

  const showSwitchAccountSelector = useCallback(() => {
    Dialog.confirm({
      icon: 'ErrorOutline',
      tone: 'warning',
      title: intl.formatMessage(
        {
          id: ETranslations.wallet_unsupported_network_title,
        },
        {
          network: symbol.toUpperCase(),
        },
      ),
      description: intl.formatMessage({
        id: ETranslations.global_switch_supported_accounts_wallets,
      }),
      onConfirm: showAccountSelector,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_switch,
      }),
    });
  }, [intl, showAccountSelector, symbol]);

  const createAccountIfNotExists = useCallback(async () => {
    if (!networkId) {
      throw new Error(`cannot find NetworkId ${networkId || ''}`);
    }
    try {
      if (
        accountUtils.isWatchingAccount({
          accountId: activeAccount.account?.id ?? '',
        })
      ) {
        showSwitchAccountSelector();
        return undefined;
      }
      if (activeAccount.account?.indexedAccountId) {
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        await backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId: activeAccount.account?.indexedAccountId,
          networkId,
          deriveType,
        });
      } else if (
        activeAccount.network?.id &&
        activeAccount.network?.id !== networkId
      ) {
        showSwitchAccountSelector();
        return undefined;
      }
    } catch (error) {
      const isCreated = await new Promise<boolean>((resolve) => {
        const dialog = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.wallet_no_address,
          }),
          icon: 'WalletCryptoOutline',
          description: intl.formatMessage(
            {
              id: ETranslations.global_private_key_error,
            },
            {
              network: symbol.toUpperCase(),
              path: networkUtils.isBTCNetwork(networkId) ? '(Taproot)' : '',
            },
          ),
          showFooter: false,
          onClose: (extra) => {
            if (extra?.flag !== 'created') {
              resolve(false);
            }
          },
          renderContent: (
            <CreateAddressDialogContent
              onCreate={async () => {
                resolve(true);
                await dialog.close({ flag: 'created' });
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.swap_page_toast_address_generated,
                  }),
                });
              }}
              networkId={networkId}
              indexedAccountId={activeAccount.account?.indexedAccountId}
            />
          ),
        });
      });
      if (!isCreated) {
        return undefined;
      }
    }

    return {
      activeAccount,
      networkId,
    };
  }, [activeAccount, intl, networkId, showSwitchAccountSelector, symbol]);

  const handleBuyOrSell = useCallback(
    async (type: IFiatCryptoType) => {
      const checkResult = await createAccountIfNotExists();
      if (!checkResult) {
        return;
      }
      const { activeAccount: currentAccount, networkId: currentNetworkId } =
        checkResult;

      if (!currentNetworkId) {
        return;
      }

      const isSupported =
        await backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
          networkId: currentNetworkId,
          tokenAddress: realContractAddress,
          type,
        });

      if (!isSupported) {
        remindUnsupportedToken(type);
        return;
      }

      const { url, build } =
        await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
          networkId: currentNetworkId,
          tokenAddress: realContractAddress,
          accountId: currentAccount.dbAccount?.id,
          type,
        });
      if (!url || !build) {
        remindUnsupportedToken(type);
        return;
      }
      openUrlExternal(url);
    },
    [createAccountIfNotExists, realContractAddress, remindUnsupportedToken],
  );

  const handleSwap = useCallback(
    async (mode?: 'modal' | 'button') => {
      const checkResult = await createAccountIfNotExists();
      if (!checkResult) {
        return;
      }
      const { networkId: currentNetworkId } = checkResult;
      if (!currentNetworkId) {
        return;
      }
      const navigateToSwapPage = (
        params: IModalSwapParamList[EModalSwapRoutes.SwapMainLand],
      ) => {
        if (mode === 'modal') {
          navigation.replace(EModalSwapRoutes.SwapMainLand, params);
        } else {
          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.SwapMainLand,
            params,
          });
        }
      };
      if (!currentNetworkId) {
        remindUnsupportedToken('trade', false);
        navigateToSwapPage({
          importNetworkId: 'unknown',
        });
        return;
      }
      const { isSupportSwap, isSupportCrossChain } =
        await backgroundApiProxy.serviceSwap.checkSupportSwap({
          networkId: currentNetworkId,
          contractAddress: isNative ? realContractAddress : contractAddress,
        });

      if (!isSupportSwap && !isSupportCrossChain) {
        remindUnsupportedToken('trade', false);
        navigateToSwapPage({
          importNetworkId: currentNetworkId,
        });
        return;
      }
      const onekeyNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: currentNetworkId,
      });
      navigateToSwapPage({
        importFromToken: {
          ...onekeyNetwork,
          logoURI: isNative ? onekeyNetwork.logoURI : undefined,
          contractAddress: realContractAddress,
          networkId: currentNetworkId,
          isNative,
          networkLogoURI: onekeyNetwork.logoURI,
          symbol: symbol.toUpperCase(),
          name,
        },
        swapTabSwitchType: isSupportSwap
          ? ESwapTabSwitchType.SWAP
          : ESwapTabSwitchType.BRIDGE,
      });
    },
    [
      contractAddress,
      createAccountIfNotExists,
      isNative,
      name,
      navigation,
      realContractAddress,
      remindUnsupportedToken,
      symbol,
    ],
  );

  const handleStaking = useCallback(async () => {
    const checkResult = await createAccountIfNotExists();
    if (!checkResult) {
      return;
    }
    const { activeAccount: currentAccount, networkId: currentNetworkId } =
      checkResult;
    if (currentNetworkId && currentAccount.account) {
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.AssetProtocolList,
        params: {
          networkId: currentNetworkId,
          accountId: currentAccount.account?.id,
          indexedAccountId: currentAccount.indexedAccount?.id,
          symbol,
        },
      });
    }
  }, [createAccountIfNotExists, navigation, symbol]);
  const canStaking = useMemo(() => isSupportStaking(symbol), [symbol]);

  return useMemo(
    () => ({
      onSwap: handleSwap,
      onStaking: handleStaking,
      onBuy: () => handleBuyOrSell('buy'),
      onSell: () => handleBuyOrSell('sell'),
      createAccountIfNotExists,
      canStaking,
    }),
    [
      canStaking,
      createAccountIfNotExists,
      handleBuyOrSell,
      handleStaking,
      handleSwap,
    ],
  );
};

type IActionName = 'onSwap' | 'onStaking' | 'onBuy' | 'onSell';
export const useLazyMarketTradeActions = (coinGeckoId: string) => {
  const [token, setToken] = useState<null | IMarketTokenDetail>(null);
  const fetchMarketTokenDetail = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
        coinGeckoId,
      );
    setToken(response);
    return response;
  }, [coinGeckoId]);

  const actions = useMarketTradeActions(token);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const compose = useCallback(
    async (actionName: IActionName) => {
      await fetchMarketTokenDetail();
      // wait for token detail loaded and actionsRef updated
      await timerUtils.wait(80);
      const result = await actionsRef.current.createAccountIfNotExists();
      if (!result) {
        if (actionName === 'onSwap') {
          navigation.pop();
        }
        return;
      }
      await actionsRef.current[actionName]('modal');
    },
    [fetchMarketTokenDetail, navigation],
  );

  const handleSwapLazyModal = useCallback(async () => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapLazyMarketModal,
      params: {
        coinGeckoId,
      },
    });
  }, [coinGeckoId, navigation]);

  return useMemo(
    () => ({
      onSwap: () => compose('onSwap'),
      onSwapLazyModal: handleSwapLazyModal,
      onStaking: () => compose('onStaking'),
      onBuy: () => compose('onBuy'),
      onSell: () => compose('onSell'),
    }),
    [compose, handleSwapLazyModal],
  );
};
