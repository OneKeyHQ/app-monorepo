import { useEffect, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHomeTab } from '@onekeyhq/shared/types';

export type RunAfterTokensDoneOptions = {
  enabled?: boolean;
  onRun: (trigger: string) => void | Promise<void>;
  fallbackDelayMs?: number;
  deferWhileRefreshing?: boolean;
  retryDelayMs?: number;
  maxWaitMs?: number;
  accountId?: string;
  networkId?: string;
  matchAccountId?: boolean;
  matchNetworkId?: boolean;
};

type ITabListStateUpdatePayload = {
  isRefreshing: boolean;
  type: EHomeTab;
  accountId: string;
  networkId: string;
};

export function runAfterTokensDone({
  enabled = true,
  onRun,
  fallbackDelayMs = 15_000,
  deferWhileRefreshing = false,
  retryDelayMs = 2000,
  maxWaitMs = 30_000,
  accountId,
  networkId,
  matchAccountId = false,
  matchNetworkId = false,
}: RunAfterTokensDoneOptions): () => void {
  if (!enabled) {
    return () => undefined;
  }

  let cancelled = false;
  let hasTriggered = false;
  let tokensRefreshing: boolean | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startAt = Date.now();

  function cleanup() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    appEventBus.off(EAppEventBusNames.TabListStateUpdate, onTabListStateUpdate);
  }

  function trigger(triggerName: string) {
    if (cancelled || hasTriggered) return;
    hasTriggered = true;
    cleanup();
    Promise.resolve(onRun(triggerName)).catch((error) => {
      console.error(error);
    });
  }

  function onTabListStateUpdate(data?: ITabListStateUpdatePayload) {
    if (!data) return;
    if (data.type !== EHomeTab.TOKENS) return;
    if (matchAccountId && accountId && data.accountId !== accountId) return;
    if (matchNetworkId && networkId && data.networkId !== networkId) return;

    if (data.isRefreshing === true) {
      tokensRefreshing = true;
      return;
    }
    if (data.isRefreshing === false) {
      tokensRefreshing = false;
      trigger('tokensDone');
    }
  }

  function schedule(delayMs: number) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      if (cancelled || hasTriggered) return;
      const elapsedMs = Date.now() - startAt;
      if (
        deferWhileRefreshing &&
        tokensRefreshing &&
        elapsedMs < maxWaitMs
      ) {
        schedule(retryDelayMs);
        return;
      }
      trigger(`timeout${Math.round(elapsedMs / 1000)}s`);
    }, delayMs);
  }

  appEventBus.on(EAppEventBusNames.TabListStateUpdate, onTabListStateUpdate);
  schedule(fallbackDelayMs);

  return () => {
    cancelled = true;
    cleanup();
  };
}

export type UseRunAfterTokensDoneOptions = Omit<
  RunAfterTokensDoneOptions,
  'onRun'
> & {
  run: RunAfterTokensDoneOptions['onRun'];
};

export function useRunAfterTokensDone({
  run,
  ...options
}: UseRunAfterTokensDoneOptions) {
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    return runAfterTokensDone({
      ...options,
      onRun: (trigger) => runRef.current(trigger),
    });
  }, [
    options.enabled,
    options.fallbackDelayMs,
    options.deferWhileRefreshing,
    options.retryDelayMs,
    options.maxWaitMs,
    options.accountId,
    options.networkId,
    options.matchAccountId,
    options.matchNetworkId,
  ]);
}
