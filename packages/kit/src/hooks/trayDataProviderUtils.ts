import BigNumber from 'bignumber.js';

import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';

type ITrayNetworkInfoMap = Record<
  string,
  {
    deriveType: string;
    mergeDeriveAssetsEnabled: boolean;
  }
>;

export const TRAY_DATA_REFRESH_EVENT_NAMES = [
  EAppEventBusNames.HistoryTxStatusChanged,
  EAppEventBusNames.RefreshHistoryList,
  EAppEventBusNames.AccountDataUpdate,
  EAppEventBusNames.MarketWatchListV2Changed,
  EAppEventBusNames.EnabledNetworksChanged,
] as const;

export function getTrayTokenValueInTargetCurrency({
  tokensValue,
  usdToTargetFactor,
  walletId,
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
}: {
  tokensValue: string | Record<string, string> | undefined;
  usdToTargetFactor: BigNumber.Value;
  walletId?: string;
  enabledNetworksCompatibleWithWalletId?: Array<{ id: string }>;
  networkInfoMap?: ITrayNetworkInfoMap;
}) {
  const hasEnabledNetworkScope =
    !!walletId &&
    !!enabledNetworksCompatibleWithWalletId?.length &&
    !!networkInfoMap &&
    Object.keys(networkInfoMap).length > 0;

  const tokensUsd = calculateAccountTotalValue({
    tokensValue,
    deFiNetWorth: 0,
    ...(hasEnabledNetworkScope
      ? {
          walletId,
          enabledNetworksCompatibleWithWalletId,
          networkInfoMap,
        }
      : undefined),
  });

  return new BigNumber(tokensUsd ?? '0')
    .times(new BigNumber(usdToTargetFactor || 1))
    .toFixed();
}
