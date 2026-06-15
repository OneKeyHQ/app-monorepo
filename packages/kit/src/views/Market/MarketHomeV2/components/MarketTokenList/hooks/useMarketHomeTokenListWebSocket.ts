import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import type { IMarketToken } from '../MarketTokenData';

export type IMarketTokenListLiveOverride = Partial<
  Pick<
    IMarketToken,
    | 'price'
    | 'change24h'
    | 'marketCap'
    | 'liquidity'
    | 'transactions'
    | 'uniqueTraders'
    | 'holders'
    | 'turnover'
    | 'walletInfo'
  >
> &
  Pick<IMarketToken, 'networkId' | 'address'>;

type IMarketTokenListStoredLiveOverride = IMarketTokenListLiveOverride & {
  basePrice?: IMarketToken['price'];
};

type IMarketHomeTokenSubscription = {
  key: string;
  networkId: string;
  address: string;
  chartType: string;
  currency: string;
};

type IMarketHomeTokenListWebSocketParams = {
  tokens: IMarketToken[];
  subscriptionTokens?: IMarketToken[];
  enabled?: boolean;
  chartType?: string;
  currency?: string;
  onSubscriptionCountChange?: (count: number) => void;
};

type IMarketWSDataUpdatePayload = {
  channel: string;
  tokenAddress: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  data: unknown;
};

const DEFAULT_MARKET_HOME_WS_CHART_TYPE = '1m';
const DEFAULT_MARKET_HOME_WS_CURRENCY = 'usd';

function normalizeAddress({
  networkId,
  address,
}: Pick<IMarketToken, 'networkId' | 'address'>) {
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address.trim(),
    }) ?? ''
  );
}

function getTokenLiveOverrideKey({
  networkId,
  address,
}: Pick<IMarketToken, 'networkId' | 'address'>) {
  return `${networkId}:${normalizeAddress({ networkId, address })}`;
}

function getTokenSubscriptionKey({
  networkId,
  address,
  chartType,
  currency,
}: Omit<IMarketHomeTokenSubscription, 'key'>) {
  return `${networkId}:${normalizeAddress({
    networkId,
    address,
  })}:${chartType}:${currency}`;
}

function getLiveOverrideBasePrice(override: IMarketTokenListLiveOverride) {
  return (override as IMarketTokenListStoredLiveOverride).basePrice;
}

function findTokenByLiveOverrideKey({
  tokens,
  liveOverrideKey,
}: {
  tokens: IMarketToken[];
  liveOverrideKey: string;
}) {
  return tokens.find(
    (token) => getTokenLiveOverrideKey(token) === liveOverrideKey,
  );
}

function isWsPriceData(data: unknown): data is IWsPriceData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<IWsPriceData>;
  return (
    typeof candidate.address === 'string' && typeof candidate.c === 'number'
  );
}

export function buildMarketHomeTokenSubscriptions({
  tokens,
  chartType = DEFAULT_MARKET_HOME_WS_CHART_TYPE,
  currency = DEFAULT_MARKET_HOME_WS_CURRENCY,
}: {
  tokens: IMarketToken[];
  chartType?: string;
  currency?: string;
}): IMarketHomeTokenSubscription[] {
  const subscriptionMap = new Map<string, IMarketHomeTokenSubscription>();

  for (const token of tokens) {
    if (!token.perpsCoin && token.networkId && token.address) {
      const subscription = {
        networkId: token.networkId,
        address: token.address,
        chartType,
        currency,
      };
      const key = getTokenSubscriptionKey(subscription);

      if (!subscriptionMap.has(key)) {
        subscriptionMap.set(key, {
          ...subscription,
          key,
        });
      }
    }
  }

  return [...subscriptionMap.values()];
}

function findMatchingSubscription({
  payload,
  subscriptions,
}: {
  payload: IMarketWSDataUpdatePayload;
  subscriptions: IMarketHomeTokenSubscription[];
}) {
  const wsPriceData = isWsPriceData(payload.data) ? payload.data : undefined;
  const tokenAddress = payload.tokenAddress || wsPriceData?.address || '';
  if (!tokenAddress) {
    return undefined;
  }

  if (!payload.networkId && payload.isSubscriptionAmbiguous) {
    return undefined;
  }

  const matchedSubscriptions = subscriptions.filter((subscription) => {
    if (payload.networkId && subscription.networkId !== payload.networkId) {
      return false;
    }

    if (wsPriceData?.type && subscription.chartType !== wsPriceData.type) {
      return false;
    }

    return (
      normalizeAddress({
        networkId: subscription.networkId,
        address: subscription.address,
      }) ===
      normalizeAddress({
        networkId: subscription.networkId,
        address: tokenAddress,
      })
    );
  });

  return matchedSubscriptions.length === 1
    ? matchedSubscriptions[0]
    : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mergeLiveOverride(
  token: IMarketToken,
  override: IMarketTokenListLiveOverride,
) {
  const nextToken = { ...token };
  let hasOverride = false;

  if (override.price !== undefined) {
    nextToken.price = override.price;
    hasOverride = true;
  }
  if (override.change24h !== undefined) {
    nextToken.change24h = override.change24h;
    hasOverride = true;
  }
  if (override.marketCap !== undefined) {
    nextToken.marketCap = override.marketCap;
    hasOverride = true;
  }
  if (override.liquidity !== undefined) {
    nextToken.liquidity = override.liquidity;
    hasOverride = true;
  }
  if (override.transactions !== undefined) {
    nextToken.transactions = override.transactions;
    hasOverride = true;
  }
  if (override.uniqueTraders !== undefined) {
    nextToken.uniqueTraders = override.uniqueTraders;
    hasOverride = true;
  }
  if (override.holders !== undefined) {
    nextToken.holders = override.holders;
    hasOverride = true;
  }
  if (override.turnover !== undefined) {
    nextToken.turnover = override.turnover;
    hasOverride = true;
  }
  if (override.walletInfo !== undefined) {
    nextToken.walletInfo = override.walletInfo;
    hasOverride = true;
  }

  return hasOverride ? nextToken : token;
}

export function applyMarketTokenListLiveOverrides({
  tokens,
  liveTokenOverrides,
}: {
  tokens: IMarketToken[];
  liveTokenOverrides: IMarketTokenListLiveOverride[];
}) {
  if (liveTokenOverrides.length === 0) {
    return tokens;
  }

  const overrideMap = new Map<string, IMarketTokenListLiveOverride>();
  for (const override of liveTokenOverrides) {
    overrideMap.set(getTokenLiveOverrideKey(override), override);
  }

  let hasMatchedToken = false;
  const nextTokens = tokens.map((token) => {
    const override = overrideMap.get(getTokenLiveOverrideKey(token));
    if (!override) {
      return token;
    }

    const basePrice = getLiveOverrideBasePrice(override);
    if (basePrice !== undefined && token.price !== basePrice) {
      return token;
    }

    hasMatchedToken = true;
    return mergeLiveOverride(token, override);
  });

  return hasMatchedToken ? nextTokens : tokens;
}

export function useMarketHomeTokenListWebSocket({
  tokens,
  subscriptionTokens,
  enabled = false,
  chartType = DEFAULT_MARKET_HOME_WS_CHART_TYPE,
  currency = DEFAULT_MARKET_HOME_WS_CURRENCY,
  onSubscriptionCountChange,
}: IMarketHomeTokenListWebSocketParams) {
  const tokensForSubscription = subscriptionTokens ?? tokens;
  const subscriptions = useMemo(
    () =>
      buildMarketHomeTokenSubscriptions({
        tokens: tokensForSubscription,
        chartType,
        currency,
      }),
    [tokensForSubscription, chartType, currency],
  );
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const desiredSubscriptionsRef = useRef<
    Map<string, IMarketHomeTokenSubscription>
  >(new Map());
  const ownedSubscriptionsRef = useRef<
    Map<string, IMarketHomeTokenSubscription>
  >(new Map());
  const onSubscriptionCountChangeRef = useRef(onSubscriptionCountChange);
  onSubscriptionCountChangeRef.current = onSubscriptionCountChange;
  const isMountedRef = useRef(true);
  const isSyncingSubscriptionsRef = useRef(false);
  const syncRequestIdRef = useRef(0);

  const subscriptionIdentity = useMemo(
    () => subscriptions.map((item) => item.key).join('|'),
    [subscriptions],
  );
  const [liveOverridesByKey, setLiveOverridesByKey] = useState<
    Record<string, IMarketTokenListStoredLiveOverride>
  >({});

  const emitSubscriptionCountChange = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    onSubscriptionCountChangeRef.current?.(ownedSubscriptionsRef.current.size);
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      onSubscriptionCountChangeRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    onSubscriptionCountChange?.(ownedSubscriptionsRef.current.size);
  }, [onSubscriptionCountChange]);

  useEffect(() => {
    if (!enabled) {
      setLiveOverridesByKey((prev) =>
        Object.keys(prev).length === 0 ? prev : {},
      );
      return;
    }

    const liveOverrideKeys = new Set(
      subscriptions.map((item) =>
        getTokenLiveOverrideKey({
          networkId: item.networkId,
          address: item.address,
        }),
      ),
    );

    setLiveOverridesByKey((prev) => {
      const next: Record<string, IMarketTokenListStoredLiveOverride> = {};
      let hasChanged = false;

      for (const [key, value] of Object.entries(prev)) {
        if (liveOverrideKeys.has(key)) {
          next[key] = value;
        } else {
          hasChanged = true;
        }
      }

      return hasChanged ? next : prev;
    });
  }, [enabled, subscriptions, subscriptionIdentity]);

  useEffect(() => {
    setLiveOverridesByKey((prev) => {
      let next: Record<string, IMarketTokenListStoredLiveOverride> | undefined;
      const tokenPriceByKey = new Map(
        tokens.map((token) => [getTokenLiveOverrideKey(token), token.price]),
      );

      for (const [key, value] of Object.entries(prev)) {
        const basePrice = getLiveOverrideBasePrice(value);
        const tokenPrice = tokenPriceByKey.get(key);
        if (
          basePrice !== undefined &&
          tokenPrice !== undefined &&
          tokenPrice !== basePrice
        ) {
          next ??= { ...prev };
          delete next[key];
        }
      }

      return next ?? prev;
    });
  }, [tokens]);

  const unsubscribeSubscription = useCallback(
    async (subscription: IMarketHomeTokenSubscription) => {
      await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV({
        networkId: subscription.networkId,
        tokenAddress: subscription.address,
        chartType: subscription.chartType,
        currency: subscription.currency,
      });
    },
    [],
  );

  const subscribeSubscription = useCallback(
    async (subscription: IMarketHomeTokenSubscription) => {
      await backgroundApiProxy.serviceMarketWS.subscribeOHLCV({
        networkId: subscription.networkId,
        tokenAddress: subscription.address,
        chartType: subscription.chartType,
        currency: subscription.currency,
      });
      return subscription;
    },
    [],
  );

  const syncMarketHomeTokenSubscriptions = useCallback(async () => {
    if (isSyncingSubscriptionsRef.current) {
      return;
    }

    isSyncingSubscriptionsRef.current = true;
    let handledRequestId = -1;

    try {
      while (handledRequestId !== syncRequestIdRef.current) {
        handledRequestId = syncRequestIdRef.current;
        const desiredSubscriptions = desiredSubscriptionsRef.current;
        const ownedSubscriptions = ownedSubscriptionsRef.current;
        const subscriptionsToUnsubscribe = [
          ...ownedSubscriptions.values(),
        ].filter((item) => !desiredSubscriptions.has(item.key));

        if (subscriptionsToUnsubscribe.length > 0) {
          const unsubscribeResults = await Promise.allSettled(
            subscriptionsToUnsubscribe.map(unsubscribeSubscription),
          );
          let hasSubscriptionCountChanged = false;
          unsubscribeResults.forEach((result, index) => {
            const subscription = subscriptionsToUnsubscribe[index];
            if (result.status === 'fulfilled') {
              ownedSubscriptionsRef.current.delete(subscription.key);
              hasSubscriptionCountChanged = true;
              return;
            }

            defaultLogger.networkDoctor.log.error({
              info: `Failed to unsubscribe market home token data: ${getErrorMessage(
                result.reason,
              )}`,
            });
          });
          if (hasSubscriptionCountChanged) {
            emitSubscriptionCountChange();
          }
        }

        const latestDesiredSubscriptions = desiredSubscriptionsRef.current;
        const latestOwnedSubscriptions = ownedSubscriptionsRef.current;
        const subscriptionsToSubscribe = [
          ...latestDesiredSubscriptions.values(),
        ].filter((item) => !latestOwnedSubscriptions.has(item.key));

        if (subscriptionsToSubscribe.length > 0) {
          let isConnected = false;
          try {
            await backgroundApiProxy.serviceMarketWS.connect();
            isConnected = true;
          } catch (error) {
            defaultLogger.networkDoctor.log.error({
              info: `Failed to connect market home token websocket: ${getErrorMessage(
                error,
              )}`,
            });
          }

          if (isConnected) {
            const desiredAfterConnect = desiredSubscriptionsRef.current;
            const ownedAfterConnect = ownedSubscriptionsRef.current;
            const subscriptionsToSubscribeAfterConnect = [
              ...desiredAfterConnect.values(),
            ].filter((item) => !ownedAfterConnect.has(item.key));

            const subscribeResults = await Promise.allSettled(
              subscriptionsToSubscribeAfterConnect.map(subscribeSubscription),
            );

            let hasSubscriptionCountChanged = false;
            subscribeResults.forEach((result) => {
              if (result.status === 'rejected') {
                defaultLogger.networkDoctor.log.error({
                  info: `Failed to subscribe market home token data: ${getErrorMessage(
                    result.reason,
                  )}`,
                });
                return;
              }

              const subscription = result.value;
              if (desiredSubscriptionsRef.current.has(subscription.key)) {
                ownedSubscriptionsRef.current.set(
                  subscription.key,
                  subscription,
                );
                hasSubscriptionCountChanged = true;
                return;
              }

              void unsubscribeSubscription(subscription).catch((error) => {
                defaultLogger.networkDoctor.log.error({
                  info: `Failed to rollback market home token subscription: ${getErrorMessage(
                    error,
                  )}`,
                });
              });
            });
            if (hasSubscriptionCountChanged) {
              emitSubscriptionCountChange();
            }
          }
        }
      }
    } finally {
      isSyncingSubscriptionsRef.current = false;
    }

    if (handledRequestId !== syncRequestIdRef.current) {
      void syncMarketHomeTokenSubscriptions();
    }
  }, [
    emitSubscriptionCountChange,
    subscribeSubscription,
    unsubscribeSubscription,
  ]);

  useEffect(() => {
    desiredSubscriptionsRef.current = enabled
      ? new Map(subscriptions.map((item) => [item.key, item]))
      : new Map<string, IMarketHomeTokenSubscription>();
    syncRequestIdRef.current += 1;
    void syncMarketHomeTokenSubscriptions();
  }, [
    enabled,
    subscriptions,
    subscriptionIdentity,
    syncMarketHomeTokenSubscriptions,
  ]);

  useEffect(() => {
    return () => {
      desiredSubscriptionsRef.current = new Map();
      syncRequestIdRef.current += 1;
      void syncMarketHomeTokenSubscriptions();
    };
  }, [syncMarketHomeTokenSubscriptions]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleMarketDataUpdate = (payload: IMarketWSDataUpdatePayload) => {
      if (payload.channel !== 'ohlcv' || !isWsPriceData(payload.data)) {
        return;
      }

      const matchedSubscription = findMatchingSubscription({
        payload,
        subscriptions: subscriptionsRef.current,
      });
      if (!matchedSubscription) {
        return;
      }

      const liveOverrideKey = getTokenLiveOverrideKey({
        networkId: matchedSubscription.networkId,
        address: matchedSubscription.address,
      });
      const nextPrice = payload.data.c;
      const baseToken = findTokenByLiveOverrideKey({
        tokens: tokensRef.current,
        liveOverrideKey,
      });
      const basePrice = baseToken?.price;

      if (basePrice === undefined) {
        setLiveOverridesByKey((prev) => {
          if (!prev[liveOverrideKey]) {
            return prev;
          }

          const next = { ...prev };
          delete next[liveOverrideKey];
          return next;
        });
      } else {
        setLiveOverridesByKey((prev) => {
          if (
            prev[liveOverrideKey]?.price === nextPrice &&
            prev[liveOverrideKey]?.basePrice === basePrice
          ) {
            return prev;
          }

          return {
            ...prev,
            [liveOverrideKey]: {
              networkId: matchedSubscription.networkId,
              address: matchedSubscription.address,
              price: nextPrice,
              basePrice,
            },
          };
        });
      }

      void backgroundApiProxy.serviceMarketWS.clearDataCount({
        address: matchedSubscription.address,
        type: 'ohlcv',
        networkId: matchedSubscription.networkId,
        chartType: matchedSubscription.chartType,
        currency: matchedSubscription.currency,
      });
    };

    appEventBus.on(
      EAppEventBusNames.MarketWSDataUpdate,
      handleMarketDataUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.MarketWSDataUpdate,
        handleMarketDataUpdate,
      );
    };
  }, [enabled]);

  const liveTokenOverrides = useMemo(
    () => Object.values(liveOverridesByKey),
    [liveOverridesByKey],
  );

  return useMemo(() => {
    if (!enabled) {
      return tokens;
    }

    return applyMarketTokenListLiveOverrides({
      tokens,
      liveTokenOverrides,
    });
  }, [enabled, tokens, liveTokenOverrides]);
}
