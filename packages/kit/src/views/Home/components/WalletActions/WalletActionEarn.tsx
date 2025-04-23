import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
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
        networkId,
        filter: true,
      });
    const aprItems = protocolList
      .map((o) => Number(o.provider.aprWithoutFee))
      .filter((n) => Number(n) > 0);
    const maxApr = Math.max(0, ...aprItems);
    return { symbolInfo, maxApr };
  }, [networkId, tokenAddress]);

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const handleEarnTokenOnPress = useCallback(() => {
    const symbol = result?.symbolInfo?.symbol ?? '';

    if (!networkId || !accountId || !symbol) {
      return;
    }

    defaultLogger.wallet.walletActions.actionEarn({
      walletType: walletType ?? '',
      networkId,
      source,
      isSoftwareWalletOnlyUser,
    });

    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.AssetProtocolList,
      params: { networkId, accountId, symbol, indexedAccountId, filter: true },
    });
  }, [
    result?.symbolInfo?.symbol,
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
