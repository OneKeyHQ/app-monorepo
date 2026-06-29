import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSwapStockPayTokenPreferenceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISpeedSwapConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelAsyncStatus,
  filterStockPayTokenCandidates,
  findDefaultStockPayToken,
  findTokenFromCandidates,
  getTokenIdentityKey,
} from './swapStockChannelUtils';
import { markStockUsdPriceCurrency } from './swapStockFiatValueUtils';
import {
  shouldRefreshStockPayTokensForHistoryEvent,
  shouldSyncStockPayTokenDetail,
} from './swapStockPayTokenUtils';

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
const USD_CURRENCY_SYMBOL = '$';

type IStockPayToken = IToken & {
  balance?: string;
  networkImageSrc?: string;
  valueProps?: { value: string; currency: string };
};

const EMPTY_STOCK_PAY_TOKENS: IStockPayToken[] = [];

function buildStockPayTokenPreferenceScope({
  accountId,
  indexedAccountId,
  stockNetworkId,
}: {
  accountId?: string;
  indexedAccountId?: string;
  stockNetworkId: string;
}) {
  if (!stockNetworkId) {
    return '';
  }
  return `${stockNetworkId}:${
    indexedAccountId || accountId || 'no-active-account'
  }`;
}

function getNetworkLogoURI(networkId?: string) {
  if (!networkId) {
    return undefined;
  }
  return Object.values(presetNetworksMap).find(
    (network) => network.id === networkId,
  )?.logoURI;
}

function getTokenValueBN(token: Partial<ISwapToken>) {
  const fiatValueBN = new BigNumber(token.fiatValue ?? '');
  if (fiatValueBN.isFinite()) {
    return fiatValueBN;
  }
  const balanceBN = new BigNumber(token.balanceParsed ?? 0);
  const priceBN = new BigNumber(token.price ?? 0);
  const valueBN = balanceBN.multipliedBy(priceBN);
  return valueBN.isFinite() ? valueBN : new BigNumber(0);
}

function buildStockPayToken({
  token,
  detail,
}: {
  token: IToken;
  detail?: ISwapToken;
}): IStockPayToken {
  const usdDetail = markStockUsdPriceCurrency(detail);
  const balanceParsed = usdDetail?.balanceParsed ?? token.balanceParsed ?? '0';
  const price = usdDetail?.price ?? token.price;
  const fiatValue = usdDetail?.fiatValue ?? token.fiatValue;
  const currency = usdDetail?.currency ?? token.currency;
  const tokenWithValue = {
    ...token,
    ...usdDetail,
    balanceParsed,
    currency,
    price,
    fiatValue,
    speedSwapDefaultAmount:
      token.speedSwapDefaultAmount ?? usdDetail?.speedSwapDefaultAmount ?? [],
  };
  const valueBN = getTokenValueBN(tokenWithValue);
  return {
    ...tokenWithValue,
    balance: balanceParsed,
    networkImageSrc:
      detail?.networkLogoURI ?? getNetworkLogoURI(token.networkId),
    valueProps: valueBN.isFinite()
      ? {
          value: valueBN.toFixed(2),
          currency: USD_CURRENCY_SYMBOL,
        }
      : undefined,
  };
}

function sortStockPayTokens(tokens: IStockPayToken[]) {
  return tokens
    .map((token, index) => ({ token, index }))
    .toSorted((a, b) => {
      const valueCompare = getTokenValueBN(b.token).comparedTo(
        getTokenValueBN(a.token),
      );
      return valueCompare || a.index - b.index;
    })
    .map((item) => item.token);
}

export function useSwapStockPayTokens({
  currentStockToken,
  currentStockTokenKey,
  disableNativePayToken,
  manualStockPayTokenKeyRef,
  payToken,
  selectPayToken,
  stockNetworkId,
  syncPayTokenDetail,
}: {
  currentStockToken?: ISwapToken;
  currentStockTokenKey: string;
  disableNativePayToken?: boolean;
  manualStockPayTokenKeyRef: MutableRefObject<string>;
  payToken?: ISwapToken;
  selectPayToken: (token: IToken, manual?: boolean) => void;
  stockNetworkId: string;
  syncPayTokenDetail: (token: IToken) => void;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [payTokenPreferenceByScope, setPayTokenPreferenceByScope] =
    useSwapStockPayTokenPreferenceAtom();
  const stockPayTokenPreferenceScope = useMemo(
    () =>
      buildStockPayTokenPreferenceScope({
        accountId: activeAccount?.account?.id,
        indexedAccountId: activeAccount?.indexedAccount?.id,
        stockNetworkId,
      }),
    [
      activeAccount?.account?.id,
      activeAccount?.indexedAccount?.id,
      stockNetworkId,
    ],
  );
  const persistedStockPayTokenKey = stockPayTokenPreferenceScope
    ? (payTokenPreferenceByScope[stockPayTokenPreferenceScope] ?? '')
    : '';
  const speedSwapConfigScope = stockNetworkId;
  const { result: speedSwapConfigState, isLoading: speedSwapConfigLoading } =
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
        swrKey: speedSwapConfigScope
          ? swrKeys.swapStockSpeedConfig({ networkId: speedSwapConfigScope })
          : undefined,
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
    manualStockPayTokenKeyRef.current = persistedStockPayTokenKey;
  }, [
    manualStockPayTokenKeyRef,
    persistedStockPayTokenKey,
    stockPayTokenPreferenceScope,
  ]);

  const rawPayTokens = useMemo(() => {
    const stockPayTokenCandidates = filterStockPayTokenCandidates(
      defaultTokens ?? [],
    );
    if (!stockPayTokenCandidates.length) {
      return [];
    }
    if (!currentStockTokenKey || stockPayTokenCandidates.length === 1) {
      return [...stockPayTokenCandidates];
    }
    return stockPayTokenCandidates.filter(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: currentStockToken,
        }),
    );
  }, [currentStockToken, currentStockTokenKey, defaultTokens]);

  const rawPayTokenKeys = useMemo(
    () => rawPayTokens.map(getTokenIdentityKey).join('|'),
    [rawPayTokens],
  );
  const hasActiveAccount = Boolean(
    activeAccount?.indexedAccount?.id || activeAccount?.account?.id,
  );
  const shouldLoadPayTokenDetails = Boolean(
    speedConfigReady && rawPayTokens.length > 0,
  );
  const payTokenDetailsScope = `${
    shouldLoadPayTokenDetails ? '1' : '0'
  }:${rawPayTokenKeys}:${activeAccount?.indexedAccount?.id ?? ''}:${
    activeAccount?.account?.id ?? ''
  }`;
  const {
    result: payTokenDetailsState,
    isLoading: payTokenDetailsLoading,
    run: reloadPayTokenDetails,
  } = usePromiseResult(
    async () => {
      if (!shouldLoadPayTokenDetails) {
        return {
          scope: payTokenDetailsScope,
          tokens: [] as IStockPayToken[],
          balances: {} as Record<string, string | undefined>,
        };
      }
      if (!hasActiveAccount) {
        const tokens = sortStockPayTokens(
          rawPayTokens.map((token) => buildStockPayToken({ token })),
        );
        return {
          scope: payTokenDetailsScope,
          tokens,
          balances: tokens.reduce<Record<string, string | undefined>>(
            (acc, token) => {
              acc[getTokenIdentityKey(token)] = token.balanceParsed ?? '0';
              return acc;
            },
            {},
          ),
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

      const tokens = await Promise.all(
        rawPayTokens.map(async (token) => {
          try {
            const networkAccount = await getNetworkAccount(token.networkId);
            if (!networkAccount?.id || !networkAccount?.address) {
              return buildStockPayToken({ token });
            }
            const details =
              await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                networkId: token.networkId,
                contractAddress: token.contractAddress,
                accountId: networkAccount.id,
                accountAddress: networkAccount.address,
                currency: 'usd',
              });
            return buildStockPayToken({ token, detail: details?.[0] });
          } catch {
            return buildStockPayToken({ token });
          }
        }),
      );
      const sortedTokens = sortStockPayTokens(tokens);
      return {
        scope: payTokenDetailsScope,
        tokens: sortedTokens,
        balances: Object.fromEntries(
          sortedTokens.map((token) => [
            getTokenIdentityKey(token),
            token.balanceParsed ?? '0',
          ]),
        ),
      };
    },
    [
      activeAccount?.account?.id,
      activeAccount?.indexedAccount?.id,
      hasActiveAccount,
      payTokenDetailsScope,
      rawPayTokens,
      shouldLoadPayTokenDetails,
    ],
    {
      initResult: {
        scope: '',
        tokens: [] as IStockPayToken[],
        balances: {} as Record<string, string | undefined>,
      },
      watchLoading: shouldLoadPayTokenDetails,
      revalidateOnFocus: true,
      swrKey: shouldLoadPayTokenDetails
        ? swrKeys.swapStockPayTokenDetails({
            scope: payTokenDetailsScope,
          })
        : undefined,
    },
  );
  const payTokenDetailsReady =
    payTokenDetailsState.scope === payTokenDetailsScope;
  const payTokens = payTokenDetailsReady
    ? payTokenDetailsState.tokens
    : EMPTY_STOCK_PAY_TOKENS;
  const selectablePayTokens = useMemo(
    () =>
      disableNativePayToken
        ? payTokens.filter((token) => !token.isNative)
        : payTokens,
    [disableNativePayToken, payTokens],
  );
  const activeSelectablePayToken = useMemo(
    () =>
      findTokenFromCandidates({
        candidates: selectablePayTokens,
        token: payToken,
      }),
    [payToken, selectablePayTokens],
  );
  const payTokenBalances = payTokenDetailsReady
    ? payTokenDetailsState.balances
    : undefined;

  useEffect(() => {
    if (!shouldLoadPayTokenDetails) {
      return;
    }
    const handleSwapHistoryStatusUpdate = ({
      fromToken,
      toToken,
    }: {
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }) => {
      if (
        shouldRefreshStockPayTokensForHistoryEvent({
          fromToken,
          rawPayTokens,
          toToken,
        })
      ) {
        void reloadPayTokenDetails();
      }
    };
    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapHistoryStatusUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapHistoryStatusUpdate,
      );
    };
  }, [rawPayTokens, reloadPayTokenDetails, shouldLoadPayTokenDetails]);

  useEffect(() => {
    const manualPayTokenKey = manualStockPayTokenKeyRef.current;
    if (!stockPayTokenPreferenceScope || !manualPayTokenKey || !payToken) {
      return;
    }
    if (manualPayTokenKey !== getTokenIdentityKey(payToken)) {
      return;
    }
    setPayTokenPreferenceByScope((prev) => {
      if (prev[stockPayTokenPreferenceScope] === manualPayTokenKey) {
        return prev;
      }
      return {
        ...prev,
        [stockPayTokenPreferenceScope]: manualPayTokenKey,
      };
    });
  }, [
    manualStockPayTokenKeyRef,
    payToken,
    setPayTokenPreferenceByScope,
    stockPayTokenPreferenceScope,
  ]);

  useEffect(() => {
    if (!payTokenDetailsReady || !activeSelectablePayToken) {
      return;
    }
    if (
      shouldSyncStockPayTokenDetail({
        currentToken: payToken,
        nextToken: activeSelectablePayToken,
      })
    ) {
      syncPayTokenDetail(activeSelectablePayToken);
    }
  }, [
    activeSelectablePayToken,
    payToken,
    payTokenDetailsReady,
    syncPayTokenDetail,
  ]);

  useEffect(() => {
    if (
      !speedConfigReady ||
      selectablePayTokens.length === 0 ||
      !payTokenDetailsReady
    ) {
      return;
    }

    const persistedToken = persistedStockPayTokenKey
      ? selectablePayTokens.find(
          (candidate) =>
            getTokenIdentityKey(candidate) === persistedStockPayTokenKey,
        )
      : undefined;
    const preferredToken = findDefaultStockPayToken({
      candidates: selectablePayTokens,
      balances: payTokenBalances,
    });
    const nextPayToken = persistedToken ?? preferredToken;
    if (!nextPayToken) {
      return;
    }
    if (
      activeSelectablePayToken &&
      (manualStockPayTokenKeyRef.current ===
        getTokenIdentityKey(activeSelectablePayToken) ||
        equalTokenNoCaseSensitive({
          token1: activeSelectablePayToken,
          token2: nextPayToken,
        }))
    ) {
      return;
    }

    selectPayToken(nextPayToken, false);
  }, [
    activeSelectablePayToken,
    manualStockPayTokenKeyRef,
    payToken,
    payTokenDetailsReady,
    payTokenBalances,
    persistedStockPayTokenKey,
    selectablePayTokens,
    selectPayToken,
    speedConfigReady,
  ]);

  const payTokenStatus = useMemo(() => {
    const speedSwapConfigBlockingLoading =
      speedSwapConfigLoading && !speedConfigReady;
    const payTokenDetailsBlockingLoading =
      payTokenDetailsLoading && !payTokenDetailsReady;
    if (!stockNetworkId) {
      return ESwapStockChannelAsyncStatus.Idle;
    }
    if (
      speedSwapConfigBlockingLoading ||
      !speedConfigReady ||
      (shouldLoadPayTokenDetails &&
        (!payTokenDetailsReady || payTokenDetailsBlockingLoading))
    ) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (selectablePayTokens.length === 0) {
      return ESwapStockChannelAsyncStatus.Empty;
    }
    if (!activeSelectablePayToken) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    return ESwapStockChannelAsyncStatus.Ready;
  }, [
    activeSelectablePayToken,
    payTokenDetailsReady,
    payTokenDetailsLoading,
    selectablePayTokens.length,
    shouldLoadPayTokenDetails,
    speedConfigReady,
    speedSwapConfigLoading,
    stockNetworkId,
  ]);
  const speedSwapConfigBlockingLoading =
    speedSwapConfigLoading && !speedConfigReady;
  const payTokenDetailsBlockingLoading =
    payTokenDetailsLoading && !payTokenDetailsReady;
  const stockPayTokenOptionsLoading =
    speedSwapConfigBlockingLoading ||
    (shouldLoadPayTokenDetails &&
      (!payTokenDetailsReady || payTokenDetailsBlockingLoading));

  return {
    payTokenStatus,
    payTokenOptionsLoading: !!stockPayTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    speedConfigReady,
  };
}
