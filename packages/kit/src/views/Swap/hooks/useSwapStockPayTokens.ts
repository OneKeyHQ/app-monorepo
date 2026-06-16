import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISpeedSwapConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelAsyncStatus,
  findDefaultStockPayToken,
  findTokenFromCandidates,
  getTokenIdentityKey,
} from './swapStockChannelUtils';

const defaultSpeedSwapConfig: ISpeedSwapConfig = {
  provider: '',
  speedConfig: {
    spenderAddress: '',
    slippage: 0.5,
    defaultTokens: [],
    defaultLimitTokens: [],
    swapMevNetConfig: mevSwapNetworks,
  },
  supportSpeedSwap: undefined,
  onlySupportCrossChain: false,
  onlySupportSingleChain: false,
  speedDefaultSelectToken: undefined,
};

const EMPTY_DEFAULT_TOKENS: IToken[] = [];

export function useSwapStockPayTokens({
  currentStockToken,
  currentStockTokenKey,
  disableNativePayToken,
  manualStockPayTokenKeyRef,
  payToken,
  selectPayToken,
  stockNetworkId,
}: {
  currentStockToken?: ISwapToken;
  currentStockTokenKey: string;
  disableNativePayToken?: boolean;
  manualStockPayTokenKeyRef: MutableRefObject<string>;
  payToken?: ISwapToken;
  selectPayToken: (token: IToken, manual?: boolean) => void;
  stockNetworkId: string;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const speedSwapConfigScope = stockNetworkId;
  const { result: speedSwapConfigState, isLoading: payTokenOptionsLoading } =
    usePromiseResult(
      async () => {
        if (!stockNetworkId) {
          return {
            scope: speedSwapConfigScope,
            config: defaultSpeedSwapConfig,
          };
        }
        const config =
          await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
            networkId: stockNetworkId,
          });
        return {
          scope: speedSwapConfigScope,
          config,
        };
      },
      [speedSwapConfigScope, stockNetworkId],
      {
        initResult: {
          scope: '',
          config: defaultSpeedSwapConfig,
        },
        watchLoading: true,
      },
    );
  const speedConfigReady = speedSwapConfigState.scope === speedSwapConfigScope;
  const defaultTokens = useMemo(
    () =>
      (speedConfigReady
        ? speedSwapConfigState.config.speedConfig.defaultTokens
        : EMPTY_DEFAULT_TOKENS) as IToken[],
    [speedConfigReady, speedSwapConfigState.config.speedConfig.defaultTokens],
  );

  useEffect(() => {
    manualStockPayTokenKeyRef.current = '';
  }, [manualStockPayTokenKeyRef, stockNetworkId]);

  const payTokens = useMemo(() => {
    if (!defaultTokens?.length) {
      return [];
    }
    if (!currentStockTokenKey || defaultTokens.length === 1) {
      return [...defaultTokens];
    }
    return defaultTokens.filter(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: currentStockToken,
        }),
    );
  }, [currentStockToken, currentStockTokenKey, defaultTokens]);

  const selectablePayTokens = useMemo(
    () =>
      disableNativePayToken
        ? payTokens.filter((token) => !token.isNative)
        : payTokens,
    [disableNativePayToken, payTokens],
  );
  const selectablePayTokenKeys = useMemo(
    () => selectablePayTokens.map(getTokenIdentityKey).join('|'),
    [selectablePayTokens],
  );
  const hasActiveAccount = Boolean(
    activeAccount?.indexedAccount?.id || activeAccount?.account?.id,
  );
  const shouldLoadPayTokenBalances = Boolean(
    speedConfigReady && selectablePayTokens.length > 0,
  );
  const payTokenBalanceScope = `${
    shouldLoadPayTokenBalances ? '1' : '0'
  }:${selectablePayTokenKeys}:${activeAccount?.indexedAccount?.id ?? ''}:${
    activeAccount?.account?.id ?? ''
  }`;
  const { result: payTokenBalanceState, isLoading: payTokenBalanceLoading } =
    usePromiseResult(
      async () => {
        if (!shouldLoadPayTokenBalances) {
          return {
            scope: payTokenBalanceScope,
            balances: {} as Record<string, string | undefined>,
          };
        }
        if (!hasActiveAccount) {
          return {
            scope: payTokenBalanceScope,
            balances: selectablePayTokens.reduce<
              Record<string, string | undefined>
            >((acc, token) => {
              acc[getTokenIdentityKey(token)] = token.balanceParsed ?? '0';
              return acc;
            }, {}),
          };
        }

        const accountRequestMap = new Map<
          string,
          Promise<
            | {
                id?: string;
                address?: string;
              }
            | undefined
          >
        >();
        const getNetworkAccount = (tokenNetworkId: string) => {
          const cachedRequest = accountRequestMap.get(tokenNetworkId);
          if (cachedRequest) {
            return cachedRequest;
          }
          const request = (async () => {
            const defaultDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: tokenNetworkId,
                },
              );
            return backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: activeAccount?.indexedAccount?.id
                ? undefined
                : activeAccount?.account?.id,
              indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
              networkId: tokenNetworkId,
              deriveType: defaultDeriveType ?? 'default',
            });
          })();
          accountRequestMap.set(tokenNetworkId, request);
          return request;
        };

        const balanceEntries = await Promise.all(
          selectablePayTokens.map(async (token) => {
            const fallbackBalance = token.balanceParsed ?? '0';
            try {
              const networkAccount = await getNetworkAccount(token.networkId);
              if (!networkAccount?.id || !networkAccount?.address) {
                return [getTokenIdentityKey(token), fallbackBalance] as const;
              }
              const details =
                await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                  networkId: token.networkId,
                  contractAddress: token.contractAddress,
                  accountId: networkAccount.id,
                  accountAddress: networkAccount.address,
                  currency: 'usd',
                });
              return [
                getTokenIdentityKey(token),
                details?.[0]?.balanceParsed ?? fallbackBalance,
              ] as const;
            } catch {
              return [getTokenIdentityKey(token), fallbackBalance] as const;
            }
          }),
        );
        return {
          scope: payTokenBalanceScope,
          balances: Object.fromEntries(balanceEntries),
        };
      },
      [
        activeAccount?.account?.id,
        activeAccount?.indexedAccount?.id,
        hasActiveAccount,
        payTokenBalanceScope,
        selectablePayTokens,
        shouldLoadPayTokenBalances,
      ],
      {
        initResult: {
          scope: '',
          balances: {} as Record<string, string | undefined>,
        },
        watchLoading: shouldLoadPayTokenBalances,
      },
    );
  const payTokenBalanceReady =
    payTokenBalanceState.scope === payTokenBalanceScope;
  const payTokenBalances = payTokenBalanceReady
    ? payTokenBalanceState.balances
    : undefined;

  useEffect(() => {
    if (
      !speedConfigReady ||
      selectablePayTokens.length === 0 ||
      !payTokenBalanceReady
    ) {
      return;
    }

    const currentToken = findTokenFromCandidates({
      candidates: selectablePayTokens,
      token: payToken,
    });
    const preferredToken = findDefaultStockPayToken({
      candidates: selectablePayTokens,
      balances: payTokenBalances,
    });
    if (
      currentToken &&
      (manualStockPayTokenKeyRef.current ===
        getTokenIdentityKey(currentToken) ||
        equalTokenNoCaseSensitive({
          token1: currentToken,
          token2: preferredToken,
        }))
    ) {
      return;
    }

    selectPayToken(preferredToken, false);
  }, [
    manualStockPayTokenKeyRef,
    payToken,
    payTokenBalanceReady,
    payTokenBalances,
    selectablePayTokens,
    selectPayToken,
    speedConfigReady,
  ]);

  const payTokenStatus = useMemo(() => {
    if (!stockNetworkId) {
      return ESwapStockChannelAsyncStatus.Idle;
    }
    if (
      payTokenOptionsLoading ||
      !speedConfigReady ||
      (shouldLoadPayTokenBalances &&
        (!payTokenBalanceReady || payTokenBalanceLoading))
    ) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (selectablePayTokens.length === 0) {
      return ESwapStockChannelAsyncStatus.Empty;
    }
    return ESwapStockChannelAsyncStatus.Ready;
  }, [
    payTokenOptionsLoading,
    payTokenBalanceLoading,
    payTokenBalanceReady,
    selectablePayTokens.length,
    shouldLoadPayTokenBalances,
    speedConfigReady,
    stockNetworkId,
  ]);

  return {
    payTokenStatus,
    payTokenOptionsLoading: !!payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    speedConfigReady,
  };
}
