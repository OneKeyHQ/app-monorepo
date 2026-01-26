import { useEffect, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHomeTab } from '@onekeyhq/shared/types';

type ITabListStateUpdatePayload = {
  isRefreshing: boolean;
  type: EHomeTab;
  accountId: string;
  networkId: string;
};

type ITokensTabLastState = ITabListStateUpdatePayload & { at: number };

let tokensTabLastState: ITokensTabLastState | undefined;
let tokensTabLastStateListenerInited = false;

function initTokensTabLastStateListener() {
  if (tokensTabLastStateListenerInited) return;
  tokensTabLastStateListenerInited = true;

  const onTabListStateUpdate = (data?: ITabListStateUpdatePayload) => {
    if (!data) return;
    if (data.type !== EHomeTab.TOKENS) return;
    tokensTabLastState = { ...data, at: Date.now() };
  };

  appEventBus.on(EAppEventBusNames.TabListStateUpdate, onTabListStateUpdate);
}

initTokensTabLastStateListener();

export type IRunAfterTokensDoneOptions = {
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
}: IRunAfterTokensDoneOptions): () => void {
  if (!enabled) {
    return () => undefined;
  }

  initTokensTabLastStateListener();

  let cancelled = false;
  let hasTriggered = false;
  let tokensRefreshing: boolean | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startAt = Date.now();

  const last = tokensTabLastState;
  const isLastMatched =
    !!last &&
    (!matchAccountId || !accountId || last.accountId === accountId) &&
    (!matchNetworkId || !networkId || last.networkId === networkId);
  if (isLastMatched) {
    tokensRefreshing = last?.isRefreshing;
  }

  const triggerRef: { current: (triggerName: string) => void } = {
    current: () => undefined,
  };

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
      triggerRef.current('tokensDone');
    }
  }

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

  triggerRef.current = trigger;

  function schedule(delayMs: number) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      if (cancelled || hasTriggered) return;
      const elapsedMs = Date.now() - startAt;
      if (deferWhileRefreshing && tokensRefreshing && elapsedMs < maxWaitMs) {
        schedule(retryDelayMs);
        return;
      }
      trigger(`timeout${Math.round(elapsedMs / 1000)}s`);
    }, delayMs);
  }

  appEventBus.on(EAppEventBusNames.TabListStateUpdate, onTabListStateUpdate);
  schedule(fallbackDelayMs);

  if (isLastMatched && tokensRefreshing === false) {
    void Promise.resolve().then(() => {
      triggerRef.current('tokensDoneCached');
    });
  }

  return () => {
    cancelled = true;
    cleanup();
  };
}

export type IUseRunAfterTokensDoneOptions = Omit<
  IRunAfterTokensDoneOptions,
  'onRun'
> & {
  run: IRunAfterTokensDoneOptions['onRun'];
};

export function useRunAfterTokensDone({
  run,
  enabled,
  fallbackDelayMs,
  deferWhileRefreshing,
  retryDelayMs,
  maxWaitMs,
  accountId,
  networkId,
  matchAccountId,
  matchNetworkId,
}: IUseRunAfterTokensDoneOptions) {
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    return runAfterTokensDone({
      enabled,
      fallbackDelayMs,
      deferWhileRefreshing,
      retryDelayMs,
      maxWaitMs,
      accountId,
      networkId,
      matchAccountId,
      matchNetworkId,
      onRun: (trigger) => runRef.current(trigger),
    });
  }, [
    enabled,
    fallbackDelayMs,
    deferWhileRefreshing,
    retryDelayMs,
    maxWaitMs,
    accountId,
    networkId,
    matchAccountId,
    matchNetworkId,
  ]);
}
