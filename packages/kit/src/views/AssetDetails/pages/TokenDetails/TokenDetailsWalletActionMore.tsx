import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  Divider,
  Toast,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { useSupportToken } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IToken } from '@onekeyhq/shared/types/token';

interface ITokenDetailsWalletActionMoreProps {
  accountId: string;
  networkId: string;
  walletId: string;
  walletType: string | undefined;
  tokenInfo: IToken;
  isTabView?: boolean;
  onSwap: () => void;
  onBridge: () => void;
}

export function TokenDetailsWalletActionMore({
  accountId,
  networkId,
  walletId,
  walletType,
  tokenInfo,
  isTabView,
  onSwap,
  onBridge,
}: ITokenDetailsWalletActionMoreProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const { isFocused } = useTabIsRefreshingFocused();

  const disableSwapAction = accountUtils.isUrlAccountFn({ accountId });

  // Earn logic (from WalletActionEarn)
  const { result: earnResult } = usePromiseResult(async () => {
    const symbolInfo =
      await backgroundApiProxy.serviceStaking.findSymbolByTokenAddress({
        networkId,
        tokenAddress: tokenInfo.address,
      });
    if (!symbolInfo) {
      return undefined;
    }
    const protocolList =
      await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol: symbolInfo?.symbol,
        filterNetworkId: networkId,
      });
    if (!Array.isArray(protocolList) || !protocolList.length) {
      return undefined;
    }
    const blockData = await backgroundApiProxy.serviceStaking.getBlockRegion();
    return { symbolInfo, protocolList, blockData };
  }, [networkId, tokenInfo.address]);

  // Sell logic (from ActionBase)
  const { result: isSellSupported } = useSupportToken(
    networkId,
    tokenInfo.address,
    'sell',
    isTabView ? isFocused : true,
  );

  const isSellDisabled = useMemo(() => {
    if (walletType === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }
    if (!isSellSupported) {
      return true;
    }
    return false;
  }, [isSellSupported, walletType]);

  const [sellLoading, setSellLoading] = useState(false);

  const renderItemsAsync = useCallback(
    async ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
    }) => {
      const handleEarnPress = async () => {
        if (earnResult?.blockData) {
          Dialog.show({
            icon: earnResult.blockData.icon.icon,
            title: earnResult.blockData.title.text,
            description: earnResult.blockData.description.text,
            showCancelButton: false,
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_got_it,
            }),
            onConfirm: async ({ close }) => {
              await close?.();
            },
          });
          return;
        }

        const symbol = earnResult?.symbolInfo?.symbol ?? '';
        const protocolList = earnResult?.protocolList ?? [];

        if (!networkId || !symbol || protocolList.length === 0) {
          return;
        }

        defaultLogger.wallet.walletActions.actionEarn({
          walletType: walletType ?? '',
          networkId,
          source: 'tokenDetails',
          isSoftwareWalletOnlyUser,
        });

        if (protocolList.length === 1) {
          const protocol = protocolList[0];
          await EarnNavigation.pushToEarnProtocolDetails(navigation, {
            networkId,
            symbol,
            provider: protocol.provider.name,
            vault: protocol.provider.vault,
          });
        } else {
          EarnNavigation.pushToEarnProtocols(navigation, {
            symbol,
            filterNetworkId: networkId,
            logoURI: tokenInfo.logoURI
              ? encodeURIComponent(tokenInfo.logoURI)
              : undefined,
          });
        }
        handleActionListClose();
      };

      const handleSellPress = async () => {
        if (isSellDisabled) return;

        if (
          await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
            walletId,
          })
        ) {
          return;
        }

        setSellLoading(true);

        defaultLogger.wallet.walletActions.actionSell({
          walletType: walletType ?? '',
          networkId: networkId ?? '',
          source: 'tokenDetails',
          isSoftwareWalletOnlyUser,
        });

        try {
          const { url } =
            await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
              networkId,
              tokenAddress: tokenInfo.address,
              accountId,
              type: 'sell',
            });
          if (!url) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.feedback_request_failed,
              }),
            });
            return;
          }
          openUrlExternal(url);
        } finally {
          setSellLoading(false);
          handleActionListClose();
        }
      };

      return (
        <>
          {/* Trading group: Swap, Bridge */}
          <ActionList.Item
            icon="SwapHorOutline"
            label={intl.formatMessage({ id: ETranslations.global_swap })}
            onPress={() => {
              onSwap();
              handleActionListClose();
            }}
            disabled={disableSwapAction}
            onClose={handleActionListClose}
          />
          <ActionList.Item
            icon="BridgeOutline"
            label={intl.formatMessage({ id: ETranslations.swap_page_bridge })}
            onPress={() => {
              onBridge();
              handleActionListClose();
            }}
            disabled={disableSwapAction}
            onClose={handleActionListClose}
          />
          <Divider mx="$2" my="$1" />
          {/* Tools group: Earn, Sell */}
          <ActionList.Item
            icon="CoinsOutline"
            label={intl.formatMessage({ id: ETranslations.global_earn })}
            onPress={handleEarnPress}
            disabled={!earnResult}
            onClose={handleActionListClose}
          />
          <ReviewControl>
            <ActionList.Item
              icon="MinusLargeOutline"
              label={intl.formatMessage({ id: ETranslations.global_cash_out })}
              onPress={handleSellPress}
              disabled={isSellDisabled}
              isLoading={sellLoading}
              onClose={handleActionListClose}
            />
          </ReviewControl>
        </>
      );
    },
    [
      intl,
      onSwap,
      onBridge,
      disableSwapAction,
      earnResult,
      networkId,
      walletType,
      isSoftwareWalletOnlyUser,
      navigation,
      tokenInfo,
      isSellDisabled,
      walletId,
      accountId,
      sellLoading,
    ],
  );

  return <RawActions.More renderItemsAsync={renderItemsAsync} />;
}
