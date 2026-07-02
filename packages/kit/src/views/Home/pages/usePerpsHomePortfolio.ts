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
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { mapSnapshotToPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

const ACCOUNT_REVALIDATING_SUBTYPES = new Set<ESubscriptionType>([
  ESubscriptionType.WEB_DATA2,
  ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE,
  ESubscriptionType.USER_FILLS,
  ESubscriptionType.OPEN_ORDERS,
  ESubscriptionType.SPOT_STATE,
]);
const ACCOUNT_FORCE_REVALIDATING_SUBTYPES = new Set<ESubscriptionType>([
  ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES,
]);
const DEPOSIT_CONFIRMATION_RETRY_MAX_ATTEMPTS = 5;
const DEPOSIT_CONFIRMATION_RETRY_INTERVAL_MS =
  PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS;
const ACCOUNT_REVALIDATE_DEBOUNCE_MS = 1000;

type IRevalidateReason = 'account' | 'accountForce' | 'deposit';
type ILocalPendingTxConfirmedPayload =
  IAppEventBusPayload[EAppEventBusNames.LocalPendingTxConfirmed];

function getEventUserAddress(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const user = (data as { user?: unknown }).user;
  return typeof user === 'string' ? user.toLowerCase() : undefined;
}

function mergePendingReason(
  current: IRevalidateReason | undefined,
  next: IRevalidateReason,
): IRevalidateReason {
  if (current === 'deposit' || next === 'deposit') {
    return 'deposit';
  }
  if (current === 'accountForce' || next === 'accountForce') {
    return 'accountForce';
  }
  return 'account';
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

function isCurrentAccountConfirmedPerpsTx({
  payload,
  accountId,
  indexedAccountId,
}: {
  payload: ILocalPendingTxConfirmedPayload;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
}) {
  if (
    !payload.isPerpsDepositTx ||
    payload.status !== EDecodedTxStatus.Confirmed
  ) {
    return false;
  }
  if (indexedAccountId) {
    return payload.indexedAccountId === indexedAccountId;
  }
  return Boolean(accountId && payload.accountId === accountId);
}

interface IPerpsHomePortfolioResult {
  address: string;
  view: IPerpsHomeView | undefined;
  snapshotLoaded: boolean;
}

export function usePerpsHomePortfolio(): {
  viewState: 'ready' | 'loading' | 'empty';
  view: IPerpsHomeView | undefined;
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
          return { address: '', view: undefined, snapshotLoaded: true };
        }
        if (!perpsDeriveType) {
          return { address: '', view: undefined, snapshotLoaded: false };
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
          return { address: '', view: undefined, snapshotLoaded: true };
        }
        if (!address) {
          return { address: '', view: undefined, snapshotLoaded: true };
        }
        const snapshot =
          await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
            { address },
          );
        return {
          address,
          view: snapshot ? mapSnapshotToPerpsHomeView(snapshot) : undefined,
          snapshotLoaded: Boolean(snapshot),
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
  const accountRevalidateTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const accountRevalidateForceRef = useRef(false);
  const depositRetryNonceRef = useRef(0);
  const pendingRevalidateReasonRef = useRef<IRevalidateReason | undefined>(
    undefined,
  );
  const pendingRevalidateAccountScopeKeyRef = useRef<string | undefined>(
    undefined,
  );
  const latestAddressRef = useRef<string | undefined>(result?.address);
  latestAddressRef.current = result?.address;

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
    if (!isTabFocused || !pendingRevalidateReasonRef.current) {
      return;
    }
    if (
      pendingRevalidateAccountScopeKeyRef.current !== currentAccountScopeKey
    ) {
      pendingRevalidateReasonRef.current = undefined;
      pendingRevalidateAccountScopeKeyRef.current = undefined;
      return;
    }
    setFocusedRevalidateNonce((value) => value + 1);
  }, [currentAccountScopeKey, isTabFocused]);

  // Refetch when Perps account data changes, the WS recovers, or a deposit confirms on-chain.
  useEffect(() => {
    const setPendingRevalidateReason = (reason: IRevalidateReason) => {
      const pendingScopeKey = pendingRevalidateAccountScopeKeyRef.current;
      pendingRevalidateReasonRef.current =
        pendingScopeKey === currentAccountScopeKey
          ? mergePendingReason(pendingRevalidateReasonRef.current, reason)
          : reason;
      pendingRevalidateAccountScopeKeyRef.current = currentAccountScopeKey;
    };
    const clearDepositRetry = () => {
      if (depositRetryTimerRef.current) {
        clearTimeout(depositRetryTimerRef.current);
        depositRetryTimerRef.current = undefined;
      }
    };
    const forceRefreshAfterDeposit = async ({
      address,
      attempt,
      nonce,
    }: {
      address: string;
      attempt: number;
      nonce: number;
    }) => {
      const snapshot =
        await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
          { address, force: true },
        );
      if (
        depositRetryNonceRef.current !== nonce ||
        latestAddressRef.current !== address
      ) {
        return;
      }
      if (snapshot) {
        setResult({
          address,
          view: mapSnapshotToPerpsHomeView(snapshot),
          snapshotLoaded: true,
        });
      }
      // The event carries a Perps deposit source marker but not the deposit
      // amount, so a non-empty snapshot cannot prove the new deposit is visible.
      if (attempt < DEPOSIT_CONFIRMATION_RETRY_MAX_ATTEMPTS) {
        depositRetryTimerRef.current = setTimeout(() => {
          void forceRefreshAfterDeposit({
            address,
            attempt: attempt + 1,
            nonce,
          });
        }, DEPOSIT_CONFIRMATION_RETRY_INTERVAL_MS);
      }
    };
    const startDepositConfirmationRetry = () => {
      if (!isTabFocusedRef.current) {
        setPendingRevalidateReason('deposit');
        return;
      }
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
      const nonce = depositRetryNonceRef.current;
      const address = latestAddressRef.current;
      if (!address) {
        void run({ alwaysSetState: true });
        return;
      }
      void forceRefreshAfterDeposit({ address, attempt: 1, nonce });
    };
    const clearAccountRevalidate = () => {
      if (accountRevalidateTimerRef.current) {
        clearTimeout(accountRevalidateTimerRef.current);
        accountRevalidateTimerRef.current = undefined;
      }
      accountRevalidateForceRef.current = false;
    };
    const revalidateAccount = async ({
      address,
      force,
    }: {
      address: string;
      force?: boolean;
    }) => {
      const snapshot =
        await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
          { address, force },
        );
      if (latestAddressRef.current !== address) {
        return;
      }
      if (snapshot) {
        setResult({
          address,
          view: mapSnapshotToPerpsHomeView(snapshot),
          snapshotLoaded: true,
        });
      }
    };
    const scheduleAccountRevalidate = ({ force = false } = {}) => {
      if (!isTabFocusedRef.current) {
        setPendingRevalidateReason(force ? 'accountForce' : 'account');
        return;
      }
      pendingRevalidateReasonRef.current = undefined;
      pendingRevalidateAccountScopeKeyRef.current = undefined;
      const address = latestAddressRef.current;
      if (!address) {
        void run();
        return;
      }
      if (force) {
        accountRevalidateForceRef.current = true;
      }
      if (accountRevalidateTimerRef.current) {
        return;
      }
      accountRevalidateTimerRef.current = setTimeout(() => {
        accountRevalidateTimerRef.current = undefined;
        const shouldForce = accountRevalidateForceRef.current;
        accountRevalidateForceRef.current = false;
        void revalidateAccount({ address, force: shouldForce });
      }, ACCOUNT_REVALIDATE_DEBOUNCE_MS);
    };
    const onHl = (p: { subType: ESubscriptionType; data?: unknown }) => {
      const eventUser = getEventUserAddress(p.data);
      const currentAddress = latestAddressRef.current?.toLowerCase();
      if (eventUser && currentAddress && eventUser !== currentAddress) {
        return;
      }
      if (ACCOUNT_REVALIDATING_SUBTYPES.has(p.subType)) {
        scheduleAccountRevalidate();
        return;
      }
      if (ACCOUNT_FORCE_REVALIDATING_SUBTYPES.has(p.subType)) {
        scheduleAccountRevalidate({ force: true });
      }
    };
    const onRecover = () => scheduleAccountRevalidate({ force: true });
    const onTxConfirmed = (payload: ILocalPendingTxConfirmedPayload) => {
      if (
        isCurrentAccountConfirmedPerpsTx({
          payload,
          accountId,
          indexedAccountId,
        })
      ) {
        startDepositConfirmationRetry();
      }
    };
    const pendingReason = pendingRevalidateReasonRef.current;
    const pendingAccountScopeKey = pendingRevalidateAccountScopeKeyRef.current;
    if (
      pendingReason &&
      isTabFocusedRef.current &&
      pendingAccountScopeKey === currentAccountScopeKey
    ) {
      pendingRevalidateReasonRef.current = undefined;
      pendingRevalidateAccountScopeKeyRef.current = undefined;
      if (pendingReason === 'deposit') {
        startDepositConfirmationRetry();
      } else {
        scheduleAccountRevalidate({ force: pendingReason === 'accountForce' });
      }
    } else if (
      pendingReason &&
      pendingAccountScopeKey !== currentAccountScopeKey
    ) {
      pendingRevalidateReasonRef.current = undefined;
      pendingRevalidateAccountScopeKeyRef.current = undefined;
    }
    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, onHl);
    appEventBus.on(EAppEventBusNames.PerpsWebSocketRecovered, onRecover);
    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
    return () => {
      appEventBus.off(EAppEventBusNames.HyperliquidDataUpdate, onHl);
      appEventBus.off(EAppEventBusNames.PerpsWebSocketRecovered, onRecover);
      appEventBus.off(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
      clearDepositRetry();
      clearAccountRevalidate();
      depositRetryNonceRef.current += 1;
    };
  }, [
    accountId,
    currentAccountScopeKey,
    focusedRevalidateNonce,
    indexedAccountId,
    run,
    setResult,
  ]);

  const view = result?.view;
  const viewState = useMemo<'ready' | 'loading' | 'empty'>(() => {
    // result is undefined until a fetch resolves for the current account key (swrKey
    // resets it synchronously on switch), so an unresolved key reads as loading, not empty.
    if (result === undefined || !result.snapshotLoaded) {
      return 'loading';
    }
    return view && !view.isEmpty ? 'ready' : 'empty';
  }, [result, view]);

  return useMemo(() => ({ viewState, view }), [viewState, view]);
}
