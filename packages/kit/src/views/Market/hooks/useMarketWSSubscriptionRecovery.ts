import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components/src/hooks/useVisibilityChange';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';

type IMarketWSChannel = 'ohlcv' | 'tokenTxs';

interface IUseMarketWSSubscriptionRecoveryParams {
  enabled?: boolean;
  networkId: string;
  tokenAddress: string;
  channel: IMarketWSChannel;
  currency?: string;
  chartType?: string;
  selfHealInterval?: number;
}

interface IMarketWSSubscriptionRecoveryResult {
  markSubscriptionActivity: () => void;
  restoreSubscription: () => Promise<void>;
}

interface IMarketWSRestoreState {
  canRestore: boolean;
  identity: string;
  revision: number;
}

export const MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL = 30_000;
export const MARKET_WS_SUBSCRIPTION_STALE_THRESHOLD = 60_000;

export function useMarketWSSubscriptionRecovery({
  enabled = true,
  networkId,
  tokenAddress,
  channel,
  currency = 'usd',
  chartType,
  selfHealInterval = MARKET_WS_SUBSCRIPTION_SELF_HEAL_INTERVAL,
}: IUseMarketWSSubscriptionRecoveryParams): IMarketWSSubscriptionRecoveryResult {
  const canRestore = Boolean(enabled && networkId && tokenAddress);
  const subscriptionIdentity = [
    channel,
    networkId,
    tokenAddress,
    currency,
    chartType ?? '',
  ].join(':');
  const [isVisible, setIsVisible] = useState<boolean>(() =>
    getCurrentVisibilityState(),
  );
  const isVisibleRef = useRef(isVisible);
  const restoreStateRef = useRef<IMarketWSRestoreState>({
    canRestore: false,
    identity: '',
    revision: 0,
  });
  const lastActivityAtRef = useRef<number>(Date.now());

  useEffect(() => {
    restoreStateRef.current = {
      canRestore,
      identity: subscriptionIdentity,
      revision: restoreStateRef.current.revision + 1,
    };
    lastActivityAtRef.current = Date.now();

    return () => {
      restoreStateRef.current = {
        ...restoreStateRef.current,
        canRestore: false,
        revision: restoreStateRef.current.revision + 1,
      };
    };
  }, [canRestore, subscriptionIdentity]);

  const markSubscriptionActivity = useCallback((): void => {
    lastActivityAtRef.current = Date.now();
  }, []);

  const restoreSubscription = useCallback(async (): Promise<void> => {
    const restoreState = restoreStateRef.current;
    if (
      !restoreState.canRestore ||
      restoreState.identity !== subscriptionIdentity ||
      !isVisibleRef.current
    ) {
      return;
    }

    try {
      await backgroundApiProxy.serviceMarketWS.connect();

      const latestRestoreState = restoreStateRef.current;
      if (
        !latestRestoreState.canRestore ||
        latestRestoreState.identity !== subscriptionIdentity ||
        latestRestoreState.revision !== restoreState.revision ||
        !isVisibleRef.current
      ) {
        return;
      }

      await backgroundApiProxy.serviceMarketWS.ensureSubscription({
        networkId,
        tokenAddress,
        currency,
        chartType,
        channel,
      });
      lastActivityAtRef.current = Date.now();
    } catch (error) {
      console.error(`Failed to restore market ${channel} subscription:`, error);
    }
  }, [
    networkId,
    tokenAddress,
    currency,
    chartType,
    channel,
    subscriptionIdentity,
  ]);

  useEffect(() => {
    const currentVisibility = getCurrentVisibilityState();
    isVisibleRef.current = currentVisibility;
    setIsVisible(currentVisibility);

    if (!canRestore) {
      return;
    }

    const removeSubscription = onVisibilityStateChange((visible) => {
      isVisibleRef.current = visible;
      setIsVisible(visible);
      if (visible) {
        void restoreSubscription();
      }
    });

    return removeSubscription;
  }, [canRestore, restoreSubscription]);

  useInterval(
    () => {
      if (
        Date.now() - lastActivityAtRef.current <
        MARKET_WS_SUBSCRIPTION_STALE_THRESHOLD
      ) {
        return;
      }

      void restoreSubscription();
    },
    canRestore && isVisible ? selfHealInterval : null,
  );

  return {
    markSubscriptionActivity,
    restoreSubscription,
  };
}
