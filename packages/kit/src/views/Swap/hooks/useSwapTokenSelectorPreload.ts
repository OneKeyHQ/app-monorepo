import { useEffect, useSyncExternalStore } from 'react';

import { useSwapActions } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapTabSwitchType,
  type ISwapNetwork,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapNetworkReadyKey,
  isSwapNetworkCacheReadyForBasicList,
} from '../utils/swapNetworkCacheUtils';
import {
  getSwapTokenSelectorCacheEpoch,
  isSwapTokenSelectorAccountRemoved,
  subscribeSwapTokenSelectorCache,
} from '../utils/swapTokenSelectorCacheUtils';

import type { useSwapAddressInfo } from './useSwapAccount';

type ISwapTokenSelectorPreloadAddressInfo = Pick<
  ReturnType<typeof useSwapAddressInfo>,
  'accountInfo' | 'isAddressInfoReady'
>;

type ISwapTokenSelectorPreloadParams = {
  enabled: boolean;
  fromAddressInfo: ISwapTokenSelectorPreloadAddressInfo;
  toAddressInfo: ISwapTokenSelectorPreloadAddressInfo;
  networks: ISwapNetwork[];
  swapType: ESwapTabSwitchType;
  currency: string;
};

export function useSwapTokenSelectorPreload({
  enabled,
  fromAddressInfo,
  toAddressInfo,
  networks,
  swapType,
  currency,
}: ISwapTokenSelectorPreloadParams) {
  const { swapLoadAllNetworkTokenList } = useSwapActions().current;
  const cacheEpoch = useSyncExternalStore(
    subscribeSwapTokenSelectorCache,
    getSwapTokenSelectorCacheEpoch,
    getSwapTokenSelectorCacheEpoch,
  );
  const fromAccountReady =
    fromAddressInfo.isAddressInfoReady && fromAddressInfo.accountInfo?.ready;
  const toAccountReady =
    toAddressInfo.isAddressInfoReady && toAddressInfo.accountInfo?.ready;
  const fromIndexedAccountId = fromAccountReady
    ? fromAddressInfo.accountInfo?.indexedAccount?.id
    : undefined;
  const fromOtherAccountId =
    fromAccountReady && !fromIndexedAccountId
      ? (fromAddressInfo.accountInfo?.account?.id ??
        fromAddressInfo.accountInfo?.dbAccount?.id)
      : undefined;
  const toIndexedAccountId = toAccountReady
    ? toAddressInfo.accountInfo?.indexedAccount?.id
    : undefined;
  const toOtherAccountId =
    toAccountReady && !toIndexedAccountId
      ? (toAddressInfo.accountInfo?.account?.id ??
        toAddressInfo.accountInfo?.dbAccount?.id)
      : undefined;
  const networkReadyKey = isSwapNetworkCacheReadyForBasicList(networks)
    ? buildSwapNetworkReadyKey(networks)
    : '';

  useEffect(() => {
    if (
      !enabled ||
      !(platformEnv.isDesktop || platformEnv.isWeb) ||
      swapType === ESwapTabSwitchType.STOCK ||
      !networkReadyKey
    ) {
      return;
    }
    const scopes = [
      [fromIndexedAccountId, fromOtherAccountId],
      [toIndexedAccountId, toOtherAccountId],
    ] as const;
    const requestedScopes = new Set<string>();
    for (const [indexedAccountId, otherAccountId] of scopes) {
      const scopeKey = JSON.stringify([indexedAccountId, otherAccountId]);
      if (
        (indexedAccountId || otherAccountId) &&
        !isSwapTokenSelectorAccountRemoved({
          indexedAccountId,
          accountId: otherAccountId,
        }) &&
        !requestedScopes.has(scopeKey)
      ) {
        requestedScopes.add(scopeKey);
        // Fresh snapshots suppress speculative requests; opening the modal or
        // invalidating transaction/identity data still revalidates the lists.
        void swapLoadAllNetworkTokenList(
          indexedAccountId,
          otherAccountId,
          false,
          currency,
          { policy: 'preload' },
        ).catch(() => undefined);
      }
    }
  }, [
    enabled,
    cacheEpoch,
    currency,
    fromIndexedAccountId,
    fromOtherAccountId,
    networkReadyKey,
    swapLoadAllNetworkTokenList,
    swapType,
    toIndexedAccountId,
    toOtherAccountId,
  ]);
}
