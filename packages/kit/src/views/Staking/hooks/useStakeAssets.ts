import { useLayoutEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
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
  const isEtherFiProvider = earnUtils.isEtherFiProvider({ providerName });
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
      isEtherFiProvider,
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
      isEtherFiProvider,
      scopeKey,
      scopeGuard,
    ],
  );
  const committedScopeRef = useRef(requestScope);
  useLayoutEffect(() => {
    committedScopeRef.current = requestScope;
  }, [requestScope]);
  const requestRef = useRef(0);
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
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getEarnAssetsList({
            accountId: currentScope.accountId,
            networkId: currentScope.networkId,
            provider: currentScope.providerName,
            symbol: currentScope.symbol,
            vault: currentScope.vault || undefined,
            action: 'stake',
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
        if (!currentScope.isEtherFiProvider && !nativeWrapSelectedRef.current) {
          throw error;
        }
        return {
          scopeKey: currentScope.scopeKey,
          isCurrentScope,
          status: 'error' as const,
          assets:
            !currentScope.isEtherFiProvider &&
            isCurrentScope() &&
            lastAssetsRef.current?.isCurrent()
              ? lastAssetsRef.current.assets
              : [],
        };
      }
    },
    [nativeWrapSelectedRef, requestScope],
    { watchLoading: true, resumeOnEffectReconnect: true },
  );
  const assetsResult = result.result;
  const needsWrappedToken = Boolean(
    enabled &&
    isEtherFiProvider &&
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
    scopeKey,
    wrappedToken: currentWrapped?.token,
    wrappedTokenError: Boolean(currentWrapped?.error),
    isWrappedTokenLoading: needsWrappedToken && !currentWrapped,
    retryWrappedToken: wrapped.run,
  };
}
