import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp, IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import { RawActions } from './RawActions';
import { useWalletActionConfig } from './useWalletActionConfig';
import { WalletActionMore } from './WalletActionMore';
import { WalletActionPerp } from './WalletActionPerp';
import { WalletActionReceive } from './WalletActionReceive';
import { WalletActionStaking } from './WalletActionStaking';
import { WalletActionSwap } from './WalletActionSwap';

import type { IActionCustomization } from './types';

function WalletActionSend({
  customization,
}: {
  customization?: IActionCustomization;
}) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      deriveInfoItems,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });
  // const { selectedAccount } = useSelectedAccount({ num: 0 });
  const intl = useIntl();

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleOnSend = useCallback(async () => {
    if (!network) return;

    defaultLogger.wallet.walletActions.actionSend({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });

    if (vaultSettings?.isSingleToken) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network.id,
        accountId: account?.id ?? '',
      });
      if (
        nativeToken &&
        deriveInfoItems.length > 1 &&
        !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
      ) {
        let availableAccountId;
        try {
          const defaultDeriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: network.id,
              },
            );
          const { accounts } =
            await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
              {
                indexedAccountIds: [indexedAccount?.id ?? ''],
                networkId: network.id,
                deriveType: defaultDeriveType,
              },
            );
          availableAccountId = accounts?.[0]?.id;
        } catch (e) {
          const { networkAccounts } =
            await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                networkId: network.id,
                indexedAccountId: indexedAccount?.id ?? '',
                excludeEmptyAccount: true,
              },
            );
          availableAccountId = networkAccounts.find((item) => item.account)
            ?.account?.id;
        }

        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxDataInput,
          params: {
            accountId: availableAccountId ?? account?.id ?? '',
            networkId: network.id,
            isNFT: false,
            token: nativeToken,
          },
        });
      } else {
        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxDataInput,
          params: {
            accountId: account?.id ?? '',
            networkId: network.id,
            isNFT: false,
            token: nativeToken,
          },
        });
      }

      return;
    }

    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.TxSelectToken,
      params: {
        hideZeroBalanceTokens: true,
        keepDefaultZeroBalanceTokens: false,
        aggregateTokenSelectorScreen:
          EModalSignatureConfirmRoutes.TxSelectAggregateToken,
        title: intl.formatMessage({ id: ETranslations.global_select_crypto }),
        searchPlaceholder: intl.formatMessage({
          id: ETranslations.global_search_asset,
        }),
        networkId: network.id,
        accountId: account?.id ?? '',
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
        tokenListState,
        closeAfterSelect: false,
        onSelect: async (token: IToken) => {
          const settings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId ?? '',
            });

          if (
            settings.mergeDeriveAssetsEnabled &&
            network.isAllNetworks &&
            !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
          ) {
            const defaultDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: token.networkId ?? '',
                },
              );
            const { accounts } =
              await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
                {
                  indexedAccountIds: [indexedAccount?.id ?? ''],
                  networkId: token.networkId ?? '',
                  deriveType: defaultDeriveType,
                },
              );

            navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
              accountId: accounts?.[0]?.id ?? account?.id ?? '',
              networkId: token.networkId ?? network.id,
              isNFT: false,
              token,
              isAllNetworks: network?.isAllNetworks,
            });

            return;
          }

          navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
            accountId: token.accountId ?? account?.id ?? '',
            networkId: token.networkId ?? network.id,
            isNFT: false,
            token,
            isAllNetworks: network?.isAllNetworks,
          });
        },
      },
    });
  }, [
    network,
    wallet?.type,
    wallet?.id,
    account?.id,
    vaultSettings?.isSingleToken,
    navigation,
    intl,
    allTokens.tokens,
    allTokens.keys,
    map,
    tokenListState,
    deriveInfoItems.length,
    indexedAccount?.id,
    isSoftwareWalletOnlyUser,
  ]);

  return (
    <RawActions.Send
      onPress={customization?.onPress || handleOnSend}
      disabled={customization?.disabled ?? vaultSettings?.disabledSendAction}
      label={customization?.label}
      icon={customization?.icon}
      trackID="wallet-send"
    />
  );
}

function WalletActions({ ...rest }: IXStackProps) {
  const { config, getActionCustomization } = useWalletActionConfig();

  const renderActionComponent = (actionType: string) => {
    const customization = getActionCustomization(actionType as any);

    switch (actionType) {
      case 'send':
        return <WalletActionSend key="send" customization={customization} />;
      case 'receive':
        return (
          <WalletActionReceive
            key="receive"
            customization={customization}
            useSelector
          />
        );
      case 'swap':
        return platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel ? (
          <WalletActionPerp key="perp" customization={customization} />
        ) : (
          <WalletActionSwap key="swap" customization={customization} />
        );
      case 'perp':
        return <WalletActionPerp key="perp" customization={customization} />;
      case 'staking':
        return (
          <WalletActionStaking key="staking" customization={customization} />
        );
      default:
        return null;
    }
  };

  return (
    <RawActions {...rest}>
      {config.mainActions.map(renderActionComponent).filter(Boolean)}
      <WalletActionMore />
    </RawActions>
  );
}

export { WalletActions };
