import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import type {
  ISiblingDeriveBalance,
  ISiblingDeriveBalancesResult,
} from './useSiblingDeriveBalances';

// Lower index = preferred (cheaper on-chain fees per byte).
const FEE_TIER_ORDER: EAddressEncodings[] = [
  EAddressEncodings.P2WPKH,
  EAddressEncodings.P2TR,
  EAddressEncodings.P2SH_P2WPKH,
  EAddressEncodings.P2PKH,
];

function feeTierIndex(encoding?: EAddressEncodings): number {
  if (!encoding) return Number.MAX_SAFE_INTEGER;
  const idx = FEE_TIER_ORDER.indexOf(encoding);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

// Exported for unit tests; the hook is the canonical entry point.
//
// Selection compares raw balance against the typed amount. Tx fees are NOT
// reserved here: the dropdown the user is reading shows raw balance, and
// the form's own `isInsufficientBalance` is also a bare comparison
// (`amount > maxBalance`). Reserving an additional buffer here would mean
// auto-switch silently disagrees with what the user sees, and small-amount
// scenarios on testnets get falsely rejected. If the auto-switched account
// can't actually cover the on-chain fee, the next page's fee estimation will
// surface that — and the user can manually switch back.
//
// `excludeDeriveTypes` lets the caller block accounts we have already auto-
// switched _away from_ in this form lifetime, preventing a back-and-forth
// loop when multiple deriveTypes can cover successive amount bumps.
//
// Tiebreak direction depends on `amount`:
// - `amount > 0` (cascade case): same fee tier → SMALLEST sufficient balance,
//   so we don't tap the user's biggest savings account unnecessarily.
// - `amount === 0` (entry case where the user landed on a 0-balance account):
//   same fee tier → LARGEST balance, so they enter on their main pile.
export function pickBestSibling({
  siblings,
  amount,
  currentDeriveType,
  excludeDeriveTypes,
}: {
  siblings: ISiblingDeriveBalance[];
  amount: BigNumber;
  currentDeriveType: IAccountDeriveTypes | undefined;
  excludeDeriveTypes?: ReadonlySet<IAccountDeriveTypes>;
}): ISiblingDeriveBalance | undefined {
  const candidates = siblings.filter(
    (s) =>
      s.deriveType !== currentDeriveType &&
      !excludeDeriveTypes?.has(s.deriveType) &&
      s.availableBalance.isGreaterThan(0) &&
      s.availableBalance.isGreaterThanOrEqualTo(amount),
  );
  if (candidates.length === 0) return undefined;

  // -1 = descending (largest first), 1 = ascending (smallest first).
  const balanceTiebreakDir = amount.isZero() ? -1 : 1;

  return candidates.toSorted((a, b) => {
    const tierDiff =
      feeTierIndex(a.deriveInfo.addressEncoding) -
      feeTierIndex(b.deriveInfo.addressEncoding);
    if (tierDiff !== 0) return tierDiff;
    return (
      (a.availableBalance.comparedTo(b.availableBalance) ?? 0) *
      balanceTiebreakDir
    );
  })[0];
}

export type IAutoSwitchInfo = {
  from: {
    accountId: string;
    deriveType: IAccountDeriveTypes;
    deriveInfo: IAccountDeriveInfo;
  };
  to: ISiblingDeriveBalance;
};

type IParams = {
  // Token-denominated: compared directly against sibling token balances (the
  // caller converts fiat input to token units before passing it).
  amount: string;
  // Raw form input (fiat string in fiat mode, token string in token mode) plus
  // the current display mode. Used ONLY as the manual-switch lock basis — the
  // raw input is invariant to async price changes/account switches that move
  // the derived `amount`, so the lock releases only on a genuine user edit.
  userInputAmount: string;
  isUseFiat: boolean;
  isInsufficientBalance: boolean;
  enabled: boolean;
  currentAccountId: string;
  currentDeriveType: IAccountDeriveTypes | undefined;
  currentDeriveInfo: IAccountDeriveInfo | undefined;
  // Used together with `currentMaxBalance` for the entry-case trigger. Set
  // to true only after the form has fetched a real balance for the current
  // account at least once (so we don't fire a switch off the not-yet-loaded
  // default of '0').
  isCurrentBalanceLoaded: boolean;
  currentMaxBalance: string;
  fetchSiblings: () => Promise<ISiblingDeriveBalancesResult>;
  performSwitch: (target: ISiblingDeriveBalance) => void;
};

// Drives the BTC-style "current address format has 0/insufficient balance,
// but Taproot has plenty — auto-switch + tell the user" interaction.
//
// Two trigger paths:
// 1. **Cascade (amount-driven)** — the user typed an amount that exceeds
//    the current account; we walk forward in fee-tier order, never
//    revisiting an account we have already auto-switched away from
//    (`triedDeriveTypesRef`).
// 2. **Entry (balance-driven)** — the user landed on a deriveType whose
//    balance is exactly 0 (no point staying here at all); on first
//    settled load we redirect them to the largest non-empty sibling.
//
// Manual deriveType changes (via the AddressTypeSelector, or a wholesale
// account switch from the global selector) lock auto-switch out until the
// user types a *different* amount — i.e. one keystroke after the manual
// switch re-enables the heuristic. Rationale: a manual switch is "I want
// to act from this account now"; staying locked across new amounts would
// be paternalistic, but firing immediately off the residual amount would
// undo the user's choice without them doing anything. Re-engagement on
// next typed value matches the typed-trigger philosophy of the feature.
// If the user wants to keep a manually selected account, they can type an
// amount that fits or hit "max".
export function useAutoSwitchDeriveType({
  amount,
  userInputAmount,
  isUseFiat,
  isInsufficientBalance,
  enabled,
  currentAccountId,
  currentDeriveType,
  currentDeriveInfo,
  isCurrentBalanceLoaded,
  currentMaxBalance,
  fetchSiblings,
  performSwitch,
}: IParams) {
  const [autoSwitchInfo, setAutoSwitchInfo] = useState<IAutoSwitchInfo | null>(
    null,
  );
  const [pulseSignal, setPulseSignal] = useState(0);
  // The typed amount at which we last concluded no deriveType can cover the
  // send. `null` = no such conclusion currently in effect. Doubles as the
  // skip-threshold (re-check is suppressed while amount ≥ this) AND the
  // "show all-formats-short copy" flag returned to the caller.
  const [allFormatsInsufficientAmount, setAllFormatsInsufficientAmount] =
    useState<BigNumber | null>(null);

  const userManuallySwitchedRef = useRef(false);
  // Snapshot of the user's raw input (+ display mode) at the moment of the most
  // recent manual switch. The manual lock is lifted as soon as the raw input
  // differs from this — i.e. one keystroke of "real" new input is required
  // before auto-switch can fire again. We snapshot the raw input rather than
  // the token-denominated `amount` so an async price load / account switch that
  // moves the derived value (without any user edit) can't silently release the
  // lock and undo the user's manual choice.
  const manualSwitchSnapshotRef = useRef<{
    amount: string;
    isUseFiat: boolean;
  } | null>(null);
  // DeriveTypes we have auto-switched _away from_ in this form lifetime.
  // Used to prevent ping-ponging between two accounts as the user adjusts
  // the amount up and down.
  const triedDeriveTypesRef = useRef<Set<IAccountDeriveTypes>>(new Set());
  // Tracks our self-initiated accountId switch so the manual-detection effect
  // below does not flip `userManuallySwitchedRef` to true on our own change.
  const lastAutoSwitchAccountIdRef = useRef<string | null>(null);
  const previousAccountIdRef = useRef(currentAccountId);
  const inFlightRef = useRef(false);
  // Bumps each time the effect kicks off a fresh fetch — used by the in-flight
  // async closure to detect that the user typed something new while it was
  // waiting for siblings, so it can drop the now-stale result instead of
  // calling `performSwitch` with values that no longer reflect the form.
  const fetchGenerationRef = useRef(0);
  // Mirrors the live `amount` prop so the async closure can detect that the
  // user typed something new since dispatch (the closure's own `amountBN` was
  // captured at effect-fire time and may be stale by resolution).
  const amountRef = useRef(amount);
  amountRef.current = amount;
  // Mirror the raw input + mode for the manual-switch detection effect, which
  // snapshots them synchronously when an external account change is observed.
  const userInputAmountRef = useRef(userInputAmount);
  userInputAmountRef.current = userInputAmount;
  const isUseFiatRef = useRef(isUseFiat);
  isUseFiatRef.current = isUseFiat;
  // Mirrors `enabled` so the async closure can detect a mid-flight disable
  // (e.g. user enabled coin-control during the fetch). The main effect
  // early-returns on `!enabled` without incrementing the generation, so
  // generation alone won't catch this.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Tripped on hook unmount. In-flight closures must bail before touching
  // any shared state (`performSwitch` clears UTXOs on the shared
  // sendConfirm context — if the page already navigated away, that would
  // pollute a future Send mount).
  const cancelledRef = useRef(false);
  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );
  // Set when the effect wanted to run but a sibling fetch was already in
  // flight. The in-flight closure bumps `rerunTick` on settle so the effect
  // re-evaluates against whatever the user typed meanwhile — clearing a ref
  // alone does not trigger a render.
  const pendingRerunRef = useRef(false);
  const [rerunTick, setRerunTick] = useState(0);

  // Detect manual switches: any change to currentAccountId that we didn't
  // initiate ourselves.
  useEffect(() => {
    if (currentAccountId === previousAccountIdRef.current) return;
    const wasOurs = lastAutoSwitchAccountIdRef.current === currentAccountId;
    if (wasOurs) {
      // Consume the marker — it only protects the immediate accountId
      // change driven by `performSwitch`. If the user later navigates away
      // and then manually picks this same target again, that visit must be
      // recognized as manual (otherwise the manual lock would never engage
      // and residual amounts could re-trigger auto-switch, undoing the
      // user's explicit re-selection).
      lastAutoSwitchAccountIdRef.current = null;
    } else {
      userManuallySwitchedRef.current = true;
      // Snapshot the live raw input + mode so the main effect can detect the
      // next real edit as the trigger to re-engage auto-switch.
      manualSwitchSnapshotRef.current = {
        amount: userInputAmountRef.current,
        isUseFiat: isUseFiatRef.current,
      };
      // Hide the auto-switch alert if user picked a different format
      // (including reverting back to the original).
      setAutoSwitchInfo(null);
    }
    previousAccountIdRef.current = currentAccountId;
  }, [currentAccountId]);

  // A pure fiat/token display toggle re-derives the raw input's representation
  // (e.g. "10" fiat ↔ "5" token) without being a real amount edit. When a
  // manual lock is held, re-baseline its snapshot to the new mode's raw input
  // so the toggle isn't mistaken for an edit (which would release the lock) yet
  // a later genuine edit in the new mode is still detected. Declared before the
  // main effect so the snapshot is up to date by the time that effect reads it.
  const prevIsUseFiatRef = useRef(isUseFiat);
  useEffect(() => {
    if (prevIsUseFiatRef.current === isUseFiat) return;
    prevIsUseFiatRef.current = isUseFiat;
    if (userManuallySwitchedRef.current && manualSwitchSnapshotRef.current) {
      manualSwitchSnapshotRef.current = {
        amount: userInputAmountRef.current,
        isUseFiat,
      };
    }
  }, [isUseFiat]);

  useEffect(() => {
    if (!enabled) {
      // Feature got disabled mid-flow (e.g. user enabled coin-control). Drop
      // the cached "no format covers" verdict so the alert doesn't survive
      // into a context with a different balance basis. We intentionally leave
      // `triedDeriveTypes` and the manual-lock refs alone — they describe
      // lifetime intent and stay valid across a brief disable→enable toggle.
      if (allFormatsInsufficientAmount) setAllFormatsInsufficientAmount(null);
      return;
    }

    // Both trigger paths read balance-derived signals (`isInsufficientBalance`
    // and `currentMaxBalance`). Until the balance belonging to the *current*
    // account has settled, those signals still describe the previously
    // selected account — `isCurrentBalanceLoaded` encodes "loaded AND for
    // currentAccountId" (see the call site). Acting earlier would auto-switch
    // again off an account we never actually measured.
    if (!isCurrentBalanceLoaded) return;

    // The entry-case fires when the user lands on a 0-balance deriveType.
    const isCurrentBalanceZero = new BigNumber(currentMaxBalance || 0).isZero();

    if (!isInsufficientBalance && !isCurrentBalanceZero) {
      // Amount fits the current account again — clear the "all formats short"
      // state even if the user is still typing.
      if (allFormatsInsufficientAmount) setAllFormatsInsufficientAmount(null);
      return;
    }
    if (userManuallySwitchedRef.current) {
      // Stay locked until the user's raw input differs from the snapshot taken
      // at the manual switch; only then treat it as a fresh evaluation and
      // clear the lock, the tried-set, and the "all formats short" threshold.
      //
      // We compare the raw input (`userInputAmount`), not the token-denominated
      // `amount`: the latter is re-derived from price in fiat mode, so an async
      // price load or account switch would move it with no user action and
      // falsely release the lock. The raw input only changes on a real edit.
      const snapshot = manualSwitchSnapshotRef.current;
      // Defensive: the toggle effect re-baselines on a mode flip, so by here
      // the snapshot mode normally matches. If it lags (effect ordering), a
      // mode mismatch means the difference is a pure display toggle, not an
      // edit — re-baseline and stay locked instead of reading it as an edit.
      if (snapshot !== null && snapshot.isUseFiat !== isUseFiat) {
        manualSwitchSnapshotRef.current = {
          amount: userInputAmount,
          isUseFiat,
        };
        return;
      }
      // `sameAmount` requires a non-null snapshot, so the numeric compare can
      // never read a null snapshot as 0 (which would hold the lock forever at
      // amount '0'); the null case is handled by the early return. The string
      // check is a fast path that also keeps empty/empty equal.
      const sameAmount =
        snapshot !== null &&
        (userInputAmount === snapshot.amount ||
          new BigNumber(userInputAmount || 0).isEqualTo(
            new BigNumber(snapshot.amount || 0),
          ));
      if (snapshot === null || sameAmount) {
        return;
      }
      userManuallySwitchedRef.current = false;
      manualSwitchSnapshotRef.current = null;
      triedDeriveTypesRef.current.clear();
      setAllFormatsInsufficientAmount(null);
    }
    if (inFlightRef.current) {
      // A sibling fetch is already running. Remember to re-evaluate once it
      // settles — the user may type a new amount this run will never see.
      pendingRerunRef.current = true;
      return;
    }

    const amountBN = new BigNumber(amount || 0);
    if (amountBN.isNaN() || amountBN.isNegative()) return;
    // The cascade case needs a positive typed amount; the entry case is
    // driven purely by `isCurrentBalanceZero`, so amount=0 is valid there.
    if (amountBN.isZero() && !isCurrentBalanceZero) return;

    // We previously concluded no deriveType can cover the send. Stay out of
    // the way while the amount holds at or above that threshold; a smaller
    // amount may now fit some sibling, so let it through.
    if (
      allFormatsInsufficientAmount &&
      amountBN.isGreaterThanOrEqualTo(allFormatsInsufficientAmount)
    ) {
      return;
    }

    // After a successful auto-switch the previous deriveType has been added
    // to `triedDeriveTypesRef`, but `useAccountData` is asynchronous — so for
    // one or more renders `currentDeriveType` still describes the OLD
    // account, which would otherwise re-trigger the effect with stale state
    // and fire a duplicate toast / pulse. Skip until the form has settled.
    if (currentDeriveType && triedDeriveTypesRef.current.has(currentDeriveType))
      return;

    inFlightRef.current = true;
    fetchGenerationRef.current += 1;
    const generation = fetchGenerationRef.current;

    void (async () => {
      try {
        const { siblings, hadError } = await fetchSiblings();
        // Bail if the hook unmounted, the effect re-ran while we were
        // fetching, the feature got disabled (e.g. coin-control toggle), the
        // user typed a fresh amount, or manually switched.
        if (cancelledRef.current) return;
        if (generation !== fetchGenerationRef.current) return;
        if (!enabledRef.current) return;
        if (userManuallySwitchedRef.current) return;
        if (amount !== amountRef.current) return;

        const target = pickBestSibling({
          siblings,
          amount: amountBN,
          currentDeriveType,
          excludeDeriveTypes: triedDeriveTypesRef.current,
        });

        if (!target) {
          // Entry case (amount 0): silently bail. Otherwise act only when every
          // sibling was actually fetched — a failed RPC must not look like
          // "no funds": clear any stale "auto-switched" banner so it can't mask
          // the warning, and raise the all-formats-insufficient warning. On a
          // fetch error we leave prior state untouched (conservative — we can't
          // tell "no covering format" from "couldn't check", and silently
          // dropping the success banner on a transient blip would be worse).
          if (!amountBN.isZero() && !hadError) {
            setAutoSwitchInfo(null);
            setAllFormatsInsufficientAmount(amountBN);
          }
          return;
        }

        if (!currentDeriveType || !currentDeriveInfo) return;

        // Mark the deriveType we are leaving so we never auto-switch back
        // to it (the user can still pick it manually via the selector).
        triedDeriveTypesRef.current.add(currentDeriveType);
        lastAutoSwitchAccountIdRef.current = target.accountId;
        performSwitch(target);
        setPulseSignal((n) => n + 1);
        setAutoSwitchInfo({
          from: {
            accountId: currentAccountId,
            deriveType: currentDeriveType,
            deriveInfo: currentDeriveInfo,
          },
          to: target,
        });
        setAllFormatsInsufficientAmount(null);
      } finally {
        inFlightRef.current = false;
        // Re-evaluate anything the user typed while this fetch was in flight,
        // unless we've unmounted (in which case there is nothing to re-render).
        if (pendingRerunRef.current && !cancelledRef.current) {
          pendingRerunRef.current = false;
          setRerunTick((n) => n + 1);
        }
      }
    })();
  }, [
    enabled,
    isInsufficientBalance,
    isCurrentBalanceLoaded,
    currentMaxBalance,
    amount,
    userInputAmount,
    isUseFiat,
    currentAccountId,
    currentDeriveType,
    currentDeriveInfo,
    fetchSiblings,
    performSwitch,
    allFormatsInsufficientAmount,
    rerunTick,
  ]);

  const dismissAutoSwitchInfo = useCallback(() => {
    setAutoSwitchInfo(null);
  }, []);

  return {
    autoSwitchInfo,
    dismissAutoSwitchInfo,
    pulseSignal,
    allFormatsInsufficient: allFormatsInsufficientAmount !== null,
  };
}
