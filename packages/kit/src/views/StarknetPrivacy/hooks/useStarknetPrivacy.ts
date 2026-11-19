import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AppPagerPageContext } from '@onekeyhq/kit/src/components/AppPager/context';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import type {
  EStrk20SetupRequirement,
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
    if (!enabled) return;
    const reload = () => void run();
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reload);
    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reload);
    };
  }, [enabled, run]);

  return { ...result, isLoading };
}

/** An unavailable fee remains visible and can be retried before proving. */
export function useStarknetPrivacyProtocolFee({
  networkId,
  enabled = true,
}: {
  networkId: string | undefined;
  enabled?: boolean;
}): {
  fee?: string;
  errorKey?: ETranslationsMock;
  isLoading?: boolean;
  reload: () => void;
} {
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!enabled || !networkId) {
        return undefined;
      }
      try {
        const fee =
          await backgroundApiProxy.serviceStarknetPrivacy.getProtocolFee({
            networkId,
          });
        return { fee, errorKey: undefined };
      } catch {
        return {
          fee: undefined,
          errorKey: ETranslationsMock.starknet_privacy_error_fee,
        };
      }
    },
    [enabled, networkId],
    {
      watchLoading: true,
      revalidateOnFocus: true,
      resumeOnEffectReconnect: true,
    },
  );
  const reload = useCallback(() => {
    void run();
  }, [run]);
  return { ...result, isLoading, reload };
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
        setIsRegisterPending(false);
        return { scopeKey };
      }
      try {
        const state =
          await backgroundApiProxy.serviceStarknetPrivacy.getAccountPrivacyState(
            { networkId, accountId },
          );
        setIsRegisterPending(
          isStrk20RegisterPending(state) ||
            state.lastTransfer?.status === 'pending' ||
            Boolean(state.activationTxid),
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
  errorKey?: IStrk20ErrorTranslationKey;
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
  const { result } = usePromiseResult(
    async (): Promise<IStarknetPrivacySequencing & { scopeKey?: string }> => {
      if (!enabled || !networkId || !accountId) {
        return { scopeKey };
      }
      try {
        const sequencing =
          await backgroundApiProxy.serviceStarknetPrivacy.getSequencingState({
            networkId,
            accountId,
          });
        return { sequencing, scopeKey };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey, scopeKey };
      }
    },
    [accountId, enabled, networkId, scopeKey],
    {
      initResult: {},
      resumeOnEffectReconnect: true,
      pollingInterval: enabled ? SEQUENCING_POLLING_INTERVAL : undefined,
      runImmediatelyOnPollingIntervalChange: true,
      checkIsFocused: true,
    },
  );

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
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  tokenAddress: string | undefined;
  enabled?: boolean;
}): IStarknetPrivateBalances {
  const { isFocused: isTabFocused } = useContext(AppPagerPageContext);
  const [lockGeneration, setLockGeneration] = useState(0);
  const scopeKey = [
    networkId,
    accountId,
    tokenAddress,
    enabled,
    lockGeneration,
  ].join('|');
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const lastSuccess = useRef<
    | {
        scopeKey: string;
        balances: IStrk20PrivateBalances;
        lastSyncedAt: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    const onLock = () => {
      lastSuccess.current = undefined;
      setLockGeneration((value) => value + 1);
    };
    appEventBus.on(EAppEventBusNames.LockApp, onLock);
    return () => {
      appEventBus.off(EAppEventBusNames.LockApp, onLock);
    };
  }, []);
  const requestedRefresh = useRef<
    { scopeKey: string; allowPrompt: boolean } | undefined
  >(undefined);
  const refreshInFlight = useRef(false);
  const [refreshingScope, setRefreshingScope] = useState<string>();
  const { result: cached } = usePromiseResult(
    async () => {
      if (!enabled || !networkId || !accountId) return undefined;
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
    [accountId, enabled, networkId, scopeKey, tokenAddress],
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
      try {
        const service = backgroundApiProxy.serviceStarknetPrivacy;
        const params = {
          networkId,
          accountId,
          tokenAddresses: tokenAddress ? [tokenAddress] : undefined,
        };
        const refresh =
          requested?.scopeKey === scopeKey ? requested : undefined;
        const balances = refresh
          ? await service.refreshPrivateBalances({
              ...params,
              allowPrompt: refresh.allowPrompt,
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
    [accountId, enabled, networkId, tokenAddress, scopeKey],
    {
      initResult: {},
      overrideIsFocused: (isPageFocused) => isPageFocused && isTabFocused,
      resumeOnEffectReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: enabled ? 60_000 : undefined,
      runImmediatelyOnPollingIntervalChange: true,
    },
  );

  useEffect(() => {
    const onUnlock = () => {
      if (!refreshInFlight.current) void run();
    };
    appEventBus.on(EAppEventBusNames.UnlockApp, onUnlock);
    return () => {
      appEventBus.off(EAppEventBusNames.UnlockApp, onUnlock);
    };
  }, [run]);

  const requestRefresh = useCallback(
    (allowPrompt: boolean) => {
      if (refreshInFlight.current) return;
      const request = { scopeKey, allowPrompt };
      requestedRefresh.current = request;
      if (allowPrompt) {
        refreshInFlight.current = true;
        setRefreshingScope(scopeKey);
      }
      void run().finally(() => {
        if (requestedRefresh.current === request) {
          requestedRefresh.current = undefined;
        }
        if (allowPrompt) {
          refreshInFlight.current = false;
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

export function useStarknetRecipientRequirement({
  networkId,
  accountId,
  tokenAddress,
  recipient,
  enabled = true,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  tokenAddress: string | undefined;
  recipient: string | undefined;
  enabled?: boolean;
}): {
  requirement?: EStrk20SetupRequirement;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
  reload: () => void;
} {
  const scopeKey = [
    networkId,
    accountId,
    tokenAddress,
    recipient,
    enabled,
  ].join('|');
  const { result, isLoading, run } = usePromiseResult(
    async (): Promise<{
      requirement?: EStrk20SetupRequirement;
      errorKey?: IStrk20ErrorTranslationKey;
      scopeKey?: string;
    }> => {
      if (!enabled || !networkId || !accountId || !tokenAddress || !recipient) {
        return { scopeKey };
      }
      try {
        const requirement =
          await backgroundApiProxy.serviceStarknetPrivacy.getRecipientRequirement(
            { networkId, accountId, tokenAddress, recipient },
          );
        return { requirement, scopeKey };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey, scopeKey };
      }
    },
    [accountId, enabled, networkId, recipient, tokenAddress, scopeKey],
    {
      watchLoading: true,
      initResult: {},
      debounced: 600,
      resumeOnEffectReconnect: true,
    },
  );

  const reload = useCallback(() => {
    void run();
  }, [run]);
  return {
    ...(result.scopeKey === scopeKey ? result : {}),
    isLoading: isLoading || result.scopeKey !== scopeKey,
    reload,
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
