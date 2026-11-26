import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { canOpenExchangeApp } from '@onekeyhq/kit/src/hooks/useExchangeAppDetection';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EExchangeId } from '@onekeyhq/shared/src/consts/exchangeConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getBinanceDepositEventContext } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

// Whether the recipient step offers the user's Binance account, and for which
// asset of the supported-assets list.
export function useBinanceDepositEntry({
  accountId,
  networkId,
  token,
  isNFT,
}: {
  accountId: string;
  networkId: string;
  token?: IToken | null;
  isNFT: boolean;
}) {
  const isTransferAllowListEnabled = useIsEnableTransferAllowList();
  // iOS / Android only: the authorization link only works in the Binance
  // app, and only a phone gets the return deep link. Accounts that can't
  // sign, allowlists that would block a fresh deposit address at the amount
  // step, and Travel Mode, which keeps no session key, never get the entry.
  const depositToken =
    platformEnv.isNative &&
    !isNFT &&
    !isTransferAllowListEnabled &&
    !accountUtils.isWatchingAccount({ accountId }) &&
    travelModeManager.getRuntimeEnvironmentSync().profile.kind !== 'travel-mode'
      ? token
      : undefined;

  // Both answers are cached so the entry is there when the page opens. A
  // token Binance doesn't accept is cached as null: the cache never stores
  // undefined, and a stale asset would flash the entry on every open. A
  // failed fetch keeps what is there.
  const {
    result: asset,
    setResult: setAsset,
    run: runAssetQuery,
  } = usePromiseResult(
    async () =>
      depositToken
        ? ((await backgroundApiProxy.serviceBinanceDeposit.getDepositAsset({
            networkId,
            symbol: depositToken.symbol,
            contractAddress: depositToken.address,
            isNative: !!depositToken.isNative,
          })) ?? null)
        : undefined,
    [depositToken, networkId],
    {
      swrKey: depositToken
        ? `binance-deposit-asset:${networkId}:${depositToken.address || 'native'}`
        : undefined,
      keepResultIfError: true,
    },
  );
  // Asked again only when the asset comes or goes, not each time a fresh
  // copy of it arrives.
  const hasAsset = !!asset;
  const { result: isBinanceInstalled } = usePromiseResult(
    async () =>
      hasAsset ? canOpenExchangeApp(EExchangeId.Binance) : undefined,
    [hasAsset],
    { swrKey: 'binance-deposit-app-installed' },
  );
  const isEntryAvailable = !!asset && isBinanceInstalled === true;
  // Called by the entry while it is on screen. Once per page for each
  // asset, however often typing hides it.
  const shownAssetKeyRef = useRef<string | undefined>(undefined);
  const reportEntryShown = useCallback(() => {
    const key = asset ? `${asset.networkId}:${asset.cryptoCurrency}` : '';
    if (!asset || !isEntryAvailable || shownAssetKeyRef.current === key) {
      return;
    }
    shownAssetKeyRef.current = key;
    defaultLogger.transaction.send.binanceDepositEntryShow(
      getBinanceDepositEventContext(asset),
    );
  }, [asset, isEntryAvailable]);

  // The list that offered the asset turned out to be out of date.
  const refreshAsset = useCallback(() => {
    void runAssetQuery();
  }, [runAssetQuery]);
  // Turned off by Binance for now: the entry goes away on this page, and the
  // next list fetched decides when it comes back.
  const hideAsset = useCallback(() => setAsset(null), [setAsset]);

  return { asset, isEntryAvailable, reportEntryShown, refreshAsset, hideAsset };
}
