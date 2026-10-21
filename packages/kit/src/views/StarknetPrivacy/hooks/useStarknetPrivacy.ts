import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  ETranslations,
  ETranslationsMock,
} from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import type {
  EStrk20SetupRequirement,
  IStrk20AccountPrivacyState,
  IStrk20PrivacyNetworkConfig,
  IStrk20PrivateBalances,
  IStrk20SequencingState,
} from '@onekeyhq/shared/types/starknetPrivacy';
import {
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
   * accounts and undeployed accounts must read as unavailable). Omit it for
   * a network-only check, e.g. reading `config` alone.
   */
  accountId?: string;
  enabled?: boolean;
}): IStarknetPrivacyAvailability {
  const { result, isLoading } = usePromiseResult(
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
        return { isAvailable: Boolean(config?.enabled), config };
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
      initResult: { isAvailable: false },
      // Keyed on accountId too: isPrivacyAvailable's answer differs per
      // account (watching/external/undeployed), so a network-only caller and
      // an account-scoped caller must not share a cache entry.
      swrKey: networkId
        ? `starknet-privacy-availability-${networkId}-${accountId ?? 'network'}`
        : undefined,
    },
  );

  return { ...result, isLoading };
}

/** The pool's current fee in STRK, or undefined while unknown. */
export function useStarknetPrivacyProtocolFee({
  networkId,
  enabled = true,
}: {
  networkId: string | undefined;
  enabled?: boolean;
}): string | undefined {
  const { result } = usePromiseResult(async () => {
    if (!enabled || !networkId) {
      return undefined;
    }
    try {
      return await backgroundApiProxy.serviceStarknetPrivacy.getProtocolFee({
        networkId,
      });
    } catch {
      return undefined;
    }
  }, [enabled, networkId]);
  return result;
}

export type IStarknetPrivacyAccount = {
  state?: IStrk20AccountPrivacyState;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
  reload: () => void;
};

export function useStarknetPrivacyAccountState({
  networkId,
  accountId,
  enabled = true,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  enabled?: boolean;
}): IStarknetPrivacyAccount {
  const { result, isLoading, run } = usePromiseResult(
    async (): Promise<
      Omit<IStarknetPrivacyAccount, 'isLoading' | 'reload'>
    > => {
      if (!enabled || !networkId || !accountId) {
        return {};
      }
      try {
        const state =
          await backgroundApiProxy.serviceStarknetPrivacy.getAccountPrivacyState(
            { networkId, accountId },
          );
        return { state };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey };
      }
    },
    [accountId, enabled, networkId],
    { watchLoading: true, initResult: {} },
  );

  const reload = useCallback(() => {
    void run();
  }, [run]);

  return { ...result, isLoading, reload };
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
  const { result } = usePromiseResult(
    async (): Promise<IStarknetPrivacySequencing> => {
      if (!enabled || !networkId || !accountId) {
        return {};
      }
      try {
        const sequencing =
          await backgroundApiProxy.serviceStarknetPrivacy.getSequencingState({
            networkId,
            accountId,
          });
        return { sequencing };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey };
      }
    },
    [accountId, enabled, networkId],
    {
      initResult: {},
      pollingInterval: enabled ? SEQUENCING_POLLING_INTERVAL : undefined,
      checkIsFocused: true,
    },
  );

  return result;
}

export type IStarknetPrivateBalances = {
  balances?: IStrk20PrivateBalances;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
  reload: () => void;
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
  const { result, isLoading, run } = usePromiseResult(
    async (): Promise<
      Omit<IStarknetPrivateBalances, 'isLoading' | 'reload'>
    > => {
      if (!enabled || !networkId || !accountId) {
        return {};
      }
      try {
        const balances =
          await backgroundApiProxy.serviceStarknetPrivacy.refreshPrivateBalances(
            {
              networkId,
              accountId,
              tokenAddresses: tokenAddress ? [tokenAddress] : undefined,
            },
          );
        return { balances };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey };
      }
    },
    [accountId, enabled, networkId, tokenAddress],
    { watchLoading: true, initResult: {} },
  );

  const reload = useCallback(() => {
    void run();
  }, [run]);

  return { ...result, isLoading, reload };
}

export function useStarknetRecipientRequirement({
  networkId,
  accountId,
  tokenAddress,
  recipient,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  tokenAddress: string | undefined;
  recipient: string | undefined;
}): {
  requirement?: EStrk20SetupRequirement;
  errorKey?: IStrk20ErrorTranslationKey;
  isLoading?: boolean;
} {
  const { result, isLoading } = usePromiseResult(
    async (): Promise<{
      requirement?: EStrk20SetupRequirement;
      errorKey?: IStrk20ErrorTranslationKey;
    }> => {
      if (!networkId || !accountId || !tokenAddress || !recipient) {
        return {};
      }
      try {
        const requirement =
          await backgroundApiProxy.serviceStarknetPrivacy.getRecipientRequirement(
            { networkId, accountId, tokenAddress, recipient },
          );
        return { requirement };
      } catch (error) {
        return { errorKey: mapStrk20Error(error).translationKey };
      }
    },
    [accountId, networkId, recipient, tokenAddress],
    { watchLoading: true, initResult: {}, debounced: 600 },
  );

  return { ...result, isLoading };
}

export function isStrk20Registered(
  state: IStrk20AccountPrivacyState | undefined,
): boolean {
  return state?.optInStatus === EStrk20OptInStatus.Registered;
}

export function isStrk20RegisterPending(
  state: IStrk20AccountPrivacyState | undefined,
): boolean {
  return (
    state?.optInStatus === EStrk20OptInStatus.RegisterPending ||
    state?.optInStatus === EStrk20OptInStatus.Consented
  );
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
