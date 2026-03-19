import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { debounce, throttle } from 'lodash';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
  useEarnPortfolioInvestmentsAtom,
} from '../../../states/jotai/contexts/earn';

import {
  aggregateEarnPortfolioByProtocol,
  applyEarnPortfolioPatch,
  buildEarnPortfolioInvestmentMap,
  calculateEarnPortfolioEarnings24hValue,
  calculateEarnPortfolioTotalFiatValue,
  materializeEarnPortfolioInvestments,
} from './earnPortfolioShared';
import { streamEarnPortfolio } from './earnPortfolioStream';
import { useEarnAccountKey } from './useEarnAccountKey';

import type { IPortfolioPatch, IRefreshOptions } from './earnPortfolioShared';

export type { IRefreshOptions } from './earnPortfolioShared';

export interface IUseEarnPortfolioReturn {
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}

type IEarnPortfolioState = {
  currentRunId: number;
  rawInvestments: IEarnPortfolioInvestment[];
  rawInvestmentMap: Map<string, IEarnPortfolioInvestment>;
  currentRunTouchedKeys: Set<string>;
  isLoading: boolean;
  hasLoadedOnce: boolean;
};

type IEarnPortfolioAction =
  | {
      type: 'hydrate';
      runId: number;
      investments: IEarnPortfolioInvestment[];
      isOverviewLoaded: boolean;
    }
  | { type: 'reset'; runId: number }
  | { type: 'start'; runId: number; fullRefresh: boolean }
  | { type: 'patches'; runId: number; patches: IPortfolioPatch[] }
  | { type: 'prune'; runId: number; keys: string[] }
  | { type: 'complete'; runId: number; fullRefresh: boolean };

const createEarnPortfolioState = ({
  runId,
  investments,
  isOverviewLoaded,
}: {
  runId: number;
  investments: IEarnPortfolioInvestment[];
  isOverviewLoaded: boolean;
}): IEarnPortfolioState => {
  const rawInvestmentMap = buildEarnPortfolioInvestmentMap(investments);

  return {
    currentRunId: runId,
    rawInvestments: materializeEarnPortfolioInvestments(rawInvestmentMap),
    rawInvestmentMap,
    currentRunTouchedKeys: new Set(),
    isLoading: investments.length === 0,
    hasLoadedOnce: isOverviewLoaded || investments.length > 0,
  };
};

const reduceEarnPortfolioState = (
  state: IEarnPortfolioState,
  action: IEarnPortfolioAction,
): IEarnPortfolioState => {
  switch (action.type) {
    case 'hydrate':
      return createEarnPortfolioState({
        runId: action.runId,
        investments: action.investments,
        isOverviewLoaded: action.isOverviewLoaded,
      });
    case 'reset':
      return {
        currentRunId: action.runId,
        rawInvestments: [],
        rawInvestmentMap: new Map(),
        currentRunTouchedKeys: new Set(),
        isLoading: false,
        hasLoadedOnce: false,
      };
    case 'start':
      return {
        ...state,
        currentRunId: action.runId,
        currentRunTouchedKeys: new Set(),
        isLoading: action.fullRefresh ? true : state.isLoading,
      };
    case 'patches': {
      if (action.runId !== state.currentRunId) {
        return state;
      }

      const nextMap = new Map(state.rawInvestmentMap);
      const nextTouchedKeys = new Set(state.currentRunTouchedKeys);
      action.patches.forEach((patch) => {
        const hasTouchedInCurrentRun = nextTouchedKeys.has(patch.key);
        applyEarnPortfolioPatch({
          portfolioMap: nextMap,
          patch,
          shouldMergeWithExisting: hasTouchedInCurrentRun,
        });
        nextTouchedKeys.add(patch.key);
      });

      return {
        ...state,
        rawInvestmentMap: nextMap,
        rawInvestments: materializeEarnPortfolioInvestments(nextMap),
        currentRunTouchedKeys: nextTouchedKeys,
        hasLoadedOnce: true,
      };
    }
    case 'prune': {
      if (action.runId !== state.currentRunId || action.keys.length === 0) {
        return state;
      }

      const nextMap = new Map(state.rawInvestmentMap);
      action.keys.forEach((key) => nextMap.delete(key));

      return {
        ...state,
        rawInvestmentMap: nextMap,
        rawInvestments: materializeEarnPortfolioInvestments(nextMap),
        hasLoadedOnce: true,
      };
    }
    case 'complete':
      if (action.runId !== state.currentRunId) {
        return state;
      }

      return {
        ...state,
        isLoading: action.fullRefresh ? false : state.isLoading,
        hasLoadedOnce: true,
      };
    default:
      return state;
  }
};

export const useEarnPortfolio = ({
  isActive = true,
}: {
  isActive?: boolean;
} = {}): IUseEarnPortfolioReturn => {
  const isMountedRef = useRef(true);
  const isRouteFocused = useRouteIsFocused();
  const [isVisible, setIsVisible] = useState(() => getCurrentVisibilityState());
  const runContextRef = useRef({
    scopeKey: '',
    runId: 0,
  });
  const isSyncingAtomRef = useRef(false);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const pendingRunRef = useRef<{ options?: IRefreshOptions } | null>(null);
  const queuedPatchRef = useRef<{
    runId: number;
    patches: IPortfolioPatch[];
  }>({
    runId: 0,
    patches: [],
  });
  const invalidateRuns = useCallback(() => {
    runContextRef.current.runId += 1;
  }, []);

  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const accountIdValue = account?.id ?? '';
  const indexedAccountIdValue = indexedAccount?.id ?? '';
  const accountIndexedAccountIdValue = account?.indexedAccountId;

  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();
  const [portfolioCache, setPortfolioCache] = useEarnPortfolioInvestmentsAtom();
  const earnAccountKey = useEarnAccountKey();

  const currentOverviewData =
    earnAccountKey && earnAccount ? earnAccount[earnAccountKey] : undefined;
  const cachedInvestments = useMemo(() => {
    if (!earnAccountKey) {
      return [];
    }

    return portfolioCache[earnAccountKey] || [];
  }, [portfolioCache, earnAccountKey]);

  const [state, dispatch] = useReducer(
    reduceEarnPortfolioState,
    undefined,
    () =>
      createEarnPortfolioState({
        runId: 0,
        investments: cachedInvestments,
        isOverviewLoaded: Boolean(currentOverviewData?.isOverviewLoaded),
      }),
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setIsVisible(getCurrentVisibilityState());
    const removeSubscription = onVisibilityStateChange((visible) => {
      setIsVisible(visible);
    });
    return removeSubscription;
  }, []);

  const scopeKey = `${accountIdValue}_${indexedAccountIdValue}_${
    earnAccountKey || ''
  }`;

  useEffect(() => {
    if (runContextRef.current.scopeKey === scopeKey) {
      return;
    }

    runContextRef.current.scopeKey = scopeKey;
    runContextRef.current.runId += 1;

    dispatch({
      type: 'hydrate',
      runId: runContextRef.current.runId,
      investments: cachedInvestments,
      isOverviewLoaded: Boolean(currentOverviewData?.isOverviewLoaded),
    });
  }, [scopeKey, cachedInvestments, currentOverviewData?.isOverviewLoaded]);

  useEffect(() => {
    if (
      runContextRef.current.scopeKey !== scopeKey ||
      stateRef.current.rawInvestments.length > 0 ||
      cachedInvestments.length === 0
    ) {
      return;
    }

    dispatch({
      type: 'hydrate',
      runId: runContextRef.current.runId,
      investments: cachedInvestments,
      isOverviewLoaded: Boolean(currentOverviewData?.isOverviewLoaded),
    });
  }, [
    cachedInvestments,
    currentOverviewData?.isOverviewLoaded,
    scopeKey,
    stateRef,
  ]);

  const runStreamRef = useRef<(options?: IRefreshOptions) => Promise<void>>(
    async () => {},
  );
  const executeStreamRef = useRef<(options?: IRefreshOptions) => Promise<void>>(
    async () => {},
  );

  const flushQueuedPatchesImmediately = useCallback(
    (runId: number) => {
      if (
        queuedPatchRef.current.runId !== runId ||
        queuedPatchRef.current.patches.length === 0
      ) {
        return;
      }

      const patches = queuedPatchRef.current.patches;
      queuedPatchRef.current = {
        runId,
        patches: [],
      };
      dispatch({
        type: 'patches',
        runId,
        patches,
      });
    },
    [dispatch],
  );

  const throttledFlushQueuedPatches = useMemo(
    () =>
      throttle((runId: number) => {
        flushQueuedPatchesImmediately(runId);
      }, 500),
    [flushQueuedPatchesImmediately],
  );

  const enqueuePatches = useCallback(
    (runId: number, patches: IPortfolioPatch[]) => {
      if (queuedPatchRef.current.runId !== runId) {
        queuedPatchRef.current = {
          runId,
          patches: [],
        };
      }

      queuedPatchRef.current.patches.push(...patches);
      throttledFlushQueuedPatches(runId);
    },
    [throttledFlushQueuedPatches],
  );

  const executeStream = useCallback(
    async (options?: IRefreshOptions) => {
      if (!isActive || !isMountedRef.current) {
        return;
      }

      const nextRunId = runContextRef.current.runId + 1;
      runContextRef.current.runId = nextRunId;

      if (!accountIdValue && !indexedAccountIdValue) {
        dispatch({
          type: 'reset',
          runId: nextRunId,
        });
        return;
      }

      const fullRefresh = !options;
      queuedPatchRef.current = {
        runId: nextRunId,
        patches: [],
      };
      throttledFlushQueuedPatches.cancel();

      dispatch({
        type: 'start',
        runId: nextRunId,
        fullRefresh,
      });

      try {
        await streamEarnPortfolio({
          accountId: accountIdValue,
          networkId: allNetworkId,
          indexedAccountId:
            accountIndexedAccountIdValue || indexedAccountIdValue,
          options,
          existingInvestments: stateRef.current.rawInvestments,
          onAccounts: (accounts) => {
            if (
              nextRunId !== runContextRef.current.runId ||
              !earnAccountKey ||
              !isMountedRef.current
            ) {
              return;
            }

            const previousAccountData =
              actions.current.getEarnAccount(earnAccountKey) || {};

            actions.current.updateEarnAccounts({
              key: earnAccountKey,
              earnAccount: {
                ...previousAccountData,
                accounts: accounts.map((accountItem) => ({
                  tokens: [],
                  networkId: accountItem.networkId,
                  accountAddress: accountItem.accountAddress,
                  publicKey: accountItem.publicKey,
                })),
                isOverviewLoaded: true,
              },
            });
          },
          onPatches: (patches) => {
            if (
              nextRunId !== runContextRef.current.runId ||
              !isMountedRef.current
            ) {
              return;
            }

            enqueuePatches(nextRunId, patches);
          },
          onFinished: ({ staleKeys }) => {
            if (
              nextRunId !== runContextRef.current.runId ||
              !isMountedRef.current
            ) {
              return;
            }

            flushQueuedPatchesImmediately(nextRunId);
            dispatch({
              type: 'prune',
              runId: nextRunId,
              keys: staleKeys,
            });
          },
        });
      } catch (error) {
        defaultLogger.app.error.log(
          `[useEarnPortfolio] stream failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        flushQueuedPatchesImmediately(nextRunId);
        if (nextRunId === runContextRef.current.runId && isMountedRef.current) {
          dispatch({
            type: 'complete',
            runId: nextRunId,
            fullRefresh,
          });
        }
      }
    },
    [
      isActive,
      accountIdValue,
      indexedAccountIdValue,
      accountIndexedAccountIdValue,
      allNetworkId,
      earnAccountKey,
      actions,
      enqueuePatches,
      flushQueuedPatchesImmediately,
      throttledFlushQueuedPatches,
    ],
  );
  executeStreamRef.current = executeStream;

  const mergePendingRun = useCallback(
    (
      current: { options?: IRefreshOptions } | null,
      incoming: { options?: IRefreshOptions },
    ) => {
      if (!current) {
        return incoming;
      }

      if (!current.options || !incoming.options) {
        return {
          options: undefined,
        };
      }

      const sameOptions =
        current.options.provider === incoming.options.provider &&
        current.options.networkId === incoming.options.networkId &&
        current.options.symbol === incoming.options.symbol &&
        current.options.rewardSymbol === incoming.options.rewardSymbol;

      if (sameOptions) {
        return current;
      }

      return {
        options: undefined,
      };
    },
    [],
  );

  const scheduleRun = useCallback(
    async (options?: IRefreshOptions) => {
      const request = {
        options,
      };

      if (inFlightPromiseRef.current) {
        pendingRunRef.current = mergePendingRun(pendingRunRef.current, request);
        return inFlightPromiseRef.current;
      }

      const promise = (async () => {
        let nextRequest: { options?: IRefreshOptions } | null = request;

        while (nextRequest) {
          pendingRunRef.current = null;
          await executeStreamRef.current(nextRequest.options);
          nextRequest = pendingRunRef.current;
        }
      })().finally(() => {
        inFlightPromiseRef.current = null;
      });

      inFlightPromiseRef.current = promise;
      return promise;
    },
    [mergePendingRun],
  );

  useEffect(() => {
    runStreamRef.current = scheduleRun;
  }, [scheduleRun]);

  const isPollingEnabled = isActive && isRouteFocused && isVisible;

  useEffect(() => {
    if (!isPollingEnabled) {
      return undefined;
    }

    let stopped = false;

    const loop = async () => {
      while (!stopped) {
        await runStreamRef.current();
        await timerUtils.wait(timerUtils.getTimeDurationMs({ minute: 3 }));
      }
    };

    void loop();

    return () => {
      stopped = true;
      invalidateRuns();
    };
  }, [invalidateRuns, isPollingEnabled, scopeKey]);

  useEffect(() => {
    if (!isPollingEnabled || (!accountIdValue && !indexedAccountIdValue)) {
      return undefined;
    }

    const handleAccountDataUpdate = () => {
      if (isSyncingAtomRef.current) {
        return;
      }

      void runStreamRef.current();
    };

    appEventBus.on(
      EAppEventBusNames.AccountDataUpdate,
      handleAccountDataUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountDataUpdate,
        handleAccountDataUpdate,
      );
    };
  }, [accountIdValue, indexedAccountIdValue, isPollingEnabled]);

  const aggregatedInvestments = useMemo(
    () => aggregateEarnPortfolioByProtocol(state.rawInvestments),
    [state.rawInvestments],
  );

  const earnTotalFiatValue = useMemo(() => {
    if (state.hasLoadedOnce) {
      return calculateEarnPortfolioTotalFiatValue(state.rawInvestments);
    }

    return new BigNumber(currentOverviewData?.totalFiatValue || 0);
  }, [
    currentOverviewData?.totalFiatValue,
    state.hasLoadedOnce,
    state.rawInvestments,
  ]);

  const earnTotalEarnings24hFiatValue = useMemo(() => {
    if (state.hasLoadedOnce) {
      return calculateEarnPortfolioEarnings24hValue(state.rawInvestments);
    }

    return new BigNumber(currentOverviewData?.earnings24h || 0);
  }, [
    currentOverviewData?.earnings24h,
    state.hasLoadedOnce,
    state.rawInvestments,
  ]);

  const lastSyncedValuesRef = useRef({
    totalFiatValue: currentOverviewData?.totalFiatValue || '',
    earnings24h: currentOverviewData?.earnings24h || '',
  });

  useEffect(() => {
    lastSyncedValuesRef.current = {
      totalFiatValue: currentOverviewData?.totalFiatValue || '',
      earnings24h: currentOverviewData?.earnings24h || '',
    };
  }, [currentOverviewData?.earnings24h, currentOverviewData?.totalFiatValue]);

  const debouncedSyncPortfolioCache = useMemo(
    () =>
      debounce((key: string, investments: IEarnPortfolioInvestment[]) => {
        setPortfolioCache((prev) => ({
          ...prev,
          [key]: investments,
        }));
      }, 300),
    [setPortfolioCache],
  );

  useEffect(() => {
    if (!earnAccountKey || !state.hasLoadedOnce) {
      return;
    }

    debouncedSyncPortfolioCache(earnAccountKey, state.rawInvestments);
  }, [
    debouncedSyncPortfolioCache,
    earnAccountKey,
    state.hasLoadedOnce,
    state.rawInvestments,
  ]);

  const debouncedSyncEarnOverview = useMemo(
    () =>
      debounce((key: string, fiatValue: string, earnings: string) => {
        const latestAccount = actions.current.getEarnAccount(key);
        if (!latestAccount) {
          return;
        }

        if (
          lastSyncedValuesRef.current.totalFiatValue === fiatValue &&
          lastSyncedValuesRef.current.earnings24h === earnings
        ) {
          return;
        }

        isSyncingAtomRef.current = true;
        lastSyncedValuesRef.current = {
          totalFiatValue: fiatValue,
          earnings24h: earnings,
        };

        actions.current.updateEarnAccounts({
          key,
          earnAccount: {
            ...latestAccount,
            totalFiatValue: fiatValue,
            earnings24h: earnings,
          },
        });

        setTimeout(() => {
          isSyncingAtomRef.current = false;
        }, 100);
      }, 300),
    [actions],
  );

  useEffect(() => {
    if (!earnAccountKey || !state.hasLoadedOnce) {
      return;
    }

    debouncedSyncEarnOverview(
      earnAccountKey,
      earnTotalFiatValue.toFixed(),
      earnTotalEarnings24hFiatValue.toFixed(),
    );
  }, [
    debouncedSyncEarnOverview,
    earnAccountKey,
    earnTotalEarnings24hFiatValue,
    earnTotalFiatValue,
    state.hasLoadedOnce,
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      invalidateRuns();
      pendingRunRef.current = null;
      throttledFlushQueuedPatches.cancel();
      debouncedSyncPortfolioCache.cancel();
      debouncedSyncEarnOverview.cancel();
    };
  }, [
    debouncedSyncEarnOverview,
    debouncedSyncPortfolioCache,
    invalidateRuns,
    throttledFlushQueuedPatches,
  ]);

  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      await scheduleRun(options);
    },
    [scheduleRun],
  );

  return {
    investments: aggregatedInvestments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    isLoading: state.isLoading,
    refresh,
  };
};
