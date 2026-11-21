import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { isValidWrappedStakeToken } from '../utils/utils';

import { useCommittedEarnScopeGuard } from './useCommittedEarnScopeGuard';

export function useStakeAssets({
  enabled,
  accountId,
  networkId,
  providerName,
  symbol,
  vault,
  nativeWrapSelectedRef,
}: {
  enabled: boolean;
  accountId: string;
  networkId: string;
  providerName: string;
  symbol?: string;
  vault?: string;
  nativeWrapSelectedRef: { current: boolean };
}) {
  const { onFailure, supplementCanonicalWeth } =
    getEarnProtocol(providerName).getStakeAssetRequestPolicy();
  const scopeKey = JSON.stringify([
    enabled,
    accountId,
    networkId,
    providerName,
    vault ?? '',
    symbol ?? '',
  ]);
  const scopeGuard = useCommittedEarnScopeGuard(scopeKey);
  const requestScope = useMemo(
    () => ({
      enabled,
      accountId,
      networkId,
      providerName,
      symbol,
      vault,
      onFailure,
      scopeKey,
      scopeGuard,
    }),
    [
      enabled,
      accountId,
      networkId,
      providerName,
      symbol,
      vault,
      onFailure,
      scopeKey,
      scopeGuard,
    ],
  );
  const committedScopeRef = useRef(requestScope);
  useLayoutEffect(() => {
    committedScopeRef.current = requestScope;
  }, [requestScope]);
  const requestRef = useRef(0);
  // A newly mounted scope may have missed a transaction confirmation event.
  const forceNextRequestRef = useRef(true);
  const lastAssetsRef = useRef<
    { isCurrent: () => boolean; assets: IEarnTokenItem[] } | undefined
  >(undefined);

  const result = usePromiseResult(
    async () => {
      const currentScope =
        requestScope === committedScopeRef.current
          ? requestScope
          : committedScopeRef.current;
      if (
        !currentScope.enabled ||
        !currentScope.accountId ||
        !currentScope.symbol
      ) {
        return undefined;
      }
      const isCurrentScope = currentScope.scopeGuard.capture();
      if (!isCurrentScope()) return undefined;
      requestRef.current += 1;
      const requestId = requestRef.current;
      const forceRefresh = forceNextRequestRef.current;
      forceNextRequestRef.current = false;
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getEarnAssetsList({
            accountId: currentScope.accountId,
            networkId: currentScope.networkId,
            provider: currentScope.providerName,
            symbol: currentScope.symbol,
            vault: currentScope.vault || undefined,
            action: 'stake',
            ...(forceRefresh ? { forceRefresh: true } : {}),
          });
        if (isCurrentScope() && requestId === requestRef.current) {
          lastAssetsRef.current = {
            isCurrent: isCurrentScope,
            assets: response.assets,
          };
        }
        return {
          assets: response.assets,
          scopeKey: currentScope.scopeKey,
          isCurrentScope,
          status: 'success' as const,
        };
      } catch (error) {
        if (
          currentScope.onFailure === 'retain-selected-wrap' &&
          !nativeWrapSelectedRef.current
        ) {
          throw error;
        }
        return {
          scopeKey: currentScope.scopeKey,
          isCurrentScope,
          status: 'error' as const,
          assets:
            currentScope.onFailure === 'retain-selected-wrap' &&
            isCurrentScope() &&
            lastAssetsRef.current?.isCurrent()
              ? lastAssetsRef.current.assets
              : [],
        };
      }
    },
    [nativeWrapSelectedRef, requestScope],
    {
      watchLoading: true,
      revalidateOnFocus: true,
      resumeOnEffectReconnect: true,
    },
  );
  const runAssets = result.run;
  const trackerRef = useRef<
    | {
        scope: typeof scopeGuard;
        track: (txid: string, expectedAccountAddress?: string) => void;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    if (!enabled || !accountId || !networkId) return undefined;
    const isCurrent = scopeGuard.capture();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const controllers = new Map<string, AbortController>();
    const settled = new Set<string>();
    const scheduleRefresh = (txid: string) => {
      if (!isCurrent() || settled.has(txid)) return;
      settled.add(txid);
      controllers.get(txid)?.abort();
      controllers.delete(txid);
      // The provider's balance index can lag behind the transaction history.
      for (const delay of [3000, 10_000]) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!isCurrent()) return;
          forceNextRequestRef.current = true;
          void runAssets().catch(() => {
            if (isCurrent()) console.error('Unable to refresh Earn assets');
          });
        }, delay);
        timers.add(timer);
      }
    };
    const tracker = {
      scope: scopeGuard,
      track: (txid: string, expectedAccountAddress?: string) => {
        const key = txid.trim();
        if (!key || !isCurrent() || settled.has(key) || controllers.has(key))
          return;
        const controller = new AbortController();
        controllers.set(key, controller);
        void waitForTxFinalStatus({
          accountId,
          networkId,
          txid: key,
          signal: controller.signal,
          ...(expectedAccountAddress ? { expectedAccountAddress } : {}),
        })
          .then((status) => {
            if (controller.signal.aborted || !isCurrent()) return;
            if (
              status === EOnChainHistoryTxStatus.Success ||
              status === EOnChainHistoryTxStatus.Failed
            ) {
              scheduleRefresh(key);
            }
          })
          .catch(() => {
            if (!controller.signal.aborted && isCurrent()) {
              console.error('Unable to observe Earn transaction status');
            }
          })
          .finally(() => {
            if (controllers.get(key) === controller) controllers.delete(key);
          });
      },
    };
    trackerRef.current = tracker;
    const onTransactionConfirmed = (
      payload: IAppEventBusPayload[EAppEventBusNames.LocalPendingTxConfirmed],
    ) => {
      if (payload.accountId !== accountId || payload.networkId !== networkId) {
        return;
      }
      const txid = payload.txid.trim();
      if (txid) scheduleRefresh(txid);
    };
    appEventBus.on(
      EAppEventBusNames.LocalPendingTxConfirmed,
      onTransactionConfirmed,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.LocalPendingTxConfirmed,
        onTransactionConfirmed,
      );
      if (trackerRef.current === tracker) trackerRef.current = undefined;
      controllers.forEach((controller) => controller.abort());
      timers.forEach(clearTimeout);
      forceNextRequestRef.current = true;
    };
  }, [enabled, accountId, networkId, scopeGuard, runAssets]);
  const trackSubmittedTransaction = useCallback(
    (txid: string, expectedAccountAddress?: string) => {
      const tracker = trackerRef.current;
      if (tracker?.scope === scopeGuard && scopeGuard.isCurrent()) {
        tracker.track(txid, expectedAccountAddress);
      }
    },
    [scopeGuard],
  );
  const assetsResult = result.result;
  const needsWrappedToken = Boolean(
    enabled &&
    supplementCanonicalWeth &&
    assetsResult?.scopeKey === scopeKey &&
    assetsResult.isCurrentScope() &&
    assetsResult.status === 'success' &&
    assetsResult.assets.some(
      (asset) =>
        asset.info.isNative && asset.info.symbol.toUpperCase() === 'ETH',
    ) &&
    !assetsResult.assets.some((asset) =>
      isValidWrappedStakeToken({ providerName, networkId, token: asset.info }),
    ),
  );
  const wrappedRequest = useMemo(
    () => ({ requestScope, needsWrappedToken }),
    [requestScope, needsWrappedToken],
  );
  const committedWrappedRequestRef = useRef(wrappedRequest);
  useLayoutEffect(() => {
    committedWrappedRequestRef.current = wrappedRequest;
  }, [wrappedRequest]);
  const wrapped = usePromiseResult(
    async () => {
      const current =
        wrappedRequest === committedWrappedRequestRef.current
          ? wrappedRequest
          : committedWrappedRequestRef.current;
      if (!current.needsWrappedToken) return undefined;
      const currentScope = current.requestScope;
      const isCurrentScope = currentScope.scopeGuard.capture();
      if (!isCurrentScope()) return undefined;
      try {
        const details =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId: currentScope.accountId,
            networkId: currentScope.networkId,
            contractList: [EthereumWETH],
          });
        const token = details[0]?.info;
        if (
          !isValidWrappedStakeToken({
            providerName: currentScope.providerName,
            networkId: currentScope.networkId,
            token,
          })
        ) {
          return { request: current, isCurrentScope, error: true };
        }
        return { request: current, isCurrentScope, token };
      } catch {
        return { request: current, isCurrentScope, error: true };
      }
    },
    [wrappedRequest],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
      resumeOnEffectReconnect: true,
    },
  );
  const currentWrapped =
    needsWrappedToken &&
    wrapped.result?.request === wrappedRequest &&
    wrapped.result.isCurrentScope()
      ? wrapped.result
      : undefined;
  return {
    ...result,
    trackSubmittedTransaction,
    scopeKey,
    wrappedToken: currentWrapped?.token,
    wrappedTokenError: Boolean(currentWrapped?.error),
    isWrappedTokenLoading: needsWrappedToken && !currentWrapped,
    retryWrappedToken: wrapped.run,
  };
}
