import { useEffect, useMemo, useRef, useState } from 'react';

import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { mapSnapshotToPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

const DEPOSIT_CONFIRMATION_RETRY_MAX_ATTEMPTS = 5;
const DEPOSIT_CONFIRMATION_RETRY_INTERVAL_MS =
  PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS;

type ILocalPendingTxConfirmedPayload =
  IAppEventBusPayload[EAppEventBusNames.LocalPendingTxConfirmed];

type IPendingDepositRetryScope = {
  accountScopeKey: string | undefined;
  address: string;
  deriveType: string | IAccountDeriveTypes;
};

function normalizePerpsAddress(address: string | undefined) {
  return (address || '').toLowerCase();
}

function isSameDeriveType(
  a: string | IAccountDeriveTypes | undefined,
  b: string | IAccountDeriveTypes | undefined,
) {
  return Boolean(a && b && String(a).toLowerCase() === String(b).toLowerCase());
}

function getAccountScopeKey({
  accountId,
  indexedAccountId,
}: {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
}) {
  if (indexedAccountId) {
    return `indexed:${indexedAccountId}`;
  }
  if (accountId) {
    return `account:${accountId}`;
  }
  return undefined;
}

function getCurrentConfirmedPerpsDepositScope({
  payload,
  accountId,
  indexedAccountId,
  currentAccountScopeKey,
  currentAddress,
  currentDeriveType,
}: {
  payload: ILocalPendingTxConfirmedPayload;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  currentAccountScopeKey: string | undefined;
  currentAddress: string | undefined;
  currentDeriveType: IAccountDeriveTypes | undefined;
}): IPendingDepositRetryScope | undefined {
  if (
    !payload.isPerpsDepositTx ||
    payload.status !== EDecodedTxStatus.Confirmed
  ) {
    return undefined;
  }
  let isSameAccount = false;
  const payloadAccountId = payload.perpsAccountId ?? payload.accountId;
  const payloadIndexedAccountId =
    payload.perpsIndexedAccountId ?? payload.indexedAccountId;
  if (indexedAccountId) {
    isSameAccount = payloadIndexedAccountId === indexedAccountId;
  } else {
    isSameAccount = Boolean(accountId && payloadAccountId === accountId);
  }
  if (!isSameAccount) {
    return undefined;
  }
  const payloadAddress = normalizePerpsAddress(
    payload.perpsAccountAddress ?? payload.accountAddress,
  );
  const payloadDeriveType = payload.perpsDeriveType ?? payload.deriveType;
  const currentNormalizedAddress = normalizePerpsAddress(currentAddress);
  if (
    !payloadAddress ||
    (currentNormalizedAddress && payloadAddress !== currentNormalizedAddress) ||
    !payloadDeriveType ||
    (currentDeriveType &&
      !isSameDeriveType(payloadDeriveType, currentDeriveType))
  ) {
    return undefined;
  }
  return {
    accountScopeKey: currentAccountScopeKey,
    address: payloadAddress,
    deriveType: payloadDeriveType,
  };
}

function isPendingDepositRetryScopeAccountCurrent({
  scope,
  currentAccountScopeKey,
  currentDeriveType,
}: {
  scope: IPendingDepositRetryScope;
  currentAccountScopeKey: string | undefined;
  currentDeriveType: IAccountDeriveTypes | undefined;
}) {
  return (
    scope.accountScopeKey === currentAccountScopeKey &&
    (!currentDeriveType ||
      isSameDeriveType(scope.deriveType, currentDeriveType))
  );
}

function isPendingDepositRetryScopeCurrent({
  scope,
  currentAccountScopeKey,
  currentAddress,
  currentDeriveType,
}: {
  scope: IPendingDepositRetryScope;
  currentAccountScopeKey: string | undefined;
  currentAddress: string | undefined;
  currentDeriveType: IAccountDeriveTypes | undefined;
}) {
  return (
    scope.accountScopeKey === currentAccountScopeKey &&
    scope.address === normalizePerpsAddress(currentAddress) &&
    isSameDeriveType(scope.deriveType, currentDeriveType)
  );
}

interface IPerpsHomePortfolioResult {
  address: string;
  view: IPerpsHomeView | undefined;
  requestResolved: boolean;
}

export function usePerpsHomePortfolio(): {
  viewState: 'ready' | 'loading' | 'empty';
  view: IPerpsHomeView | undefined;
  canDeposit: boolean;
  isDepositDisabled: boolean;
} {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  const currentAccountScopeKey = getAccountScopeKey({
    accountId,
    indexedAccountId,
  });
  // Home tabs stay mounted while frozen, so gate polling on the Perps tab being active.
  const { isFocused: isTabFocused } = useTabIsRefreshingFocused();
  const isTabFocusedRef = useRef(isTabFocused);
  isTabFocusedRef.current = isTabFocused;
  const [deriveTypeRevision, setDeriveTypeRevision] = useState(0);
  const [focusedRevalidateNonce, setFocusedRevalidateNonce] = useState(0);

  const { result: perpsDeriveType } = usePromiseResult<IAccountDeriveTypes>(
    () => {
      void deriveTypeRevision;
      return backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    },
    [deriveTypeRevision],
    {
      undefinedResultIfReRun: true,
    },
  );

  const { result, run, setResult } =
    usePromiseResult<IPerpsHomePortfolioResult>(
      async () => {
        if (!accountId && !indexedAccountId) {
          return { address: '', view: undefined, requestResolved: true };
        }
        if (!perpsDeriveType) {
          return { address: '', view: undefined, requestResolved: false };
        }
        let address = '';
        try {
          const acc = await backgroundApiProxy.serviceAccount.getNetworkAccount(
            {
              accountId: indexedAccountId ? undefined : accountId,
              indexedAccountId,
              deriveType: perpsDeriveType,
              networkId: PERPS_NETWORK_ID,
            },
          );
          address = acc?.addressDetail?.normalizedAddress || acc?.address || '';
        } catch {
          // account has no Arbitrum derivation, so there is no HL address to query
          return { address: '', view: undefined, requestResolved: true };
        }
        if (!address) {
          return { address: '', view: undefined, requestResolved: true };
        }
        const snapshot =
          await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
            { address },
          );
        if (!snapshot) {
          return { address, view: undefined, requestResolved: false };
        }
        return {
          address,
          view: mapSnapshotToPerpsHomeView(snapshot),
          requestResolved: true,
        };
      },
      [accountId, indexedAccountId, perpsDeriveType],
      {
        // Account + derive type scoped so result swaps synchronously on identity changes.
        swrKey: perpsDeriveType
          ? `perps-home:${indexedAccountId ?? accountId ?? ''}:${perpsDeriveType}`
          : undefined,
        // Poll at the active cadence, while the bg snapshot cache keeps real HL
        // network reads to active=15s / idle-or-empty=1m unless forced.
        pollingInterval: PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
        overrideIsFocused: (isPageFocused) => isPageFocused && isTabFocused,
      },
    );
  const depositRetryTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const depositRetryNonceRef = useRef(0);
  const activeDepositRetryScopeRef = useRef<
    IPendingDepositRetryScope | undefined
  >(undefined);
  const focusRefreshNonceRef = useRef(0);
  const wasTabFocusedRef = useRef(isTabFocused);
  const pendingDepositRetryScopeRef = useRef<
    IPendingDepositRetryScope | undefined
  >(undefined);
  const latestAddressRef = useRef<string | undefined>(result?.address);
  latestAddressRef.current = result?.address;

  useEffect(() => {
    const wasTabFocused = wasTabFocusedRef.current;
    wasTabFocusedRef.current = isTabFocused;
    if (!isTabFocused || wasTabFocused) {
      return;
    }
    const address = normalizePerpsAddress(latestAddressRef.current);
    if (!address) {
      void run({ alwaysSetState: true });
      return;
    }
    focusRefreshNonceRef.current += 1;
    const nonce = focusRefreshNonceRef.current;
    void (async () => {
      const snapshot =
        await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
          { address, force: true },
        );
      if (
        focusRefreshNonceRef.current !== nonce ||
        !isTabFocusedRef.current ||
        normalizePerpsAddress(latestAddressRef.current) !== address
      ) {
        return;
      }
      setResult({
        address,
        view: snapshot ? mapSnapshotToPerpsHomeView(snapshot) : undefined,
        requestResolved: Boolean(snapshot),
      });
    })();
  }, [isTabFocused, run, setResult]);

  useEffect(() => {
    const onGlobalDeriveTypeUpdate = () => {
      setDeriveTypeRevision((value) => value + 1);
    };
    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      onGlobalDeriveTypeUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        onGlobalDeriveTypeUpdate,
      );
    };
  }, []);

  useEffect(() => {
    const pendingDepositRetryScope = pendingDepositRetryScopeRef.current;
    if (!isTabFocused || !pendingDepositRetryScope) {
      return;
    }
    if (!perpsDeriveType) {
      return;
    }
    if (
      !isPendingDepositRetryScopeAccountCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
      return;
    }
    if (!latestAddressRef.current) {
      return;
    }
    if (
      !isPendingDepositRetryScopeCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
      return;
    }
    setFocusedRevalidateNonce((value) => value + 1);
  }, [currentAccountScopeKey, isTabFocused, perpsDeriveType, result?.address]);

  // Refetch only when a locally submitted Perps deposit confirms on-chain.
  useEffect(() => {
    const markPendingDepositRetry = (scope: IPendingDepositRetryScope) => {
      pendingDepositRetryScopeRef.current = scope;
    };
    const clearDepositRetry = () => {
      if (depositRetryTimerRef.current) {
        clearTimeout(depositRetryTimerRef.current);
        depositRetryTimerRef.current = undefined;
      }
    };
    const pauseDepositRetry = (scope: IPendingDepositRetryScope) => {
      markPendingDepositRetry(scope);
      activeDepositRetryScopeRef.current = undefined;
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
    };
    const forceRefreshAfterDeposit = async ({
      scope,
      address,
      attempt,
      nonce,
    }: {
      scope: IPendingDepositRetryScope;
      address: string;
      attempt: number;
      nonce: number;
    }) => {
      if (!isTabFocusedRef.current) {
        pauseDepositRetry(scope);
        return;
      }
      const snapshot =
        await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
          { address, force: true, skipCacheWriteIfEmpty: true },
        );
      if (
        depositRetryNonceRef.current !== nonce ||
        normalizePerpsAddress(latestAddressRef.current) !== address
      ) {
        return;
      }
      if (!isTabFocusedRef.current) {
        pauseDepositRetry(scope);
        return;
      }
      if (snapshot) {
        setResult({
          address,
          view: mapSnapshotToPerpsHomeView(snapshot),
          requestResolved: true,
        });
      }
      // The event carries a Perps deposit source marker but not the deposit
      // amount, so a non-empty snapshot cannot prove the new deposit is visible.
      if (
        attempt < DEPOSIT_CONFIRMATION_RETRY_MAX_ATTEMPTS &&
        isTabFocusedRef.current
      ) {
        depositRetryTimerRef.current = setTimeout(() => {
          if (!isTabFocusedRef.current) {
            pauseDepositRetry(scope);
            return;
          }
          void forceRefreshAfterDeposit({
            scope,
            address,
            attempt: attempt + 1,
            nonce,
          });
        }, DEPOSIT_CONFIRMATION_RETRY_INTERVAL_MS);
      } else {
        activeDepositRetryScopeRef.current = undefined;
      }
    };
    const startDepositConfirmationRetry = (
      scope: IPendingDepositRetryScope,
    ) => {
      if (!perpsDeriveType) {
        markPendingDepositRetry(scope);
        return;
      }
      if (
        !isPendingDepositRetryScopeAccountCurrent({
          scope,
          currentAccountScopeKey,
          currentDeriveType: perpsDeriveType,
        })
      ) {
        pendingDepositRetryScopeRef.current = undefined;
        return;
      }
      if (!latestAddressRef.current) {
        markPendingDepositRetry(scope);
        return;
      }
      if (
        !isPendingDepositRetryScopeCurrent({
          scope,
          currentAccountScopeKey,
          currentAddress: latestAddressRef.current,
          currentDeriveType: perpsDeriveType,
        })
      ) {
        pendingDepositRetryScopeRef.current = undefined;
        return;
      }
      if (!isTabFocusedRef.current) {
        markPendingDepositRetry(scope);
        return;
      }
      pendingDepositRetryScopeRef.current = undefined;
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
      const nonce = depositRetryNonceRef.current;
      const address = scope.address;
      if (!address) {
        void run({ alwaysSetState: true });
        return;
      }
      activeDepositRetryScopeRef.current = scope;
      void forceRefreshAfterDeposit({ scope, address, attempt: 1, nonce });
    };
    const onTxConfirmed = (payload: ILocalPendingTxConfirmedPayload) => {
      const scope = getCurrentConfirmedPerpsDepositScope({
        payload,
        accountId,
        indexedAccountId,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      });
      if (scope) {
        startDepositConfirmationRetry(scope);
      }
    };
    const pendingDepositRetryScope = pendingDepositRetryScopeRef.current;
    if (
      pendingDepositRetryScope &&
      isTabFocusedRef.current &&
      perpsDeriveType &&
      latestAddressRef.current &&
      isPendingDepositRetryScopeCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
      startDepositConfirmationRetry(pendingDepositRetryScope);
    } else if (
      pendingDepositRetryScope &&
      perpsDeriveType &&
      !isPendingDepositRetryScopeAccountCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
    } else if (
      pendingDepositRetryScope &&
      perpsDeriveType &&
      latestAddressRef.current &&
      !isPendingDepositRetryScopeCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
    }
    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
      const activeDepositRetryScope = activeDepositRetryScopeRef.current;
      if (!isTabFocusedRef.current && activeDepositRetryScope) {
        markPendingDepositRetry(activeDepositRetryScope);
      }
      activeDepositRetryScopeRef.current = undefined;
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
    };
  }, [
    accountId,
    currentAccountScopeKey,
    focusedRevalidateNonce,
    indexedAccountId,
    isTabFocused,
    perpsDeriveType,
    run,
    setResult,
  ]);

  const view = result?.view;
  const isDepositDisabled = accountUtils.isWatchingAccount({
    accountId: accountId ?? '',
  });
  const viewState = useMemo<'ready' | 'loading' | 'empty'>(() => {
    // result is undefined until a fetch resolves for the current account key (swrKey
    // resets it synchronously on switch), so an unresolved key reads as loading, not empty.
    if (result === undefined || !result.requestResolved) {
      return 'loading';
    }
    return view && !view.isEmpty ? 'ready' : 'empty';
  }, [result, view]);

  const canDeposit = Boolean(result?.address);
  return useMemo(
    () => ({ viewState, view, canDeposit, isDepositDisabled }),
    [canDeposit, isDepositDisabled, viewState, view],
  );
}
