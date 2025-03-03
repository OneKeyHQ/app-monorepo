import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useClipboard } from '@onekeyhq/components';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useFiatCrypto } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { useAllNetworkCopyAddressHandler } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useAllNetworkCopyAddressHandler';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
  EModalWalletAddressRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EDeriveAddressActionType } from '@onekeyhq/shared/types/address';

import { RawActions } from './RawActions';

export function WalletActionMore() {
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network, wallet, deriveInfo, deriveType, deriveInfoItems } =
    activeAccount;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();

  const { handleOnReceive } = useReceiveToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    tokens: {
      data: allTokens.tokens,
      keys: allTokens.keys,
      map,
    },
    tokenListState,
    isMultipleDerive: deriveInfoItems.length > 1,
  });

  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({ activeAccount });

  const { isSupported: isSellSupported, handleFiatCrypto: sellCrypto } =
    useFiatCrypto({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      fiatCryptoType: 'sell',
    });

  const isSellDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isSellSupported) {
      return true;
    }

    return false;
  }, [isSellSupported, wallet?.type]);

  const show = useReviewControl();

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;

  const handleCopyAddress = useCallback(() => {
    if (isAllNetworkEnabled) {
      void handleAllNetworkCopyAddress();
    } else if (wallet?.type === WALLET_TYPE_HW) {
      handleOnReceive();
    } else if (
      deriveInfoItems.length > 1 &&
      vaultSettings?.mergeDeriveAssetsEnabled &&
      !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
    ) {
      navigation.pushModal(EModalRoutes.WalletAddress, {
        screen: EModalWalletAddressRoutes.DeriveTypesAddress,
        params: {
          networkId: network?.id ?? '',
          indexedAccountId: account?.indexedAccountId ?? '',
          actionType: EDeriveAddressActionType.Copy,
        },
      });
    } else {
      copyText(account?.address || '');
    }
  }, [
    isAllNetworkEnabled,
    wallet?.type,
    wallet?.id,
    deriveInfoItems.length,
    vaultSettings?.mergeDeriveAssetsEnabled,
    handleAllNetworkCopyAddress,
    handleOnReceive,
    navigation,
    network?.id,
    account?.indexedAccountId,
    account?.address,
    copyText,
  ]);

  const handleSellToken = useCallback(async () => {
    if (vaultSettings?.isSingleToken) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
      });
      if (
        account &&
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
            indexedAccountId: account.indexedAccountId ?? '',
            accountId: account.id,
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
                  type: 'sell',
                });
              openUrlExternal(url);
              navigation.pop();
            },
          },
        });
        return;
      }
    }

    sellCrypto();
  }, [
    account,
    deriveInfoItems.length,
    map,
    navigation,
    network,
    sellCrypto,
    vaultSettings?.isSingleToken,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet,
  ]);

  const viewExplorerDisabled = usePromiseResult(async () => {
    if (!network?.isCustomNetwork) {
      return false;
    }
    if (network?.explorerURL) {
      return false;
    }
    return true;
  }, [network?.isCustomNetwork, network?.explorerURL]).result;

  const handleViewInExplorer = useCallback(async () => {
    if (vaultSettings?.isSingleToken) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
      });
      if (
        account &&
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
            indexedAccountId: account.indexedAccountId ?? '',
            accountId: account.id,
            actionType: EDeriveAddressActionType.Select,
            token: nativeToken,
            tokenMap: map,
            onUnmounted: () => {},
            onSelected: async ({
              account: a,
            }: {
              account: INetworkAccount;
            }) => {
              await openExplorerAddressUrl({
                networkId: network?.id,
                address: a?.address,
              });
              navigation.pop();
            },
          },
        });
        return;
      }
    }

    await openExplorerAddressUrl({
      networkId: network?.id,
      address: account?.address,
    });
  }, [
    account,
    deriveInfoItems.length,
    map,
    navigation,
    network,
    vaultSettings?.isSingleToken,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet,
  ]);

  const sections: ComponentProps<typeof RawActions.More>['sections'] = [];

  if (
    !vaultSettings?.copyAddressDisabled ||
    !vaultSettings?.hideBlockExplorer
  ) {
    sections.unshift({
      items: [
        ...(!vaultSettings?.hideBlockExplorer
          ? [
              {
                label: intl.formatMessage({
                  id: ETranslations.global_view_in_blockchain_explorer,
                }),
                icon: 'GlobusOutline',
                onPress: handleViewInExplorer,
                disabled: viewExplorerDisabled,
              },
            ]
          : ([] as any)),
        ...(!vaultSettings?.copyAddressDisabled
          ? [
              {
                label: intl.formatMessage({
                  id: ETranslations.global_copy_address,
                }),
                icon: 'Copy3Outline',
                onPress: handleCopyAddress,
              },
            ]
          : ([] as any)),
      ],
    });
  }

  if (show) {
    sections.unshift({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_cash_out }),
          icon: 'MinusLargeOutline',
          disabled: Boolean(isSellDisabled || !account?.id || !network?.id),
          onPress: handleSellToken,
        },
      ],
    });
  }

  if (devSettings?.settings?.showDevExportPrivateKey) {
    const exportAccountCredentialKey = async ({
      keyType,
    }: {
      keyType: ECoreApiExportedSecretKeyType;
    }) => {
      console.log('ExportSecretKeys >>>> ', keyType);
      let r: string | undefined = '';
      if (
        keyType === ECoreApiExportedSecretKeyType.xpub ||
        keyType === ECoreApiExportedSecretKeyType.publicKey
      ) {
        r = await backgroundApiProxy.serviceAccount.exportAccountPublicKey({
          accountId: account?.id || '',
          networkId: network?.id || '',
          keyType,
        });
      } else {
        r = await backgroundApiProxy.serviceAccount.exportAccountSecretKey({
          accountId: account?.id || '',
          networkId: network?.id || '',
          keyType,
        });
      }
      console.log('ExportSecretKeys >>>> ', r);
      console.log(
        'ExportSecretKeys >>>> ',
        wallet?.type,
        keyType,
        account?.address,
      );
      Dialog.show({
        title: 'Key',
        description: r,
        onConfirmText: 'Copy',
        onConfirm() {
          copyText(r || '');
        },
      });
    };
    sections.unshift({
      items: [
        {
          label: 'Export Public Key',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.publicKey,
            });
          },
        },
        {
          label: 'Export xpub',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.xpub,
            });
          },
        },
        {
          label: 'Export Private Key',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.privateKey,
            });
          },
        },
        {
          label: 'Export xprvt',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.xprvt,
            });
          },
        },
      ],
    });
  }

  return <RawActions.More sections={sections} />;
}
