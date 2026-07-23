// cspell: words unifold Unifold hypercore Hypercore
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  perpsActiveAccountAtom,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatUnifoldUsdAmount } from '@onekeyhq/shared/src/utils/unifoldDepositUtils';
import type {
  IUnifoldActivationStatus,
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
// Must stay well under the background loop's mute expiry so a long-lived modal
// never lets the loop start announcing behind it. Renewal is wall-clock
// checked from the 3s poll tick rather than run on its own timer: mobile
// suspends JS timers in the background while the mute keeps aging on the wall
// clock, so the claim must be re-issued within seconds of foreground resume.
const TRACKING_CLAIM_RENEW_INTERVAL_MS = 60_000;

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
  //
  // This is a compliance gate, not just the fee warning: contract v1.1 §2.4
  // makes `isSanctioned` a MUST-block, which goes beyond the SDK (warn only).
  // A failed lookup therefore must not fall through as a silent pass — it
  // keeps the address gated (below) and retries every 5s until the screen
  // actually answers.
  const [activationStatus, setActivationStatus] = useState<
    IUnifoldActivationStatus | undefined
  >(undefined);
  const [activationAttempt, setActivationAttempt] = useState(0);
  const [activationLookupFailed, setActivationLookupFailed] = useState(false);
  useEffect(() => {
    if (!enabled || !recipientAddress || !isHyperCoreDestination) {
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const status =
          await backgroundApiProxy.serviceUnifoldDeposit.getActivationStatus({
            recipientAddress,
          });
        if (!cancelled) {
          setActivationStatus(status);
          setActivationLookupFailed(false);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorType = toErrorType(error);
        if (errorType !== 'network') {
          // Terminal code (disabled / geo-blocked / unavailable): mirror the
          // catalog effect and fail closed with the matching veto instead of
          // retrying a request that will never start succeeding.
          applyAddressState({ status: 'error', errorType });
          return;
        }
        setActivationLookupFailed(true);
        retryTimer = setTimeout(() => {
          if (!cancelled) {
            setActivationAttempt((n) => n + 1);
          }
        }, RETRY_INTERVAL_MS);
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
    isHyperCoreDestination,
    activationAttempt,
    applyAddressState,
  ]);

  useEffect(() => {
    if (activationStatus?.isSanctioned) {
      applyAddressState({ status: 'error', errorType: 'sanctioned' });
    }
  }, [activationStatus?.isSanctioned, applyAddressState]);

  // Fail-closed sanction gate: a HyperCore deposit address is neither shown
  // nor copyable until the screen has answered NOT sanctioned. Keying on the
  // verdict rather than "a response arrived" closes two holes: a null or
  // partial payload cannot open the gate (`requestUnifold` passes the
  // envelope's `data` through verbatim, and this API is known to return
  // nullish data on code 0), and a sanctioned verdict blocks in the same
  // render that receives it instead of one passive-effect pass later — which
  // would otherwise paint the QR and its copy row for exactly one commit.
  const activationGatePassed =
    !isHyperCoreDestination || activationStatus?.isSanctioned === false;

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
  // Outcomes this session announced itself; reported at unmount so the bg
  // loop never announces them a second time.
  const announcedRef = useRef(new Set<string>());
  // In-flight executions already registered with the bg tracker (muted), so a
  // hard-killed session (popup closed, app killed) leaves nothing behind that
  // only React state knew about.
  const bgTrackedRef = useRef(new Set<string>());
  const lastClaimAtRef = useRef(0);
  // Gates the unmount handoff: a session that never claimed tracking (address
  // never became ready) has nothing to hand back.
  const claimedRef = useRef(false);
  // Held in a ref so a locale change never restarts the poll.
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  // The poll starts once the address is ready and then stays up for the rest
  // of the session. A veto that lands later (sanction, catalog error) must not
  // tear down tracking while money is already in flight.
  const [pollEnabled, setPollEnabled] = useState(false);
  if (addressState.status === 'ready' && !pollEnabled) {
    setPollEnabled(true);
  }
  const sessionIdRef = useRef<string | null>(null);
  if (addressState.status === 'ready') {
    sessionIdRef.current = addressState.result.sessionId;
  }
  useEffect(() => {
    if (!enabled || !recipientAddress || !pollEnabled) {
      return;
    }
    // This live session takes over announcements for the recipient (and arms
    // the recipient watch), so the bg tracking loop stays quiet and terminal
    // transitions are not double toasted. The claim expires on its own and is
    // renewed from the poll tick below: that is what lets the bg loop recover
    // if this session dies without running its unmount handler.
    const claim = () => {
      claimedRef.current = true;
      lastClaimAtRef.current = Date.now();
      void backgroundApiProxy.serviceUnifoldDeposit.claimDepositSessionTracking(
        {
          recipientAddress,
          sessionId: sessionIdRef.current,
          sessionStart: sessionStartRef.current,
        },
      );
    };
    claim();

    const waitingTimer = setTimeout(() => {
      setShowWaitingUi(true);
    }, WAITING_UI_DELAY_MS);

    let cancelled = false;
    const tick = async () => {
      // Renewal must not sit behind the busy gate: a poll request left
      // hanging across a mobile suspension keeps tickBusyRef true well past
      // resume, and starving the claim past the bg loop's one-round unmute
      // grace would let it announce behind this live session. claim() is
      // fire-and-forget and needs no serialization with the poll body.
      if (
        Date.now() - lastClaimAtRef.current >=
        TRACKING_CLAIM_RENEW_INTERVAL_MS
      ) {
        claim();
      }
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
        // Register every in-flight execution with the bg tracker the moment
        // it is first seen (muted): waiting for the unmount handoff would
        // lose it entirely if this session hard-dies (popup closed, app
        // killed) before the cleanup runs.
        const unregistered = items.filter(
          (item) =>
            !item.terminal && !bgTrackedRef.current.has(item.executionId),
        );
        if (unregistered.length) {
          unregistered.forEach((item) =>
            bgTrackedRef.current.add(item.executionId),
          );
          void backgroundApiProxy.serviceUnifoldDeposit.trackLiveSessionExecutions(
            {
              recipientAddress,
              sessionId: sessionIdRef.current,
              executions: unregistered.map((item) => ({
                executionId: item.executionId,
                lastStatus: item.status,
              })),
            },
          );
        }
        const priming = !primedRef.current;
        primedRef.current = true;
        // Announce transitions oldest → newest so multi-deposit sessions play
        // back in order.
        for (const item of [...items].toReversed()) {
          const seenStatus = seenRef.current.get(item.executionId);
          if (seenStatus !== item.status) {
            seenRef.current.set(item.executionId, item.status);
            if (!priming && item.terminal) {
              // This session is announcing the outcome (success toast below;
              // failed/refunded via the status cards), so its tracked entry
              // is settled right now — at unmount it would be unmuted and the
              // bg loop would announce it a second time.
              announcedRef.current.add(item.executionId);
              void backgroundApiProxy.serviceUnifoldDeposit.settleAnnouncedExecution(
                {
                  recipientAddress,
                  executionId: item.executionId,
                },
              );
              if (item.status === 'succeeded') {
                // Same key as the background loop's toast: one event must not
                // be announced in two different languages depending on whether
                // the modal happened to be open.
                Toast.success({
                  title: intlRef.current.formatMessage({
                    id: ETranslations.perp_deposit_success_title,
                  }),
                  message: formatUnifoldUsdAmount(
                    item.destinationAmountUsd ?? item.sourceAmountUsd,
                  ),
                });
                void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
              }
              // failed/refunded render via the status cards; no extra toast
              // (contract §1: never invent failure copy).
            }
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
  }, [enabled, recipientAddress, pollEnabled]);

  // ── Hand tracking back to the bg loop on unmount ──
  // Runs for every session that claimed tracking, even with nothing in
  // flight: it must lift the mute and re-arm the recipient watch so a deposit
  // paid right before closing — one the vendor API has not surfaced yet — is
  // still discovered and announced by the bg loop.
  const sessionExecutionsRef = useRef(sessionExecutions);
  sessionExecutionsRef.current = sessionExecutions;
  const recipientForCleanup = recipientAddress;
  const finalizeSessionTracking = useCallback(() => {
    if (!recipientForCleanup || !claimedRef.current) {
      return;
    }
    const inFlight = sessionExecutionsRef.current.filter(
      (item) => !item.terminal,
    );
    void backgroundApiProxy.serviceUnifoldDeposit.finalizeDepositSessionTracking(
      {
        recipientAddress: recipientForCleanup,
        sessionId: sessionIdRef.current,
        sessionStart: sessionStartRef.current,
        announcedExecutionIds: Array.from(announcedRef.current),
        executions: inFlight.map((item) => ({
          executionId: item.executionId,
          lastStatus: item.status,
        })),
      },
    );
  }, [recipientForCleanup]);
  useEffect(() => {
    if (!recipientForCleanup) {
      return;
    }
    return finalizeSessionTracking;
  }, [recipientForCleanup, finalizeSessionTracking]);

  const qrAddress = useMemo(() => {
    if (
      addressState.status !== 'ready' ||
      !selection ||
      !activationGatePassed
    ) {
      return null;
    }
    const wallet = addressState.result.wallets.find(
      (w) => w.chainType === selection.chain.chain_type,
    );
    return wallet?.address ?? null;
  }, [addressState, selection, activationGatePassed]);

  // The ready address is withheld while the screen is pending, so the QR keeps
  // its skeleton rather than the terminal "No address available" plate: the
  // address was created, only its eligibility is unconfirmed. Reusing the
  // address-failure error state here would assert two false things at once,
  // so the explanation rides on `activationRetrying` below instead — this is
  // never a silent dead end. Derived, never written through
  // `applyAddressState`, so a successful retry restores 'ready' on its own.
  const gatedAddressState: IUnifoldAddressState =
    addressState.status === 'ready' && !activationGatePassed
      ? { status: 'loading' }
      : addressState;

  // Only an execution that is still moving suppresses the waiting hint. A
  // finished deposit stays in the 60s lookback window for the rest of the
  // session, so keying this on "any execution" would silence the panel
  // permanently after the first successful deposit.
  const hasInFlightExecution = sessionExecutions.some((item) => !item.terminal);

  return {
    recipientAddress,
    destination,
    // Dev builds can route to a plain chain, where funds land in the user's
    // own wallet rather than the perps account — callers keep their copy
    // neutral when this is false.
    isHyperCoreDestination,
    addressState: gatedAddressState,
    // Sticky: the support copy on the sanctioned screen quotes this ref, so it
    // must survive a veto that replaces the ready state.
    sessionId: sessionIdRef.current,
    supportedAssets,
    assetsLoading: supportedAssets === undefined,
    selection,
    selectToken,
    selectChain,
    qrAddress,
    sessionExecutions,
    // Never claim to be watching for a deposit to an address the user has not
    // been shown: the poll (and its tracking claim) intentionally starts on
    // the raw ready state so money already in flight keeps being announced,
    // but the hint belongs to a visible address. Keyed on the rendered address
    // itself, which also covers a selected chain with no matching wallet.
    showWaitingUi: showWaitingUi && !hasInFlightExecution && Boolean(qrAddress),
    // The eligibility screen failed and is retrying every 5s: the address
    // stays hidden, and the panel explains why instead of shimmering silently.
    activationRetrying: activationLookupFailed && !activationGatePassed,
    activationFee: activationStatus?.activationFee ?? null,
    showActivationWarning,
  };
}
