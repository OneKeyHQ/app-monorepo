import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { RawActions } from './RawActions';

export function WalletActionEarn(props: {
  tokenAddress: string;
  networkId: string;
  walletType: string | undefined;
  source: 'homePage' | 'tokenDetails';
  trackID?: string;
  logoURI?: string;
}) {
  const { tokenAddress, networkId, walletType, source, trackID, logoURI } =
    props;

  const navigation = useAppNavigation();

  const intl = useIntl();

  const { result } = usePromiseResult(async () => {
    const symbolInfo =
      await backgroundApiProxy.serviceStaking.findSymbolByTokenAddress({
        networkId,
        tokenAddress,
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
    const aprItems = protocolList
      .map((o) => Number(o.provider.aprWithoutFee))
      .filter((n) => Number(n) > 0);
    const maxApr = Math.max(0, ...aprItems);
    const blockData = await backgroundApiProxy.serviceStaking.getBlockRegion();
    return { symbolInfo, maxApr, protocolList, blockData };
  }, [networkId, tokenAddress]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const handleEarnTokenOnPress = useCallback(async () => {
    if (result?.blockData) {
      Dialog.show({
        icon: result.blockData.icon.icon,
        title: result.blockData.title.text,
        description: result.blockData.description.text,
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

    const symbol = result?.symbolInfo?.symbol ?? '';
    const protocolList = result?.protocolList ?? [];

    if (!networkId || !symbol || protocolList.length === 0) {
      return;
    }

    defaultLogger.wallet.walletActions.actionEarn({
      walletType: walletType ?? '',
      networkId,
      source,
      isSoftwareWalletOnlyUser,
    });

    const protocols = protocolList.map((protocol) => ({
      provider: protocol.provider.name,
      networkId: protocol.network.networkId,
      vault: protocol.provider.vault,
    }));

    if (protocols.length === 1) {
      const protocol = protocolList[0];
      await EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId,
        symbol,
        provider: protocol.provider.name,
        vault: protocol.provider.vault,
      });
      return;
    }

    // Navigate to protocols list page for multiple protocols
    EarnNavigation.pushToEarnProtocols(navigation, {
      symbol,
      filterNetworkId: networkId,
      logoURI: logoURI ? encodeURIComponent(logoURI) : undefined,
    });
  }, [
    logoURI,
    intl,
    result?.symbolInfo?.symbol,
    result?.protocolList,
    result?.blockData,
    networkId,
    walletType,
    source,
    navigation,
    isSoftwareWalletOnlyUser,
  ]);

  return (
    <RawActions.Earn
      onPress={handleEarnTokenOnPress}
      disabled={!result}
      trackID={trackID}
    />
  );
}
