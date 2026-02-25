import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  Divider,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IToken } from '@onekeyhq/shared/types/token';

interface ITokenDetailsWalletActionMoreProps {
  accountId: string;
  networkId: string;
  walletType: string | undefined;
  tokenInfo: IToken;
  onSwap: () => void;
  onBridge: () => void;
}

export function TokenDetailsWalletActionMore({
  accountId,
  networkId,
  walletType,
  tokenInfo,
  onSwap,
  onBridge,
}: ITokenDetailsWalletActionMoreProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

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
          {/* Tools group: Earn */}
          <ActionList.Item
            icon="CoinsOutline"
            label={intl.formatMessage({ id: ETranslations.global_earn })}
            onPress={handleEarnPress}
            disabled={!earnResult}
            onClose={handleActionListClose}
          />
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
    ],
  );

  return <RawActions.More renderItemsAsync={renderItemsAsync} />;
}
