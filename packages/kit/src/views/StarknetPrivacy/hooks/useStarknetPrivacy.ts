import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AppPagerPageContext } from '@onekeyhq/kit/src/components/AppPager/context';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import type {
  IStrk20AccountPrivacyState,
  IStrk20PrivacyNetworkConfig,
  IStrk20PrivateBalances,
  IStrk20SequencingState,
} from '@onekeyhq/shared/types/starknetPrivacy';
import {
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';

import { formatMockMessage } from '../utils/starknetPrivacyUtils';

import { useStarknetPrivacySession } from './useStarknetPrivacySession';

/** Translation ids used across the hooks below: `mapStrk20Error`'s copy is
 * either a real `ETranslations` id or, while some strings are still mock-only,
 * an `ETranslationsMock` id. */
type IStrk20ErrorTranslationKey = ETranslations | ETranslationsMock;

/**
 * Every read below goes through a `@backgroundMethod()` whose body still
 * throws while track A lands. A rejected promise must degrade to the
 * "unavailable" state, so nothing here is allowed to propagate.
 */
export type IStarknetPrivacyAvailability = {
  isAvailable: boolean;
  config?: IStrk20PrivacyNetworkConfig;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
};

export function useStarknetPrivacyAvailability({
  networkId,
  accountId,
  enabled = true,
}: {
  networkId: string | undefined;
  /**
   * Pass this whenever the answer is account-specific (watching/external
   * accounts must read as unavailable). First-use deployment is handled separately. Omit it for
   * a network-only check, e.g. reading `config` alone.
   */
  accountId?: string;
  enabled?: boolean;
}): IStarknetPrivacyAvailability {
  const { result, isLoading, run } = usePromiseResult(
    async (): Promise<Omit<IStarknetPrivacyAvailability, 'isLoading'>> => {
      if (!enabled || !networkId) {
        return { isAvailable: false };
      }
      try {
        const isAvailable =
          await backgroundApiProxy.serviceStarknetPrivacy.isPrivacyAvailable({
            networkId,
            accountId,
          });
        if (!isAvailable) {
          return { isAvailable: false };
        }
        const config =
          await backgroundApiProxy.serviceStarknetPrivacy.getPrivacyConfig({
            networkId,
          });
        return { isAvailable: true, config };
      } catch (error) {
        return {
          isAvailable: false,
          errorKey: mapStrk20Error(error).translationKey,
        };
      }
    },
    [accountId, enabled, networkId],
    {
      watchLoading: true,
      resumeOnEffectReconnect: true,
      revalidateOnFocus: true,
      initResult: { isAvailable: false },
      // Keyed on accountId too: isPrivacyAvailable's answer differs per
      // account (watching/external/undeployed), so a network-only caller and
      // an account-scoped caller must not share a cache entry.
      swrKey: networkId
        ? `starknet-privacy-availability-${networkId}-${accountId ?? 'network'}`
        : undefined,
    },
  );

  useEffect(() => {
    if (!enabled || !networkId) return;
    const reload = () => void run();
    const onRpcChanged = ({ networkIds }: { networkIds: string[] }) => {
      if (networkIds.includes(networkId)) reload();
    };
    appEventBus.on(EAppEventBusNames.CustomRpcChanged, onRpcChanged);
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, reload);
    return () => {
      appEventBus.off(EAppEventBusNames.CustomRpcChanged, onRpcChanged);
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, reload);
    };
  }, [enabled, networkId, run]);

  return { ...result, isLoading };
}

export type IStarknetPrivacyAccount = {
  state?: IStrk20AccountPrivacyState;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
  reload: () => void;
};

const REGISTER_PENDING_POLLING_INTERVAL = 10 * 1000;

export function useStarknetPrivacyAccountState({
  networkId,
  accountId,
  enabled = true,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  enabled?: boolean;
}): IStarknetPrivacyAccount {
  const scopeKey = [networkId, accountId, enabled].join('|');
  // Each read settles a pending register from its receipt, so poll until it does.
  const [isRegisterPending, setIsRegisterPending] = useState(false);
  const { result, isLoading, run } = usePromiseResult(
    async (): Promise<
      Omit<IStarknetPrivacyAccount, 'isLoading' | 'reload'> & {
        scopeKey?: string;
      }
    > => {
      if (!enabled || !networkId || !accountId) {
        return { scopeKey };
      }
      try {
        const state =
          await backgroundApiProxy.serviceStarknetPrivacy.getAccountPrivacyState(
            { networkId, accountId },
          );
        return { state, scopeKey };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey, scopeKey };
      }
    },
    [accountId, enabled, networkId, scopeKey],
    {
      watchLoading: true,
      initResult: {},
      resumeOnEffectReconnect: true,
      // Broadcast callbacks can run while the confirmation modal still owns focus.
      revalidateOnFocus: true,
      pollingInterval: isRegisterPending
        ? REGISTER_PENDING_POLLING_INTERVAL
        : undefined,
      runImmediatelyOnPollingIntervalChange: true,
    },
  );

  useEffect(() => {
    if (result.scopeKey !== scopeKey || !result.state) {
      setIsRegisterPending(false);
      return;
    }
    setIsRegisterPending(
      isStrk20RegisterPending(result.state) ||
        result.state.lastTransfer?.status === 'pending' ||
        Boolean(result.state.activationTxid),
    );
  }, [result, scopeKey]);

  const reload = useCallback(() => {
    void run();
  }, [run]);

  return {
    ...(result.scopeKey === scopeKey ? result : {}),
    isLoading: isLoading || result.scopeKey !== scopeKey,
    reload,
  };
}

const SEQUENCING_POLLING_INTERVAL = 10 * 1000;

export type IStarknetPrivacySequencing = {
  sequencing?: IStrk20SequencingState;
};

/**
 * Polls while the host surface is focused. The wait is never modal: callers
 * render a disabled action with the countdown instead of blocking the screen.
 */
export function useStarknetPrivacySequencing({
  networkId,
  accountId,
  enabled = true,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  enabled?: boolean;
}): IStarknetPrivacySequencing {
  const scopeKey = [networkId, accountId, enabled].join('|');
  const { isFocused: isTabFocused } = useContext(AppPagerPageContext);
  const { result, run, setStopPolling } = usePromiseResult(
    async (): Promise<IStarknetPrivacySequencing & { scopeKey?: string }> => {
      if (!enabled || !networkId || !accountId) {
        return { scopeKey };
      }
      const sequencing = await backgroundApiProxy.serviceStarknetPrivacy
        .getSequencingState({ networkId, accountId })
        .catch(() => undefined);
      return { sequencing, scopeKey };
    },
    [accountId, enabled, networkId, scopeKey],
    {
      initResult: {},
      resumeOnEffectReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: enabled ? SEQUENCING_POLLING_INTERVAL : undefined,
      runImmediatelyOnPollingIntervalChange: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isTabFocused,
    },
  );

  useEffect(() => {
    if (!enabled || !networkId || !accountId) return;
    const onConfirmed = (tx: { networkId: string; accountId: string }) => {
      if (
        tx.networkId === networkId &&
        tx.accountId === accountId &&
        !setStopPolling(false)
      )
        void run();
    };
    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, onConfirmed);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalPendingTxConfirmed, onConfirmed);
    };
  }, [accountId, enabled, networkId, run, setStopPolling]);

  useEffect(() => {
    if (result.scopeKey !== scopeKey) return;
    const status = result.sequencing?.status;
    setStopPolling(
      status === EStrk20SequencingStatus.ActivationRequired ||
        status === EStrk20SequencingStatus.Ready ||
        status === EStrk20SequencingStatus.Unavailable,
    );
  }, [result, scopeKey, setStopPolling]);

  return result.scopeKey === scopeKey ? result : {};
}

export type IStarknetPrivateBalances = {
  errorCode?: EStrk20ErrorCode;
  balances?: IStrk20PrivateBalances;
  lastSyncedAt?: number;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
  isRefreshing: boolean;
  reload: () => void;
  refreshSilently: () => void;
};

export function useStarknetPrivateBalances({
  networkId,
  accountId,
  tokenAddress,
  enabled = true,
  requireFresh = false,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  tokenAddress: string | undefined;
  enabled?: boolean;
  requireFresh?: boolean;
}): IStarknetPrivateBalances {
  const intl = useIntl();
  const { isFocused: isTabFocused } = useContext(AppPagerPageContext);
  const lastSuccess = useRef<
    | {
        scopeKey: string;
        balances: IStrk20PrivateBalances;
        lastSyncedAt: number;
      }
    | undefined
  >(undefined);
  const scopeRef = useRef('');
  const refreshInFlight = useRef<string>(undefined);
  const session = useStarknetPrivacySession({
    enabled,
    onLock: () => {
      lastSuccess.current = undefined;
    },
    skipUnlock: () => refreshInFlight.current === scopeRef.current,
  });
  const scopeKey = [
    networkId,
    accountId,
    tokenAddress,
    enabled,
    requireFresh,
    session,
  ].join('|');
  scopeRef.current = scopeKey;
  const requestedRefresh = useRef<
    { scopeKey: string; allowPrompt: boolean } | undefined
  >(undefined);
  const [refreshingScope, setRefreshingScope] = useState<string>();
  const { result: cached } = usePromiseResult(
    async () => {
      if (!enabled || requireFresh || !networkId || !accountId)
        return undefined;
      const balance = await backgroundApiProxy.serviceStarknetPrivacy
        .getCachedPrivateBalances({
          networkId,
          accountId,
          tokenAddresses: tokenAddress ? [tokenAddress] : undefined,
        })
        .catch(() => undefined);
      return balance
        ? { balances: balance, lastSyncedAt: balance.lastSyncedAt, scopeKey }
        : undefined;
    },
    [accountId, enabled, networkId, requireFresh, scopeKey, tokenAddress],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isTabFocused,
      resumeOnEffectReconnect: true,
    },
  );
  const { result, run } = usePromiseResult(
    async (): Promise<
      Omit<
        IStarknetPrivateBalances,
        'isLoading' | 'isRefreshing' | 'reload' | 'refreshSilently'
      > & { scopeKey?: string }
    > => {
      const requested = requestedRefresh.current;
      requestedRefresh.current = undefined;
      if (!enabled || !networkId || !accountId) {
        return { scopeKey };
      }
      const refresh = requested?.scopeKey === scopeKey ? requested : undefined;
      try {
        const service = backgroundApiProxy.serviceStarknetPrivacy;
        const params = {
          networkId,
          accountId,
          tokenAddresses: tokenAddress ? [tokenAddress] : undefined,
        };
        const balances =
          refresh || requireFresh
            ? await service.refreshPrivateBalances({
                ...params,
                allowPrompt: refresh?.allowPrompt ?? false,
              })
            : await service.getPrivateBalances(params);
        if (refresh?.allowPrompt && scopeRef.current === scopeKey) {
          appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
        }
        const next = {
          balances,
          lastSyncedAt: balances.lastSyncedAt,
          scopeKey,
        };
        if (scopeRef.current === scopeKey) lastSuccess.current = next;
        return next;
      } catch (error) {
        const cancelled = errorUtils.isErrorByClassName({
          error,
          className: [EOneKeyErrorClassNames.PasswordPromptDialogCancel],
        });
        const { translationKey: errorKey, code: errorCode } = cancelled
          ? {
              translationKey:
                ETranslations.privacy_balance_verification_pending__msg,
              code: EStrk20ErrorCode.Locked,
            }
          : mapStrk20Error(error);
        if (
          refresh?.allowPrompt &&
          scopeRef.current === scopeKey &&
          errorCode !== EStrk20ErrorCode.Locked &&
          errorCode !== EStrk20ErrorCode.KeyMismatch
        ) {
          Toast.error({
            title: formatMockMessage(
              intl,
              errorCode === EStrk20ErrorCode.Unknown
                ? ETranslations.global_sync_error
                : errorKey,
            ),
          });
        }
        if (
          requireFresh ||
          errorCode === EStrk20ErrorCode.KeyMismatch ||
          errorCode === EStrk20ErrorCode.Unavailable
        ) {
          if (lastSuccess.current?.scopeKey === scopeKey)
            lastSuccess.current = undefined;
          return { errorKey, errorCode, scopeKey };
        }
        return {
          ...(lastSuccess.current?.scopeKey === scopeKey
            ? lastSuccess.current
            : {}),
          errorKey,
          errorCode,
          scopeKey,
        };
      }
    },
    [accountId, enabled, intl, networkId, requireFresh, tokenAddress, scopeKey],
    {
      initResult: {},
      overrideIsFocused: (isPageFocused) => isPageFocused && isTabFocused,
      resumeOnEffectReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: enabled && !requireFresh ? 60_000 : undefined,
      runImmediatelyOnPollingIntervalChange: true,
    },
  );

  const requestRefresh = useCallback(
    (allowPrompt: boolean) => {
      if (refreshInFlight.current === scopeKey) return;
      const request = { scopeKey, allowPrompt };
      requestedRefresh.current = request;
      if (allowPrompt) {
        refreshInFlight.current = scopeKey;
        setRefreshingScope(scopeKey);
      }
      void run().finally(() => {
        if (requestedRefresh.current === request) {
          requestedRefresh.current = undefined;
        }
        if (allowPrompt && refreshInFlight.current === scopeKey) {
          refreshInFlight.current = undefined;
          setRefreshingScope(undefined);
        }
      });
    },
    [run, scopeKey],
  );

  const reload = useCallback(() => requestRefresh(true), [requestRefresh]);
  const refreshSilently = useCallback(
    () => requestRefresh(false),
    [requestRefresh],
  );
  const current = result.scopeKey === scopeKey ? result : undefined;
  const canShowCached =
    current?.errorCode !== EStrk20ErrorCode.KeyMismatch &&
    current?.errorCode !== EStrk20ErrorCode.Unavailable &&
    cached?.scopeKey === scopeKey;
  return {
    ...(canShowCached ? cached : {}),
    ...current,
    isLoading: !current && !canShowCached,
    isRefreshing: refreshingScope === scopeKey,
    reload,
    refreshSilently,
  };
}

export function isStrk20Registered(
  state: IStrk20AccountPrivacyState | undefined,
): boolean {
  return state?.optInStatus === EStrk20OptInStatus.Registered;
}

/** Consented alone is not pending: the register tx may never have been sent. */
export function isStrk20RegisterPending(
  state: IStrk20AccountPrivacyState | undefined,
): boolean {
  return state?.optInStatus === EStrk20OptInStatus.RegisterPending;
}

export function isStrk20Mismatch(
  state: IStrk20AccountPrivacyState | undefined,
): boolean {
  return state?.optInStatus === EStrk20OptInStatus.Mismatch;
}

export function isStrk20SequencingWaiting(
  sequencing: IStrk20SequencingState | undefined,
): boolean {
  return sequencing?.status === EStrk20SequencingStatus.Waiting;
}
