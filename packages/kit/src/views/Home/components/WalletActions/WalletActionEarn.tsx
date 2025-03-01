import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import { RawActions } from './RawActions';

export function WalletActionEarn(props: {
  accountId: string;
  tokenAddress: string;
  networkId: string;
  indexedAccountId: string | undefined;
}) {
  const { accountId, tokenAddress, networkId, indexedAccountId } = props;

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

  const handleEarnTokenOnPress = useCallback(() => {
    const symbol = result?.symbolInfo?.symbol ?? '';

    if (!networkId || !accountId || !symbol) {
      return;
    }

    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.AssetProtocolList,
      params: { networkId, accountId, symbol, indexedAccountId, filter: true },
    });
  }, [
    result?.symbolInfo?.symbol,
    networkId,
    accountId,
    indexedAccountId,
    navigation,
  ]);

  return (
    <RawActions.Earn onPress={handleEarnTokenOnPress} disabled={!result} />
  );
}
