import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  privacyChainPoolOwnerKey,
  usePrivacyChainPoolDisplayAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import {
  formatPrivacyChainRemainingBlocks,
  formatPrivacyChainSyncProgress,
  getPrivacyChainScanRegionLabelId,
  getPrivacyChainSyncLabel,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountState,
  ILocalWalletPoolBalance,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDistanceStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import { getLocalWalletPoolDisplayAddress } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import {
  PRIVACY_CHAIN_SYNC_POLL_MS,
  isTipLagWorthMentioning,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import type { IntlShape } from 'react-intl';

type ILocalWalletSettings = NonNullable<IVaultSettings['localWallet']>;

// Last state/addresses seen per account, in memory only; reopening the page shows them at once.
const lastSeenByAccount = new Map<
  string,
  {
    state?: ILocalWalletAccountState;
    addresses?: ILocalWalletAccountAddresses | null;
  }
>();

/** Forget remembered reads. Tests only. */
export function resetLocalWalletPoolLastSeen() {
  lastSeenByAccount.clear();
}
type ILocalWalletReadScope = {
  accountScope: { networkId: string; accountId: string; revision: number };
};

// Which pool the token page is showing. A single-balance chain (Monero) has one pool and no
// tabs to select it, so it defaults to its default-private pool instead.
export function resolveSelectedPoolId({
  settings,
  selectedPoolId,
}: {
  settings: ILocalWalletSettings | undefined;
  selectedPoolId: number | undefined;
}): number | undefined {
  if (selectedPoolId !== undefined) return selectedPoolId;
  if (settings?.balanceShape !== 'single') return undefined;
  const pool =
    settings.pools.find((item) => item.isDefaultPrivate) ?? settings.pools[0];
  return pool?.id;
}

// Goes through dateUtils/date-fns rather than hand-rolled units, to get locale and plurals for free.
function formatSeconds(seconds: number, addSuffix: boolean): string {
  const now = Date.now();
  return formatDistanceStrict(
    now + seconds * 1000,
    now,
    addSuffix,
    addSuffix ? 'round' : 'ceil',
  );
}

function formatEtaSuffix(
  remainingBlocks: number,
  blocksPerSec: number | null,
): string {
  if (!blocksPerSec || blocksPerSec <= 0 || remainingBlocks <= 0) return '';
  return ` · ~${formatSeconds(remainingBlocks / blocksPerSec, false)}`;
}

function formatBehind(lagBlocks: number, blockTimeSeconds: number): string {
  return formatSeconds(-lagBlocks * blockTimeSeconds, true);
}

export function buildLocalWalletSyncStatusText({
  syncProgress,
  settings,
  scanRatePerSec,
  intl,
}: {
  syncProgress: ILocalWalletSyncProgress | null | undefined;
  settings: ILocalWalletSettings | undefined;
  scanRatePerSec: number | null;
  intl: IntlShape;
}): string | null {
  if (!syncProgress) return null;
  const heightsPresent = [
    syncProgress.backfillScannedHeight,
    syncProgress.backfillTargetHeight,
    syncProgress.tipScannedHeight,
    syncProgress.chainTip,
  ].some((height) => typeof height === 'number');
  if (!heightsPresent) return null;

  // A chain has no finish line; only backfill does, so only backfill shows a percentage/ETA.
  if (!syncProgress.isBackfillComplete) {
    const scanned = syncProgress.backfillScannedHeight;
    const target = syncProgress.backfillTargetHeight;
    const hasHeights =
      typeof scanned === 'number' && typeof target === 'number';
    const remaining =
      syncProgress.backfillRemainingBlocks ??
      (hasHeights ? Math.max(0, target - scanned) : 0);
    const regionLabelId = getPrivacyChainScanRegionLabelId(
      settings?.scanRegionHints,
      scanned,
    );
    const regionText = regionLabelId
      ? ` · ${intl.formatMessage({ id: regionLabelId })}`
      : '';
    const eta = formatEtaSuffix(remaining, scanRatePerSec);
    const remainingText = formatPrivacyChainRemainingBlocks(syncProgress, intl);
    const line =
      formatPrivacyChainSyncProgress({
        scanned,
        target,
        progress: syncProgress.backfillProgress,
      }) +
      (remainingText ? ` · ${remainingText}` : '') +
      regionText +
      eta;
    return (
      line ||
      intl.formatMessage({
        id: getPrivacyChainSyncLabel({ backfilling: true }),
      })
    );
  }
  // Caught up, not finished: a chain never says "up to date". Heights are safe to show here,
  // since every account sits at the same tip once backfill is done.
  const at = syncProgress.tipScannedHeight;
  const tip = syncProgress.chainTip;
  const heights = formatPrivacyChainSyncProgress({ scanned: at, target: tip });
  const lag = syncProgress.tipLag;
  const behind =
    isTipLagWorthMentioning(
      lag,
      settings?.tipLagWarningBlocks ?? Number.MAX_SAFE_INTEGER,
    ) && settings
      ? ` · ${formatBehind(lag ?? 0, settings.blockTimeSeconds)}`
      : '';
  return heights
    ? `${heights}${behind}`
    : intl.formatMessage({
        id: getPrivacyChainSyncLabel({ backfilling: false }),
      });
}

// Everything the token/settings pages need for one local-wallet account, optionally focused on
// one pool. Chain-agnostic: reads settings.localWallet and servicePrivacyChain only.
export function useLocalWalletPool({
  networkId,
  accountId,
  poolId,
  isActive = true,
  accountData,
}: {
  networkId: string;
  accountId: string;
  poolId?: number;
  isActive?: boolean;
  // Already loaded by the caller for this account and network; skips a
  // second useAccountData round of background calls per mounted tab.
  accountData?: {
    account: INetworkAccount | undefined;
    vaultSettings: IVaultSettings | undefined;
  };
}) {
  const intl = useIntl();
  const [, setPoolDisplay] = usePrivacyChainPoolDisplayAtom();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [attemptedBalanceScope, setAttemptedBalanceScope] =
    useState<ILocalWalletReadScope>();
  const accountScope = useMemo(
    () => ({ networkId, accountId, revision }),
    [networkId, accountId, revision],
  );

  const ownAccountData = useAccountData(
    accountData ? {} : { networkId, accountId },
  );
  const { account, vaultSettings } = accountData ?? ownAccountData;
  const settings = vaultSettings?.localWallet;
  // Whether this chain has a local wallet at all. Deliberately NOT `balanceShape === 'pooled'`:
  // that only means "distinct balances to move between", which drives the per-pool tabs and nothing else.
  const hasPooledBalance = Boolean(settings);
  const pool = useMemo(
    () => settings?.pools.find((item) => item.id === poolId),
    [poolId, settings?.pools],
  );

  // Read from the chain rather than inferred from the account id: Monero has no hardware
  // keyring, so a hardware account there can never scan despite looking scannable.
  const { result: accountSupport } = usePromiseResult(
    async () => {
      if (!hasPooledBalance || !accountId) return undefined;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountSupport(
        { networkId, accountId },
      );
    },
    [hasPooledBalance, accountId, networkId],
    { undefinedResultIfReRun: true },
  );
  const isWalletSupported =
    accountSupport === undefined ? undefined : accountSupport === 'supported';
  const isUnsupportedWallet = isWalletSupported === false;

  // Privacy settings open in a retained modal, so invalidate on this event even without a focus change.
  useEffect(() => {
    if (!hasPooledBalance) return;
    const invalidate = (payload: {
      networkId: string;
      accountIds: string[];
    }) => {
      if (
        payload.networkId !== networkId ||
        !payload.accountIds.includes(accountId)
      ) {
        return;
      }
      const ownerKey = privacyChainPoolOwnerKey({
        accountId,
        networkId,
        poolId,
      });
      setPoolDisplay((prev) =>
        prev?.ownerKey === ownerKey ? undefined : prev,
      );
      lastSeenByAccount.delete(`${networkId}:${accountId}`);
      setRevision((value) => value + 1);
    };
    appEventBus.on(EAppEventBusNames.LocalWalletAccountsChanged, invalidate);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalWalletAccountsChanged, invalidate);
    };
  }, [accountId, hasPooledBalance, networkId, poolId, setPoolDisplay]);

  const { result: stateResult, run: refreshState } = usePromiseResult(
    async () => {
      if (!isActive || !hasPooledBalance || !accountId) return undefined;
      try {
        return {
          scope: accountScope,
          state:
            await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
              { networkId, accountId },
            ),
        };
      } catch (error) {
        // Fail closed: an unknown state must not fall back to a remembered one.
        lastSeenByAccount.delete(`${networkId}:${accountId}`);
        throw error;
      }
    },
    [isActive, hasPooledBalance, accountScope, accountId, networkId],
    {
      // Keep the last state while revalidating on focus: clearing it collapsed the whole
      // private UI to nothing on every return to the page.
      revalidateOnFocus: true,
      undefinedResultIfError: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const lastSeenKey = `${networkId}:${accountId}`;
  const lastSeen = lastSeenByAccount.get(lastSeenKey);
  const freshState =
    stateResult?.scope === accountScope ? stateResult.state : undefined;
  const state = freshState ?? lastSeen?.state;
  const enabled = state?.enabled === true;
  const canRead = isActive && hasPooledBalance && !!accountId && enabled;
  const canReadBalance =
    isActive &&
    hasPooledBalance &&
    !!accountId &&
    (enabled || pool?.source === 'backend');
  // Scope follows accountScope only; tying it to `canRead` made every tab switch a new scope
  // and discarded the balance/addresses/progress already on screen.
  const readScope = useMemo(() => ({ accountScope }), [accountScope]);
  const readScopeRef = useRef(readScope);
  readScopeRef.current = readScope;
  const hasAttemptedBalance = attemptedBalanceScope === readScope;

  const { result: balanceResult, run: refreshBalance } = usePromiseResult(
    async () => {
      if (!canReadBalance) return null;
      try {
        return {
          scope: readScope,
          balance:
            await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountBalance(
              { networkId, accountId },
            ),
        };
      } finally {
        if (readScopeRef.current === readScope) {
          setAttemptedBalanceScope(readScope);
        }
      }
    },
    [readScope, canReadBalance, accountId, networkId],
    {
      pollingInterval: canReadBalance ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const balance =
    canReadBalance && balanceResult?.scope === readScope
      ? balanceResult.balance
      : undefined;
  // A balance that landed after its read gave up; the poll alone would leave
  // the saved one up for a full interval.
  useEffect(() => {
    if (!canReadBalance) return;
    const onLanded = (payload: { networkId: string; accountId: string }) => {
      if (payload.networkId !== networkId || payload.accountId !== accountId) {
        return;
      }
      void refreshBalance();
    };
    appEventBus.on(EAppEventBusNames.LocalWalletBalanceLanded, onLanded);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalWalletBalanceLanded, onLanded);
    };
  }, [accountId, canReadBalance, networkId, refreshBalance]);

  // The chain only reports a private address while scanning is on, so nothing is exposed early.
  const canReadAddresses = isActive && hasPooledBalance && !!accountId;
  const { result: addressesResult, run: refreshAddresses } = usePromiseResult(
    async () => {
      if (!canReadAddresses) return null;
      const result =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountAddresses(
          { networkId, accountId },
        );
      return { scope: readScope, addresses: result ?? null };
    },
    [readScope, canReadAddresses, accountId, networkId],
    {
      revalidateOnFocus: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const freshAddresses =
    addressesResult?.scope === readScope
      ? addressesResult.addresses
      : undefined;
  const addresses = canReadBalance
    ? (freshAddresses ?? lastSeen?.addresses)
    : undefined;
  useEffect(() => {
    if (freshState === undefined && freshAddresses === undefined) return;
    const previous = lastSeenByAccount.get(lastSeenKey);
    lastSeenByAccount.set(lastSeenKey, {
      state: freshState ?? previous?.state,
      addresses: freshAddresses ?? previous?.addresses,
    });
  }, [freshAddresses, freshState, lastSeenKey]);

  // Refs on purpose: feed a label derived at render time and must not cause renders.
  const scanRateSampleRef = useRef<{ height: number; at: number } | null>(null);
  const scanRatePerSecRef = useRef<number | null>(null);
  const { result: progressResult, run: refreshSyncProgress } = usePromiseResult(
    async () => {
      if (!canRead) return null;
      const progress =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSyncProgress(
          { networkId, accountId },
        );
      const scanned = progress?.backfillScannedHeight;
      if (readScopeRef.current === readScope && typeof scanned === 'number') {
        const now = Date.now();
        const prev = scanRateSampleRef.current;
        if (!prev || scanned < prev.height) {
          scanRatePerSecRef.current = null;
          scanRateSampleRef.current = { height: scanned, at: now };
        } else if (scanned > prev.height && now > prev.at) {
          const instantaneous =
            ((scanned - prev.height) * 1000) / (now - prev.at);
          const ema = scanRatePerSecRef.current;
          scanRatePerSecRef.current =
            ema === null ? instantaneous : ema * 0.7 + instantaneous * 0.3;
          scanRateSampleRef.current = { height: scanned, at: now };
        }
      }
      return { scope: readScope, progress };
    },
    [readScope, canRead, accountId, networkId],
    {
      pollingInterval: canRead ? PRIVACY_CHAIN_SYNC_POLL_MS : undefined,
      overrideIsFocused: (isPageFocused) => isPageFocused && isActive,
    },
  );
  const syncProgress =
    canRead && progressResult?.scope === readScope
      ? progressResult.progress
      : undefined;

  // Turning the interval on schedules the first polled run one interval
  // out; read once right away instead of leaving the page empty until then.
  const readableRef = useRef({ canReadBalance, canRead });
  useEffect(() => {
    const previous = readableRef.current;
    readableRef.current = { canReadBalance, canRead };
    if (canReadBalance && !previous.canReadBalance) {
      void refreshBalance();
    }
    if (canRead && !previous.canRead) {
      void refreshSyncProgress();
    }
  }, [canRead, canReadBalance, refreshBalance, refreshSyncProgress]);

  const refresh = useCallback(() => {
    void refreshState();
    void refreshBalance();
    void refreshAddresses();
    void refreshSyncProgress();
  }, [refreshAddresses, refreshBalance, refreshState, refreshSyncProgress]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const handleActionDone = useCallback(() => {
    refreshRef.current();
  }, []);

  useEffect(() => {
    scanRateSampleRef.current = null;
    scanRatePerSecRef.current = null;
  }, [readScope]);

  const poolBalance: ILocalWalletPoolBalance | undefined = useMemo(
    () => balance?.pools.find((item) => item.key === pool?.key),
    [balance?.pools, pool?.key],
  );
  // A legacy pool has nowhere to receive; offering its address would invite value the chain no longer accepts.
  const poolAddress = useMemo(
    () => getLocalWalletPoolDisplayAddress({ pool, addresses }),
    [addresses, pool],
  );

  useEffect(() => {
    if (!canReadBalance || !pool) return;
    const move = poolBalance?.move;
    const next = {
      ownerKey: privacyChainPoolOwnerKey({ accountId, networkId, poolId }),
      address: poolAddress,
      balanceParsed: poolBalance?.totalParsed,
      balanceStatus: poolBalance?.balanceStatus,
      balanceSettled: hasAttemptedBalance,
      action: move
        ? {
            type: move.type,
            fromAddress: account?.id === accountId ? account.address : '',
            toAddress:
              move.type === 'shield'
                ? addresses?.privateAddress
                : addresses?.publicAddress,
            amount: move.amountParsed,
            spendSource: move.type === 'withdraw' ? pool.key : undefined,
            disabled: !balance || !move.enabled,
            onDone: handleActionDone,
          }
        : undefined,
    };
    setPoolDisplay((prev) => (isEqual(prev, next) ? prev : next));
  }, [
    account?.address,
    account?.id,
    accountId,
    addresses,
    balance,
    canReadBalance,
    handleActionDone,
    hasAttemptedBalance,
    isActive,
    networkId,
    pool,
    poolAddress,
    poolBalance,
    poolId,
    setPoolDisplay,
  ]);

  useEffect(() => {
    const ownerKey = privacyChainPoolOwnerKey({ accountId, networkId, poolId });
    const clearDisplay = () => {
      setPoolDisplay((prev) =>
        prev?.ownerKey === ownerKey ? undefined : prev,
      );
    };
    if (!canReadBalance) {
      clearDisplay();
    }
    return clearDisplay;
  }, [accountId, canReadBalance, networkId, poolId, setPoolDisplay]);

  // Only this network's flag: the whole atom changes on every scan pass.
  const isStorageUnsupportedAtom = useMemo(
    () =>
      selectAtom(privacyChainAtom.atom(), (value) =>
        value.storageUnsupportedNetworkIds.includes(networkId),
      ),
    [networkId],
  );
  const isStorageUnsupported = useAtomValue(isStorageUnsupportedAtom);
  const syncStatusText = isStorageUnsupported
    ? intl.formatMessage({
        id: ETranslations.privacy_error_webview_outdated__msg,
      })
    : buildLocalWalletSyncStatusText({
        syncProgress,
        settings,
        scanRatePerSec: scanRatePerSecRef.current,
        intl,
      });

  const runBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const enableAccount = useCallback(
    (params: { birthdayHeight?: number; birthdayTimestamp?: number }) =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount({
          networkId,
          accountId,
          ...params,
        });
        refreshRef.current();
      }),
    [accountId, networkId, runBusy],
  );
  const disableAccount = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount({
          networkId,
          accountId,
        });
        setPoolDisplay(undefined);
        setAttemptedBalanceScope(undefined);
        void refreshState();
      }),
    [accountId, networkId, refreshState, runBusy, setPoolDisplay],
  );
  const resetLocalData = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.resetLocalChainData({
          networkId,
          accountId,
        });
        refreshRef.current();
      }),
    [accountId, networkId, runBusy],
  );
  const deleteLocalData = useCallback(
    () =>
      runBusy(async () => {
        await backgroundApiProxy.servicePrivacyChain.deleteLocalWalletAccountData(
          { networkId, accountId },
        );
        setPoolDisplay(undefined);
        setAttemptedBalanceScope(undefined);
        void refreshState();
      }),
    [accountId, networkId, refreshState, runBusy, setPoolDisplay],
  );
  // Consumers gate on this so the private UI appears once, complete, instead of popping in piece by piece.
  const isReady = (() => {
    if (!hasPooledBalance) return true;
    // An unsupported wallet has no state to read and nothing to enable, so it's complete as soon as it lands.
    if (isWalletSupported === undefined) return false;
    if (!isWalletSupported) return true;
    if (state === undefined) return false;
    if (!enabled) return true;
    return (
      balance !== undefined &&
      addresses !== undefined &&
      syncProgress !== undefined
    );
  })();

  return {
    settings,
    hasPooledBalance,
    isWalletSupported,
    isUnsupportedWallet,
    pool,
    state,
    // Undefined until the first state read lands; must not be treated as "disabled" before that.
    isStateSettled: state !== undefined,
    isReady,
    enabled,
    balance,
    poolBalance,
    poolAddress,
    addresses,
    syncProgress,
    syncStatusText,
    hasAttemptedBalance,
    busy,
    accountName: account?.name,
    // A wallet the user chose not to keep: unsupported, with its own reason.
    isTempWallet: accountSupport === 'tempWallet',
    refresh,
    enableAccount,
    disableAccount,
    resetLocalData,
    deleteLocalData,
  };
}

export type ILocalWalletPool = ReturnType<typeof useLocalWalletPool>;
