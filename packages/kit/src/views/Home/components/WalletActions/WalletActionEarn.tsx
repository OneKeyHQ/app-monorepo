import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { showProtocolListDialog } from '@onekeyhq/kit/src/views/Earn/components/showProtocolListDialog';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import { RawActions } from './RawActions';

export function WalletActionEarn(props: {
  accountId: string;
  tokenAddress: string;
  networkId: string;
  indexedAccountId: string | undefined;
  walletType: string | undefined;
  source: 'homePage' | 'tokenDetails';
  trackID?: string;
}) {
  const {
    accountId,
    tokenAddress,
    networkId,
    indexedAccountId,
    walletType,
    source,
    trackID,
  } = props;

  const navigation = useAppNavigation();

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
    const aprItems = protocolList
      .map((o) => Number(o.provider.aprWithoutFee))
      .filter((n) => Number(n) > 0);
    const maxApr = Math.max(0, ...aprItems);
    return { symbolInfo, maxApr, protocolList };
  }, [networkId, tokenAddress]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const handleEarnTokenOnPress = useCallback(async () => {
    const symbol = result?.symbolInfo?.symbol ?? '';
    const protocolList = result?.protocolList ?? [];

    if (!networkId || !accountId || !symbol || protocolList.length === 0) {
      return;
    }

    defaultLogger.wallet.walletActions.actionEarn({
      walletType: walletType ?? '',
      networkId,
      source,
      isSoftwareWalletOnlyUser,
    });

    // Convert protocol list to the format expected by showProtocolListDialog
    const protocols = protocolList.map((protocol) => ({
      provider: protocol.provider.name,
      networkId: protocol.network.networkId,
      vault: protocol.provider.vault,
    }));

    if (protocols.length === 1) {
      const protocol = protocolList[0];
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ProtocolDetailsV2,
        params: {
          networkId,
          accountId,
          indexedAccountId,
          symbol,
          provider: protocol.provider.name,
          vault: protocol.provider.vault,
        },
      });
      return;
    }

    // Use dialog for multiple protocols
    showProtocolListDialog({
      symbol,
      accountId,
      indexedAccountId,
      filterNetworkId: networkId,
      onProtocolSelect: async (params) => {
        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ProtocolDetailsV2,
          params,
        });
      },
    });
  }, [
    result?.symbolInfo?.symbol,
    result?.protocolList,
    networkId,
    accountId,
    walletType,
    source,
    navigation,
    indexedAccountId,
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
