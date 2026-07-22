// cspell: words unifold Unifold hypercore Hypercore
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  perpsActiveAccountAtom,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatUnifoldUsdAmount } from '@onekeyhq/shared/src/utils/unifoldDepositUtils';
import type {
  IUnifoldDepositAddressResult,
  IUnifoldDepositDestination,
  IUnifoldDepositExecution,
  IUnifoldExecutionStatus,
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';
import {
  UNIFOLD_ERROR_CODE_FEATURE_DISABLED,
  UNIFOLD_ERROR_CODE_GEO_BLOCKED,
} from '@onekeyhq/shared/types/unifoldDeposit';

import {
  UNIFOLD_ARBITRUM_CHAIN_ID,
  UNIFOLD_ARBITRUM_CHAIN_TYPE,
  UNIFOLD_ARBITRUM_USDC_ADDRESS,
  UNIFOLD_HYPERCORE_CHAIN_ID,
  UNIFOLD_HYPERCORE_CHAIN_TYPE,
  UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
} from '../consts/unifold';
import { hasUsableUnifoldSupportedAssets } from '../utils/unifoldDestination';
import { getSafeUnifoldRecipient } from '../utils/unifoldRecipient';

// Default source preference mirrors the SDK config used before the API
// migration: Arbitrum USDC.
const DEFAULT_SOURCE_CHAIN_ID = '42161';
const DEFAULT_SOURCE_SYMBOL = 'USDC';

const EXECUTIONS_POLL_INTERVAL_MS = 3000;
const RETRY_INTERVAL_MS = 5000;
// Mirrors the SDK: the "Checking for deposit" indicator appears 5s after the
// address is shown (code constant wins over the vendor docs' 10s).
const WAITING_UI_DELAY_MS = 5000;
const SESSION_LOOKBACK_MS = 60_000;

// Production destination: HyperCore Perp USDC.
export const UNIFOLD_DEPOSIT_DESTINATION: IUnifoldDepositDestination = {
  destinationChainType: UNIFOLD_HYPERCORE_CHAIN_TYPE,
  destinationChainId: UNIFOLD_HYPERCORE_CHAIN_ID,
  destinationTokenAddress: UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
};

// Dev-only destination: funds settle back into the user's own Arbitrum wallet
// instead of the perps account, which makes end-to-end pipeline runs cheap.
const UNIFOLD_DEV_TEST_DESTINATION: IUnifoldDepositDestination = {
  destinationChainType: UNIFOLD_ARBITRUM_CHAIN_TYPE,
  destinationChainId: UNIFOLD_ARBITRUM_CHAIN_ID,
  destinationTokenAddress: UNIFOLD_ARBITRUM_USDC_ADDRESS,
};

export function isUnifoldHyperCoreDestination(
  destination: IUnifoldDepositDestination,
): boolean {
  return destination.destinationChainId === UNIFOLD_HYPERCORE_CHAIN_ID;
}

// Single source of truth for the deposit destination. Fail-safe by
// construction: anything other than a dev build with the switch explicitly on
// resolves to the production HyperCore destination.
export function resolveUnifoldDepositDestination(
  devSettings:
    | { enabled?: boolean; settings?: { unifoldUseTestDestination?: boolean } }
    | undefined,
): IUnifoldDepositDestination {
  const useTestDestination =
    platformEnv.isDev &&
    Boolean(devSettings?.enabled) &&
    devSettings?.settings?.unifoldUseTestDestination === true;
  return useTestDestination
    ? UNIFOLD_DEV_TEST_DESTINATION
    : UNIFOLD_DEPOSIT_DESTINATION;
}

export type IUnifoldDepositErrorType =
  | 'accountMismatch'
  | 'disabled'
  | 'geoBlocked'
  | 'unavailable'
  | 'sanctioned'
  | 'network';

// Veto errors are compliance/fail-closed gates: once one lands it must never
// be replaced by a later async 'ready'/'loading'/'network' write.
const VETO_ERROR_TYPES = new Set<IUnifoldDepositErrorType>([
  'accountMismatch',
  'disabled',
  'geoBlocked',
  'unavailable',
  'sanctioned',
]);

export type IUnifoldAddressState =
  | { status: 'loading' }
  | { status: 'ready'; result: IUnifoldDepositAddressResult }
  | {
      status: 'error';
      errorType: IUnifoldDepositErrorType;
      message?: string;
    };

export interface IUnifoldSourceSelection {
  asset: IUnifoldSupportedAsset;
  chain: IUnifoldSupportedAssetChain;
}

function readErrorCode(error: unknown): number | undefined {
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : undefined;
  return typeof record?.code === 'number' ? record.code : undefined;
}

function toErrorType(error: unknown): IUnifoldDepositErrorType {
  const code = readErrorCode(error);
  if (code === UNIFOLD_ERROR_CODE_FEATURE_DISABLED) {
    return 'disabled';
  }
  if (code === UNIFOLD_ERROR_CODE_GEO_BLOCKED) {
    return 'geoBlocked';
  }
  if (code === 10_422) {
    return 'unavailable';
  }
  return 'network';
}

function isVetoState(state: IUnifoldAddressState): boolean {
  return state.status === 'error' && VETO_ERROR_TYPES.has(state.errorType);
}

// Default-selection rules mirror the SDK's useDefaultToken: exact token
// address + chain match first, then symbol + chain, then first token/chain.
function pickDefaultSelection(
  assets: IUnifoldSupportedAsset[],
): IUnifoldSourceSelection | null {
  const usableAssets = assets.filter((a) => (a.chains ?? []).length > 0);
  if (!usableAssets.length) {
    return null;
  }
  const bySymbol = usableAssets.find(
    (a) =>
      a.symbol?.toUpperCase() === DEFAULT_SOURCE_SYMBOL &&
      a.chains.some((c) => c.chain_id === DEFAULT_SOURCE_CHAIN_ID),
  );
  if (bySymbol) {
    return {
      asset: bySymbol,
      chain:
        bySymbol.chains.find((c) => c.chain_id === DEFAULT_SOURCE_CHAIN_ID) ??
        bySymbol.chains[0],
    };
  }
  return { asset: usableAssets[0], chain: usableAssets[0].chains[0] };
}

export function usePerpsUnifoldDepositSession({
  enabled,
  expectedRecipient,
}: {
  enabled: boolean;
  // Address captured when the deposit entry was pressed. It is never trusted
  // directly: the guard below cross-checks it against the live active-account
  // atom at session start (security MUST-2) and fails closed on any mismatch,
  // so a stale capture or tampered route param can never become the recipient.
  expectedRecipient: string | null | undefined;
}) {
  const recipientRef = useRef<string | null | undefined>(undefined);
  if (recipientRef.current === undefined) {
    const activeAccount = jotaiDefaultStore.get(perpsActiveAccountAtom.atom());
    recipientRef.current = getSafeUnifoldRecipient({
      recipient: expectedRecipient,
      activeAccountAddress: activeAccount.accountAddress,
    });
  }
  const recipientAddress = recipientRef.current ?? null;

  // Destination is frozen for the whole session: the address, the catalog and
  // the activation gate must all agree on one destination even if the dev
  // switch is toggled mid-session.
  const [devSettings] = useDevSettingsPersistAtom();
  const destinationRef = useRef<IUnifoldDepositDestination | undefined>(
    undefined,
  );
  if (!destinationRef.current) {
    destinationRef.current = resolveUnifoldDepositDestination(devSettings);
  }
  const destination = destinationRef.current;
  const isHyperCoreDestination = isUnifoldHyperCoreDestination(destination);

  const sessionStartRef = useRef<number>(Date.now() - SESSION_LOOKBACK_MS);

  const [addressState, setAddressStateRaw] = useState<IUnifoldAddressState>(
    recipientAddress
      ? { status: 'loading' }
      : { status: 'error', errorType: 'accountMismatch' },
  );
  // Mirrors whether a veto has landed, readable from async callbacks.
  const vetoRef = useRef<boolean>(!recipientAddress);

  // Veto-sticky state writer: 'ready'/'loading'/'network' can never replace a
  // landed veto; vetoes always win (last veto sticks).
  const applyAddressState = useCallback((next: IUnifoldAddressState) => {
    setAddressStateRaw((prev) => {
      if (isVetoState(next)) {
        vetoRef.current = true;
        return next;
      }
      if (isVetoState(prev)) {
        return prev;
      }
      return next;
    });
  }, []);

  const [selection, setSelection] = useState<IUnifoldSourceSelection | null>(
    null,
  );
  const [sessionExecutions, setSessionExecutions] = useState<
    IUnifoldDepositExecution[]
  >([]);
  const [showWaitingUi, setShowWaitingUi] = useState(false);

  // ── Source catalog (also the fail-closed destination veto). Effect-based
  // with a 5s retry so a transient failure never bricks the modal silently. ──
  const [supportedAssets, setSupportedAssets] = useState<
    IUnifoldSupportedAsset[] | undefined
  >(undefined);
  const [assetsAttempt, setAssetsAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !recipientAddress) {
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const assets =
          await backgroundApiProxy.serviceUnifoldDeposit.getSupportedAssets(
            destination,
          );
        if (!cancelled) {
          setSupportedAssets(assets);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorType = toErrorType(error);
        if (errorType === 'network') {
          retryTimer = setTimeout(() => {
            if (!cancelled) {
              setAssetsAttempt((n) => n + 1);
            }
          }, RETRY_INTERVAL_MS);
        } else {
          applyAddressState({ status: 'error', errorType });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [
    enabled,
    recipientAddress,
    assetsAttempt,
    applyAddressState,
    destination,
  ]);

  useEffect(() => {
    if (!supportedAssets || selection) {
      return;
    }
    if (!hasUsableUnifoldSupportedAssets(supportedAssets)) {
      applyAddressState({ status: 'error', errorType: 'unavailable' });
      return;
    }
    setSelection(pickDefaultSelection(supportedAssets));
  }, [supportedAssets, selection, applyAddressState]);

  // Mirrors the SDK chain-snap rule: picking a token whose chains do not
  // include the current chain snaps to that token's first chain.
  const selectToken = useCallback((asset: IUnifoldSupportedAsset) => {
    setSelection((prev) => {
      const chain =
        asset.chains.find((c) => c.chain_id === prev?.chain.chain_id) ??
        asset.chains[0];
      return chain ? { asset, chain } : prev;
    });
  }, []);

  const selectChain = useCallback((chain: IUnifoldSupportedAssetChain) => {
    setSelection((prev) => (prev ? { ...prev, chain } : prev));
  }, []);

  // ── Deposit address (echo-checked in bg); 5s auto-retry on failure ──
  const [addressAttempt, setAddressAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !recipientAddress || vetoRef.current) {
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const result =
          await backgroundApiProxy.serviceUnifoldDeposit.createDepositAddress({
            recipientAddress,
            ...destination,
          });
        if (!cancelled) {
          applyAddressState({ status: 'ready', result });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorType = toErrorType(error);
        applyAddressState({
          status: 'error',
          errorType,
          message: error instanceof Error ? error.message : undefined,
        });
        if (errorType === 'network') {
          retryTimer = setTimeout(() => {
            if (!cancelled && !vetoRef.current) {
              applyAddressState({ status: 'loading' });
              setAddressAttempt((n) => n + 1);
            }
          }, RETRY_INTERVAL_MS);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [
    enabled,
    recipientAddress,
    addressAttempt,
    applyAddressState,
    destination,
  ]);

  // ── HyperCore activation status (server caches 2min) ──
  // Activation is HyperCore-only (the vendor endpoint is
  // /addresses/hypercore/activation), so it is skipped entirely for any other
  // destination — including the dev Arbitrum one.
  const { result: activationStatus } = usePromiseResult(
    async () => {
      if (!enabled || !recipientAddress || !isHyperCoreDestination) {
        return undefined;
      }
      try {
        return await backgroundApiProxy.serviceUnifoldDeposit.getActivationStatus(
          { recipientAddress },
        );
      } catch {
        // Warning is best-effort; the sanction gate below stays undefined
        // (non-blocking) on lookup failure, matching the SDK.
        return undefined;
      }
    },
    [enabled, recipientAddress, isHyperCoreDestination],
    {},
  );

  useEffect(() => {
    if (activationStatus?.isSanctioned) {
      applyAddressState({ status: 'error', errorType: 'sanctioned' });
    }
  }, [activationStatus?.isSanctioned, applyAddressState]);

  const showActivationWarning = Boolean(
    isHyperCoreDestination &&
    activationStatus &&
    !activationStatus.userExists &&
    !activationStatus.sponsored &&
    !activationStatus.isSanctioned,
  );

  // ── Executions poll (3s while mounted and address is ready) ──
  const seenRef = useRef(new Map<string, IUnifoldExecutionStatus>());
  // The first successful tick primes the seen map WITHOUT announcing: a modal
  // reopen within the 60s lookback must not re-toast an already-announced
  // (possibly already-terminal) execution.
  const primedRef = useRef(false);
  const tickBusyRef = useRef(false);
  const addressReady = addressState.status === 'ready';
  useEffect(() => {
    if (!enabled || !recipientAddress || !addressReady) {
      return;
    }
    // This live session takes over announcements for the recipient — remove
    // its entries from the bg tracking loop so terminal transitions are not
    // double-toasted. In-flight executions re-register on unmount below.
    void backgroundApiProxy.serviceUnifoldDeposit.claimTrackedExecutions({
      recipientAddress,
    });

    const waitingTimer = setTimeout(() => {
      setShowWaitingUi(true);
    }, WAITING_UI_DELAY_MS);

    let cancelled = false;
    const tick = async () => {
      if (tickBusyRef.current) {
        return;
      }
      tickBusyRef.current = true;
      try {
        const items =
          await backgroundApiProxy.serviceUnifoldDeposit.listDepositExecutions({
            recipientAddress,
            since: String(sessionStartRef.current),
          });
        if (cancelled) {
          return;
        }
        setSessionExecutions(items);
        const priming = !primedRef.current;
        primedRef.current = true;
        // Announce transitions oldest → newest so multi-deposit sessions play
        // back in order.
        for (const item of [...items].toReversed()) {
          const seenStatus = seenRef.current.get(item.executionId);
          if (seenStatus !== item.status) {
            seenRef.current.set(item.executionId, item.status);
            if (!priming && item.terminal && item.status === 'succeeded') {
              Toast.success({
                title: `Deposit completed ${formatUnifoldUsdAmount(
                  item.destinationAmountUsd ?? item.sourceAmountUsd,
                )}`,
              });
              void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
            }
            // failed/refunded and progress states render via the status cards;
            // no extra toast (contract §1: never invent failure copy).
          }
        }
      } catch {
        // Transient poll failure: keep polling.
      } finally {
        tickBusyRef.current = false;
      }
    };
    void tick();
    const timer = setInterval(() => {
      void tick();
    }, EXECUTIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(waitingTimer);
    };
  }, [enabled, recipientAddress, addressReady]);

  // ── Hand off in-flight executions to the bg tracking loop on unmount ──
  const sessionExecutionsRef = useRef(sessionExecutions);
  sessionExecutionsRef.current = sessionExecutions;
  const sessionIdRef = useRef<string | null>(null);
  if (addressState.status === 'ready') {
    sessionIdRef.current = addressState.result.sessionId;
  }
  const recipientForCleanup = recipientAddress;
  useEffect(() => {
    if (!recipientForCleanup) {
      return;
    }
    return () => {
      const inFlight = sessionExecutionsRef.current.filter(
        (item) => !item.terminal,
      );
      if (inFlight.length) {
        void backgroundApiProxy.serviceUnifoldDeposit.trackExecutionsAfterModalClose(
          {
            recipientAddress: recipientForCleanup,
            sessionId: sessionIdRef.current,
            executions: inFlight.map((item) => ({
              executionId: item.executionId,
              lastStatus: item.status,
            })),
          },
        );
      }
    };
  }, [recipientForCleanup]);

  const qrAddress = useMemo(() => {
    if (addressState.status !== 'ready' || !selection) {
      return null;
    }
    const wallet = addressState.result.wallets.find(
      (w) => w.chainType === selection.chain.chain_type,
    );
    return wallet?.address ?? null;
  }, [addressState, selection]);

  const hasDetectedExecution = sessionExecutions.length > 0;

  return {
    recipientAddress,
    destination,
    // Dev builds can route to a plain chain, where funds land in the user's
    // own wallet rather than the perps account — callers keep their copy
    // neutral when this is false.
    isHyperCoreDestination,
    addressState,
    sessionId:
      addressState.status === 'ready' ? addressState.result.sessionId : null,
    supportedAssets,
    assetsLoading: supportedAssets === undefined,
    selection,
    selectToken,
    selectChain,
    qrAddress,
    sessionExecutions,
    showWaitingUi: showWaitingUi && !hasDetectedExecution,
    activationFee: activationStatus?.activationFee ?? null,
    showActivationWarning,
  };
}
