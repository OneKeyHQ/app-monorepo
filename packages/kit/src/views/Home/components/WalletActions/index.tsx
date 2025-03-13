import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp, IXStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IModalSendParamList,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';
import type { IToken } from '@onekeyhq/shared/types/token';

import { RawActions } from './RawActions';
import { WalletActionBuy } from './WalletActionBuy';
import { WalletActionMore } from './WalletActionMore';
import { WalletActionReceive } from './WalletActionReceive';

function WalletActionSend() {
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

  const handleOnSend = useCallback(async () => {
    if (!network) return;

    const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
      networkId: network.id,
      accountId: account?.id ?? '',
    });

    if (vaultSettings?.isSingleToken) {
      if (
        nativeToken &&
        deriveInfoItems.length > 1 &&
        !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
      ) {
        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxSelectDeriveAddress,
          params: {
            networkId: network.id,
            indexedAccountId: indexedAccount?.id ?? '',
            walletId: wallet?.id ?? '',
            actionType: EDeriveAddressActionType.Select,
            token: nativeToken,
            tokenMap: map,
            onUnmounted: () => {},
            onSelected: ({ account: a }: { account: INetworkAccount }) => {
              navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
                accountId: a.id,
                networkId: network.id,
                isNFT: false,
                token: nativeToken,
                isAllNetworks: network?.isAllNetworks,
              });
            },
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
        title: intl.formatMessage({ id: ETranslations.global_send }),
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
            const walletId = accountUtils.getWalletIdFromAccountId({
              accountId: token.accountId ?? '',
            });
            navigation.push(
              EModalSignatureConfirmRoutes.TxSelectDeriveAddress,
              {
                networkId: token.networkId ?? '',
                indexedAccountId: indexedAccount?.id ?? '',
                walletId,
                accountId: token.accountId ?? '',
                actionType: EDeriveAddressActionType.Select,
                token,
                tokenMap: map,
                onUnmounted: () => {},
                onSelected: ({ account: a }: { account: INetworkAccount }) => {
                  navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
                    accountId: a.id,
                    networkId: token.networkId ?? network.id,
                    isNFT: false,
                    token,
                    isAllNetworks: network?.isAllNetworks,
                  });
                },
              },
            );
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
    account,
    network,
    indexedAccount,
    vaultSettings?.isSingleToken,
    navigation,
    intl,
    allTokens.tokens,
    allTokens.keys,
    map,
    tokenListState,
    deriveInfoItems.length,
    wallet?.id,
  ]);

  return (
    <RawActions.Send
      onPress={handleOnSend}
      disabled={vaultSettings?.disabledSendAction}
      // label={`${account?.id || ''}`}
    />
  );
}

function WalletActionSwap({
  networkId,
  accountId,
}: {
  networkId?: string;
  accountId?: string;
}) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: networkId ?? '',
    });
    return settings;
  }, [networkId]).result;
  const handleOnSwap = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        importNetworkId: networkId,
      },
    });
  }, [navigation, networkId]);
  return (
    <RawActions.Swap
      onPress={handleOnSwap}
      label={intl.formatMessage({ id: ETranslations.global_trade })}
      disabled={
        vaultSettings?.disabledSwapAction ||
        accountUtils.isUrlAccountFn({ accountId })
      }
    />
  );
}

function WalletActions({ ...rest }: IXStackProps) {
  const {
    activeAccount: { network, account },
  } = useActiveAccount({ num: 0 });

  return (
    <RawActions {...rest}>
      <ReviewControl>
        <WalletActionBuy />
      </ReviewControl>
      <WalletActionSwap networkId={network?.id} accountId={account?.id} />
      <WalletActionSend />
      <WalletActionReceive />
      <WalletActionMore />
    </RawActions>
  );
}

export { WalletActions };
