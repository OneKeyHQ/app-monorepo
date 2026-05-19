import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp, IXStackProps } from '@onekeyhq/components';
import { Button, Dialog, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OptionCard,
  PaymentMethodBadges,
} from '@onekeyhq/kit/src/components/OptionCard';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalFiatCryptoRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openFiatCryptoUrl } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useSupportNetworkId } from '../../../FiatCrypto/hooks';
import { HomeTestIDs } from '../../testIDs';

import { RawActions } from './RawActions';
import { useWalletActionConfig } from './useWalletActionConfig';
import { WalletActionBuyMain } from './WalletActionBuyMain';
import { WalletActionMore } from './WalletActionMore';
import { WalletActionPerp } from './WalletActionPerp';
import { WalletActionReceive } from './WalletActionReceive';
import { WalletActionStaking } from './WalletActionStaking';
import { WalletActionSwap } from './WalletActionSwap';

import type { IActionCustomization } from './types';

function WalletActionSend({
  customization,
  showButtonStyle,
}: {
  customization?: IActionCustomization;
  showButtonStyle?: boolean;
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

  const { result: isBuySupported } = useSupportNetworkId('buy', network?.id);

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isBotWalletReceiveBlocked = shouldBlockBotWalletReceive({
    isBotWallet,
    isBotWalletDeactivated,
  });

  const handleOnSend = useCallback(async () => {
    if (!network) return;

    const sendFlowId = defaultLogger.transaction.send.startNewFlow();

    defaultLogger.wallet.walletActions.actionSend({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });

    // For multi-token networks, warn if native token balance is zero.
    // User won't be able to pay gas fees for any token transfer.
    if (
      vaultSettings &&
      !vaultSettings.isSingleToken &&
      !vaultSettings.allowZeroFee &&
      !network?.isAllNetworks
    ) {
      const nativeToken = allTokens.tokens.find(
        (t) => t.isNative && !t.networkId?.startsWith('onekeyall'),
      );
      const tokenFiat = nativeToken ? map[nativeToken.$key] : undefined;
      const balance = Number(tokenFiat?.balanceParsed ?? '0');
      if (nativeToken && balance <= 0) {
        const symbol = nativeToken.symbol ?? '';
        const logZeroGas = (
          action: 'shown' | 'receive' | 'buy' | 'continue',
        ) => {
          defaultLogger.wallet.walletActions.zeroNativeBalanceDialog({
            action,
            networkId: network.id,
            tokenSymbol: symbol,
            walletType: wallet?.type ?? '',
            sendFlowId,
          });
        };
        logZeroGas('shown');
        const confirmed = await new Promise<boolean>((resolve) => {
          let resolved = false;
          const safeResolve = (value: boolean) => {
            if (!resolved) {
              resolved = true;
              resolve(value);
            }
          };
          const dialogRef = Dialog.show({
            icon: 'GasOutline',
            title: intl.formatMessage(
              {
                id: ETranslations.insufficient_native_for_network_fees__msg,
              },
              { symbol },
            ),
            renderContent: (
              <YStack gap="$5">
                <OptionCard
                  icon="ArrowBottomOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_receive,
                  })}
                  subtitle={intl.formatMessage({
                    id: ETranslations.receive_from_another_wallet_desc,
                  })}
                  disabled={isBotWalletReceiveBlocked}
                  opacity={isBotWalletReceiveBlocked ? 0.5 : 1}
                  onPress={() => {
                    if (isBotWalletReceiveBlocked) {
                      Toast.error({
                        title: '该钱包已停用，无法接收资产',
                      });
                      return;
                    }
                    logZeroGas('receive');
                    safeResolve(false);
                    void dialogRef.close();
                    navigation.pushModal(EModalRoutes.ReceiveModal, {
                      screen: EModalReceiveRoutes.ReceiveSelector,
                    });
                  }}
                />
                {isBuySupported ? (
                  <OptionCard
                    icon="CurrencyDollarOutline"
                    title={intl.formatMessage({
                      id: ETranslations.global_buy,
                    })}
                    subtitle={<PaymentMethodBadges />}
                    onPress={async () => {
                      logZeroGas('buy');
                      safeResolve(false);
                      void dialogRef.close();
                      try {
                        const { url } =
                          await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl(
                            {
                              networkId: network.id,
                              tokenAddress: '',
                              accountId: account?.id ?? '',
                              type: 'buy',
                            },
                          );
                        if (url) {
                          openFiatCryptoUrl(url);
                        }
                      } catch {
                        navigation.pushModal(EModalRoutes.FiatCryptoModal, {
                          screen: EModalFiatCryptoRoutes.BuyModal,
                          params: {
                            networkId: network.id,
                            accountId: account?.id ?? '',
                            tokens: allTokens.tokens,
                            map,
                          },
                        });
                      }
                    }}
                  />
                ) : null}
                <Button
                  testID={HomeTestIDs.walletActionsZeroGasContinueBtn}
                  variant="tertiary"
                  size="large"
                  mx="$0"
                  py="$2"
                  onPress={() => {
                    logZeroGas('continue');
                    safeResolve(true);
                    void dialogRef.close();
                  }}
                >
                  {intl.formatMessage({
                    id: ETranslations.global_continue,
                  })}
                </Button>
              </YStack>
            ),
            showFooter: false,
            onClose: () => {
              safeResolve(false);
            },
          });
        });
        if (!confirmed) return;
      }
    }

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
        } catch (_e) {
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
        showDeFiTokenSwitch: true,
        aggregateTokenSelectorScreen:
          EModalSignatureConfirmRoutes.TxSelectAggregateToken,
        title: intl.formatMessage({ id: ETranslations.global_select_crypto }),
        searchPlaceholder: intl.formatMessage({
          id: ETranslations.global_search_asset,
        }),
        networkId: network.id,
        accountId: account?.id ?? '',
        isAllNetworks: network.isAllNetworks,
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
    vaultSettings,
    navigation,
    intl,
    allTokens.tokens,
    allTokens.keys,
    map,
    tokenListState,
    deriveInfoItems.length,
    indexedAccount?.id,
    isSoftwareWalletOnlyUser,
    isBuySupported,
    isBotWalletReceiveBlocked,
  ]);

  return (
    <RawActions.Send
      onPress={customization?.onPress || handleOnSend}
      disabled={customization?.disabled ?? vaultSettings?.disabledSendAction}
      label={
        customization?.labelId
          ? intl.formatMessage({ id: customization.labelId })
          : undefined
      }
      icon={customization?.icon}
      showButtonStyle={showButtonStyle}
      trackID="wallet-send"
      testID={HomeTestIDs.sendButton}
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
      case 'buy':
        return (
          <ReviewControl key="buy">
            <WalletActionBuyMain customization={customization} />
          </ReviewControl>
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
    <RawActions
      {...rest}
      justifyContent="flex-start"
      gap="$2.5"
      $gtSm={{
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: '$2.5',
      }}
    >
      {config.mainActions.map(renderActionComponent).filter(Boolean)}
      <WalletActionMore />
    </RawActions>
  );
}

export { WalletActions };
