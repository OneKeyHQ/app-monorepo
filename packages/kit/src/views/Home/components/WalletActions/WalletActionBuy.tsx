import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAllTokenListMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';

import { RawActions } from './RawActions';

export function WalletActionBuy() {
  const {
    activeAccount: {
      network,
      account,
      wallet,
      deriveInfoItems,
      vaultSettings,
      indexedAccount,
    },
  } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const { isSupported, handleFiatCrypto } = useFiatCrypto({
    networkId: network?.id ?? '',
    accountId: account?.id ?? '',
    fiatCryptoType: 'buy',
  });

  const [map] = useAllTokenListMapAtom();

  const isBuyDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isSupported) {
      return true;
    }

    return false;
  }, [isSupported, wallet?.type]);

  const handleBuyToken = useCallback(async () => {
    if (isBuyDisabled) return;

    if (vaultSettings?.isSingleToken) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
      });

      if (
        network &&
        wallet &&
        nativeToken &&
        deriveInfoItems.length > 1 &&
        vaultSettings?.mergeDeriveAssetsEnabled &&
        !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
      ) {
        navigation.pushModal(EModalRoutes.FiatCryptoModal, {
          screen: EModalFiatCryptoRoutes.DeriveTypesAddress,
          params: {
            networkId: network.id,
            indexedAccountId: indexedAccount?.id ?? '',
            actionType: EDeriveAddressActionType.Select,
            token: nativeToken,
            tokenMap: map,
            onUnmounted: () => {},
            onSelected: async ({
              account: a,
            }: {
              account: INetworkAccount;
            }) => {
              const { url } =
                await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
                  networkId: network?.id ?? '',
                  tokenAddress: nativeToken.address,
                  accountId: a.id,
                  type: 'buy',
                });
              openUrlExternal(url);
            },
          },
        });
        return;
      }
    }

    handleFiatCrypto();
  }, [
    isBuyDisabled,
    vaultSettings?.isSingleToken,
    vaultSettings?.mergeDeriveAssetsEnabled,
    handleFiatCrypto,
    network,
    account?.id,
    wallet,
    deriveInfoItems.length,
    navigation,
    indexedAccount?.id,
    map,
  ]);

  return <RawActions.Buy onPress={handleBuyToken} disabled={isBuyDisabled} />;
}
