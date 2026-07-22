/* cspell:ignore prechecking Refetched */
import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getLastSignedTxid } from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import {
  buildBorrowTokenFromAsset,
  shouldDowngradeAaveNativeRepayAll,
} from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import { useBorrowApproval } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproval';
import type { IBorrowApproveTarget } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/types';
import {
  useUniversalBorrowRepay,
  useUniversalBorrowSetCollateral,
  useUniversalBorrowSetEMode,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { buildNeedActionItems } from '@onekeyhq/kit/src/views/Borrow/pages/BorrowEModeSwitch/emodeUtils';
import { useEModeSwitch } from '@onekeyhq/kit/src/views/Borrow/pages/BorrowEModeSwitch/useEModeSwitch';
import { buildBorrowTag } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { balanceLookupAddress, repayShortfall } from './needActionBalances';
import {
  type IEModeStep,
  type IEModeStepState,
  activeStepIndex,
  bindStepSettlementCallbacks,
  blockerSteps,
  reconcileStepState,
  resolveSettleOutcome,
  shouldRepayAllForEModeStep,
  withSwitchStep,
} from './needActionSteps';

// Active-step sub-state surfaced on the active row: precheck/build in flight
// (Preparing…), the approve engine prompting (Approving…), or the repay tx
// being built (Repaying…).
export type IEModeApproveSubStatus =
  | 'preparing'
  | 'approving'
  | 'repaying'
  | null;

// Bounded recheck while the switch step waits for canSwitch: the check
// endpoint lags the position indexer after the last repay confirms, and the
// confirmation-time rechecks would otherwise be the last ones ever — the
// screen would wait forever with a disabled footer. Mirrors
// waitForTxFinalStatus's 24×5s budget.
const UNLOCK_POLL_MAX_ATTEMPTS = 24;
const UNLOCK_POLL_INTERVAL_MS = 5000;

interface IEModePendingSettlement {
  id: number;
  step: IEModeStep;
  txid: string | undefined;
  controller: AbortController;
}

export function useEModeNeedActionFlow({
  networkId,
  accountId,
  provider,
  marketAddress,
  targetEModeId,
  onAllDone,
}: {
  networkId: string;
  accountId: string;
  provider: string;
  marketAddress: string;
  targetEModeId: number;
  onAllDone: () => void;
}) {
  const mountedRef = useRef(true);
  const onAllDoneRef = useRef(onAllDone);
  onAllDoneRef.current = onAllDone;
  const handleAllDone = useCallback(() => {
    if (mountedRef.current) {
      onAllDoneRef.current();
    }
  }, []);
  const { check, isChecking, runCheck } = useEModeSwitch({
    networkId,
    accountId,
    provider,
    marketAddress,
    onSwitched: handleAllDone, // never reached via this hook (we don't call confirmSwitch)
  });
  const repay = useUniversalBorrowRepay({ networkId, accountId });
  const setCollateral = useUniversalBorrowSetCollateral({
    networkId,
    accountId,
  });
  const setEMode = useUniversalBorrowSetEMode({ networkId, accountId });

  const [stepState, setStepState] = useState<IEModeStepState>(() => ({
    seen: [],
    completed: new Set(),
  }));
  // Busy is derived from these self-resetting flags only; no chain-level
  // "isRunning" is stored, so no cancel / precheck-error path can leave a flag
  // dangling and freeze the screen.
  const [repaySubmitting, setRepaySubmitting] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settlingStepKey, setSettlingStepKey] = useState<string | null>(null);
  // Covers runStep's pre-sheet window (allowance precheck + tx build) so the
  // button never looks idle after a tap. Mirrors ActionFooter.tsx:112-120.
  const [prechecking, setPrechecking] = useState(false);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  // The just-broadcast blocker step, locked as "confirming" until the recheck
  // clears it. Keeps the footer from re-firing it after isSettling drops on a
  // slow confirmation (double-send guard) and drives the inline "confirming" row
  // state — replacing the old dismissible pending sheet that could be closed
  // into a false "failed".
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);

  // Reconcile blockers as fresh checks arrive. This preserves completed rows,
  // refreshes active step payloads, advances after routed secondary clears, and
  // reopens a step when native-ETH dust or a partial clear still returns it.
  useEffect(() => {
    if (check) {
      setHasCheckedOnce(true);
      const current = blockerSteps(buildNeedActionItems(check));
      const hasStructuredBlockerBuckets =
        Array.isArray(check.repayAssets) ||
        Array.isArray(check.additionalRepayAssets) ||
        Array.isArray(check.disableCollateralAssets);
      setStepState((prev) =>
        reconcileStepState(prev, current, {
          canSwitch: check.canSwitch,
          hasStructuredBlockerBuckets,
        }),
      );
    }
  }, [check]);

  const steps = withSwitchStep(stepState.seen);
  const stepIndex = activeStepIndex(steps, stepState.completed);
  const activeStep = steps[stepIndex];

  // Wallet balances for the repay steps' funding tokens (lowercased address →
  // balanceParsed). Refetched whenever a fresh check lands (entry, focus
  // return, post-step recheck, unlock poll), so warnings track reality.
  // Progressive enhancement: unknown balances (fetch pending/failed) never
  // warn and never block.
  const [fundingBalances, setFundingBalances] = useState<
    Record<string, string>
  >({});
  // First-load gate for the active repay step's funding balance: block the
  // footer while it is unknown-and-loading (so no tappable Approve appears before
  // we know the user can fund it), but a failed fetch clears this — never a
  // permanent "checking balance" deadlock.
  const [balancesLoading, setBalancesLoading] = useState(false);
  const balanceSeqRef = useRef(0);
  const balanceRequestPendingRef = useRef(false);
  // JSON key (not join(',')): this string is both the effect's dependency key
  // and the exact list JSON.parsed back to string[] below — a round-trip a
  // joined string could not survive.
  const fundingAddressesKey = JSON.stringify(
    Array.from(
      new Set(
        steps
          .map((s) => balanceLookupAddress({ step: s }))
          .filter((a): a is string => a !== null),
      ),
    ).toSorted(),
  );
  useEffect(() => {
    const seq = (balanceSeqRef.current += 1);
    if (!accountId || fundingAddressesKey === '[]') {
      balanceRequestPendingRef.current = false;
      setBalancesLoading(false);
      return;
    }
    balanceRequestPendingRef.current = true;
    setBalancesLoading(true);
    void (async () => {
      try {
        const details =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            accountId,
            networkId,
            contractList: JSON.parse(fundingAddressesKey) as string[],
          });
        if (balanceSeqRef.current !== seq) {
          return;
        }
        const next: Record<string, string> = {};
        details.forEach((d) => {
          next[(d.info?.address ?? '').toLowerCase()] = d.balanceParsed ?? '0';
        });
        setFundingBalances(next);
      } catch {
        // keep prior balances; unknown never warns.
      } finally {
        if (balanceSeqRef.current === seq) {
          balanceRequestPendingRef.current = false;
          setBalancesLoading(false);
        }
      }
    })();
  }, [check, accountId, networkId, fundingAddressesKey]);

  const shortfallByKey: Record<string, string> = {};
  // Known wallet balances per repay step (raw balanceParsed); unknown entries
  // are simply absent so the UI renders nothing rather than a fake zero.
  const balanceByKey: Record<string, string> = {};
  steps.forEach((s) => {
    const addr = balanceLookupAddress({ step: s });
    if (addr === null) {
      return;
    }
    const balanceParsed = fundingBalances[addr];
    if (balanceParsed !== undefined) {
      balanceByKey[s.key] = balanceParsed;
    }
    const shortfall = repayShortfall({
      step: s,
      balanceParsed,
    });
    if (shortfall) {
      shortfallByKey[s.key] = shortfall;
    }
  });
  const activeShortfall = activeStep
    ? (shortfallByKey[activeStep.key] ?? null)
    : null;

  // The active repay step's funding balance is still on its first fetch: block
  // the footer so it never offers a tappable Approve/Repay before we know the
  // user can fund it. A failed fetch clears balancesLoading, so this falls back
  // to allowing rather than deadlocking on "checking balance".
  const activeRepayAddr =
    activeStep?.kind === 'repay'
      ? balanceLookupAddress({ step: activeStep })
      : null;
  const checkingActiveBalance =
    activeRepayAddr !== null &&
    fundingBalances[activeRepayAddr] === undefined &&
    balancesLoading;

  // Latest active step, read inside async callbacks and the approve engine's
  // onApprovedSubmit to dodge stale closures.
  const activeRef = useRef(activeStep);
  activeRef.current = activeStep;
  const checkRef = useRef(check);
  checkRef.current = check;

  const stakingInfo = useCallback(
    (action: 'repay' | 'setCollateral' | 'setEMode'): IStakingInfo => ({
      label: EEarnLabels.Borrow,
      protocol: earnUtils.getEarnProviderName({ providerName: provider }),
      tags: [EEarnLabels.Borrow, buildBorrowTag({ provider, action })],
    }),
    [provider],
  );

  // Chain intent + re-entrancy — refs only, never drive the UI:
  // - autoAdvanceRef: the one-tap "keep going" intent.
  // - advanceExpectedRef: set in onSuccess when the flow itself confirms a tx and
  //   advances. The effect consumes it to launch the next step. A key change
  //   while armed but WITHOUT this token means an out-of-band recheck moved the
  //   active step (e.g. the user cancelled the engine-owned approve sheet — which
  //   only clears `approving`, never disarms — then cleared that blocker via the
  //   Manage positions link and a focus recheck advanced the key). That must NOT
  //   self-pop the next signature dialog, so the effect disarms instead. Advance
  //   is never inferred from an `approving` true→false edge (the stale-state
  //   class this design bans).
  // - launchedKeyRef: the step key already launched this round. The repay sheet
  //   resolves navigationToTxConfirm on push, so repaySubmitting (and isBusy)
  //   dips to false while the sheet is still open; without this guard the
  //   auto-advance effect would re-fire the same step (a second sheet, an
  //   auto-retry of a cancelled approve, or the USDT reset soft-stop). It never
  //   blocks a manual retry: run() re-launches the active step regardless.
  // - busyRef: synchronous re-entrancy lock for the runStep body (guards the
  //   pre-sheet build window against a double-tap / effect race).
  const autoAdvanceRef = useRef(false);
  const advanceExpectedRef = useRef(false);
  const launchedKeyRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const unlockPollAttemptsRef = useRef(0);
  const settlementSeqRef = useRef(0);
  const settlingIdRef = useRef<number | null>(null);
  const submittedStepRef = useRef<IEModeStep | null>(null);
  const pendingSettlementRef = useRef<IEModePendingSettlement | null>(null);
  const approvalRepayStepRef = useRef<IEModeStep | null>(null);
  const refreshSeqRef = useRef(0);
  const refreshAbortRef = useRef<AbortController | undefined>(undefined);

  const disarm = useCallback(() => {
    autoAdvanceRef.current = false;
  }, []);

  // Aborts the in-flight confirmation poll if the screen unmounts mid-settle, so
  // a backgrounded poll never resolves onto a torn-down hook.
  const settleAbortRef = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      refreshSeqRef.current += 1;
      refreshAbortRef.current?.abort();
      settleAbortRef.current?.abort();
      pendingSettlementRef.current?.controller.abort();
    };
  }, []);

  const finishSettlingUi = useCallback((pending: IEModePendingSettlement) => {
    if (settlingIdRef.current !== pending.id) {
      return;
    }
    settlingIdRef.current = null;
    if (settleAbortRef.current === pending.controller) {
      settleAbortRef.current = undefined;
    }
    if (mountedRef.current) {
      setIsSettling(false);
      setSettlingStepKey(null);
    }
  }, []);

  const releaseSettlementLock = useCallback(
    (pending: IEModePendingSettlement): boolean => {
      if (pendingSettlementRef.current !== pending) {
        return false;
      }
      pendingSettlementRef.current = null;
      if (submittedStepRef.current === pending.step) {
        submittedStepRef.current = null;
      }
      if (mountedRef.current) {
        setSubmittedKey((current) =>
          current === pending.step.key ? null : current,
        );
      }
      return true;
    },
    [],
  );

  const applySettlementStatus = useCallback(
    ({
      pending,
      status,
      abortPoll,
    }: {
      pending: IEModePendingSettlement;
      status: EOnChainHistoryTxStatus | undefined;
      abortPoll: boolean;
    }) => {
      if (!mountedRef.current || pendingSettlementRef.current !== pending) {
        return null;
      }
      const outcome = resolveSettleOutcome(status, pending.step.kind);
      if (outcome === 'confirming') {
        return outcome;
      }
      if (!releaseSettlementLock(pending)) {
        return null;
      }
      if (abortPoll) {
        finishSettlingUi(pending);
        pending.controller.abort();
      }
      if (outcome === 'failed') {
        setFailedKey(pending.step.key);
        disarm();
      } else if (outcome === 'switched') {
        disarm();
        handleAllDone();
      } else {
        setStepState((prev) => ({
          ...prev,
          completed: new Set(prev.completed).add(pending.step.key),
        }));
        // This exact broadcast produced the advance, so the auto-chain may
        // launch the next row once the live check catches up.
        advanceExpectedRef.current = true;
      }
      return outcome;
    },
    [disarm, finishSettlingUi, handleAllDone, releaseSettlementLock],
  );

  // A structured switch-check that drops a submitted blocker is authoritative
  // completion even when the bounded tx-status poll timed out first. Release
  // only that exact settlement and preserve the one-tap auto-chain intent.
  useEffect(() => {
    const pending = pendingSettlementRef.current;
    if (
      !pending ||
      pending.step.kind === 'switch' ||
      !stepState.completed.has(pending.step.key)
    ) {
      return;
    }
    if (releaseSettlementLock(pending)) {
      advanceExpectedRef.current = true;
      finishSettlingUi(pending);
      pending.controller.abort();
    }
  }, [finishSettlingUi, releaseSettlementLock, stepState.completed]);

  // Each step advances only after on-chain confirmation. isSettling covers the
  // result dialog + recheck window and always resets in finally.
  const onStepSuccess = useCallback(
    async (submitted: IEModeStep, data: ISendTxOnSuccessData[]) => {
      if (!mountedRef.current) {
        return;
      }
      const txid = getLastSignedTxid(data);
      if (!txid) {
        // A successful signature callback normally always carries signedTx or
        // decodedTx identity. Without it there is no durable transaction to
        // poll, so retaining an anonymous lock would deadlock forever. Surface
        // this contract violation as a retryable failure; the route-level
        // serialized-history guard still blocks if a tx was actually recorded.
        if (mountedRef.current) {
          setFailedKey(submitted.key);
          disarm();
          await runCheck(targetEModeId);
        }
        return;
      }
      const controller = new AbortController();
      const pending: IEModePendingSettlement = {
        id: (settlementSeqRef.current += 1),
        step: submitted,
        txid,
        controller,
      };
      // All broadcasts, including the terminal switch, own an exact lock until
      // a final tx status or an authoritative blocker recheck resolves them.
      pendingSettlementRef.current = pending;
      submittedStepRef.current = submitted;
      setSubmittedKey(submitted.key);
      setSettlingStepKey(submitted.key);
      setIsSettling(true);
      settlingIdRef.current = pending.id;
      // Each confirmed step grants a fresh unlock-poll budget.
      unlockPollAttemptsRef.current = 0;
      settleAbortRef.current?.abort();
      settleAbortRef.current = controller;
      try {
        // Confirm inline (no dismissible sheet): wait for the broadcast tx's
        // final status at the flow level. isSettling stays true throughout, so
        // the auto-chain gate (isBusy) still blocks the next signature sheet
        // until this settles — and closing a modal can no longer fake a failure.
        const status = txid
          ? await waitForTxFinalStatus({
              accountId,
              networkId,
              txid,
              signal: controller.signal,
            })
          : undefined;
        if (controller.signal.aborted || !mountedRef.current) {
          return;
        }
        const outcome = applySettlementStatus({
          pending,
          status,
          abortPoll: false,
        });
        // outcome === 'confirming' (undefined status: poll exhausted / no txid):
        // broadcast but not yet final — NOT a failure. Keep the step locked as
        // "confirming" (submittedKey stays) and let the pending-tx tracker /
        // focus recheck advance it; runCheck now so a late-confirmed tx surfaces.
        // Swallows + toasts its own errors internally, won't throw.
        if (outcome === 'advanced' || outcome === 'confirming') {
          await runCheck(targetEModeId);
        }
      } finally {
        if (!controller.signal.aborted) {
          finishSettlingUi(pending);
        }
      }
    },
    [
      accountId,
      networkId,
      targetEModeId,
      runCheck,
      applySettlementStatus,
      finishSettlingUi,
      disarm,
    ],
  );

  const onStepFail = useCallback(
    (step: IEModeStep) => {
      if (!mountedRef.current) {
        return;
      }
      const pending = pendingSettlementRef.current;
      if (pending?.step === step && releaseSettlementLock(pending)) {
        finishSettlingUi(pending);
        pending.controller.abort();
      }
      setFailedKey(step.key);
      disarm();
    },
    [disarm, finishSettlingUi, releaseSettlementLock],
  );

  // Single-tx repay (no approvesInfo → never enters the batch branch that hung
  // on web). Keeps the native repay-all downgrade and owns its own try/catch
  // because the approve engine also calls it after an allowance delay.
  const fireRepay = useCallback(
    async (step: IEModeStep) => {
      if (
        !mountedRef.current ||
        step?.kind !== 'repay' ||
        step.reserveAddress === undefined
      ) {
        return;
      }
      const repayAll =
        shouldRepayAllForEModeStep(step) &&
        !shouldDowngradeAaveNativeRepayAll({
          action: 'repay',
          networkId,
          providerName: provider,
          reserveAddress: step.reserveAddress,
        });
      setRepaySubmitting(true);
      try {
        const callbacks = bindStepSettlementCallbacks<ISendTxOnSuccessData[]>({
          step,
          onSuccess: onStepSuccess,
          onFail: onStepFail,
        });
        await repay({
          amount: step.amountValue ?? '',
          provider,
          marketAddress,
          reserveAddress: step.reserveAddress,
          repayAll,
          stakingInfo: stakingInfo('repay'),
          ...callbacks,
          onCancel: disarm,
        });
      } catch {
        // tx build failed: the API interceptor already toasted.
        if (mountedRef.current) {
          setFailedKey(step.key);
        }
        disarm();
      } finally {
        // navigationToTxConfirm resolves as soon as the sheet is pushed.
        if (mountedRef.current) {
          setRepaySubmitting(false);
        }
      }
    },
    [
      repay,
      networkId,
      provider,
      marketAddress,
      stakingInfo,
      onStepSuccess,
      onStepFail,
      disarm,
    ],
  );

  const fireApprovedRepay = useCallback(async () => {
    const launched = approvalRepayStepRef.current;
    approvalRepayStepRef.current = null;
    if (!mountedRef.current) {
      return;
    }
    const authoritative = activeRef.current;
    const authoritativeCheck = checkRef.current;
    const blockerStillExists = blockerSteps(
      buildNeedActionItems(authoritativeCheck),
    ).some((step) => step.key === launched?.key);
    if (
      launched?.kind === 'repay' &&
      authoritative?.kind === 'repay' &&
      authoritative.key === launched.key &&
      blockerStillExists
    ) {
      await fireRepay(authoritative);
    }
  }, [fireRepay]);

  // Repay approval engine (single instance; the target follows the active repay
  // step and is undefined otherwise → engine inert). It brings its own polling,
  // USDT reset-to-zero, and error handling; it is not modified here.
  const repayAsset =
    activeStep?.kind === 'repay'
      ? (check?.repayAssets?.find(
          (a) => a.reserveAddress === activeStep.reserveAddress,
        ) ??
        check?.additionalRepayAssets?.find(
          (a) => a.reserveAddress === activeStep.reserveAddress,
        ))
      : undefined;
  const repayToken = buildBorrowTokenFromAsset({
    asset: repayAsset,
    networkId,
  });
  const approveTarget: IBorrowApproveTarget | undefined =
    repayToken && !repayToken.isNative
      ? {
          accountId,
          networkId,
          spenderAddress: marketAddress,
          token: repayToken,
        }
      : undefined;
  // A max approve ignores amount on-chain, but a missing/zero amount would trip
  // the engine's amount>0 short-circuit to 'idle' and stall the chain. '1' is
  // decision-only.
  const engineAmount =
    activeStep?.amountValue && new BigNumber(activeStep.amountValue).gt(0)
      ? activeStep.amountValue
      : '1';
  const approval = useBorrowApproval({
    action: 'repay',
    amountValue: engineAmount,
    repayAll: true, // ERC20 always max-approve; native has no approveTarget
    approveType: EApproveType.Legacy,
    approveTarget,
    stakingInfo: stakingInfo('repay'),
    onApprovedSubmit: fireApprovedRepay,
  });

  const isBusy =
    prechecking ||
    approval.approving ||
    repaySubmitting ||
    isSettling ||
    !!submittedKey;

  let approveSubStatus: IEModeApproveSubStatus = null;
  if (approval.approving) {
    approveSubStatus = 'approving';
  } else if (repaySubmitting) {
    approveSubStatus = 'repaying';
  } else if (prechecking) {
    approveSubStatus = 'preparing';
  }

  const runStep = useCallback(
    async (step: IEModeStep) => {
      if (!mountedRef.current || busyRef.current || submittedStepRef.current) {
        return;
      }
      if (step.kind !== 'switch' && step.reserveAddress === undefined) {
        return;
      }
      if (step.kind === 'switch' && !check?.canSwitch) {
        disarm();
        return;
      }
      busyRef.current = true;
      setPrechecking(true);
      try {
        if (step.kind === 'repay') {
          // The approval engine may submit much later. Bind it now to this
          // launched row rather than whichever row is active at callback time.
          approvalRepayStepRef.current = step;
          // ensureReadyToSubmit fetches fresh allowance: true → submit now;
          // false → the engine is driving its own approve / USDT-reset sheet,
          // or a precheck error already toasted (isBusy falls back to false and
          // the button is re-tappable — no failedKey). Mirrors ActionFooter.
          const ready = await approval.ensureReadyToSubmit();
          if (!ready) {
            return;
          }
          approvalRepayStepRef.current = null;
          await fireRepay(step);
        } else if (
          step.kind === 'removeCollateral' &&
          step.reserveAddress !== undefined
        ) {
          const callbacks = bindStepSettlementCallbacks<ISendTxOnSuccessData[]>(
            {
              step,
              onSuccess: onStepSuccess,
              onFail: onStepFail,
            },
          );
          await setCollateral({
            provider,
            marketAddress,
            reserveAddress: step.reserveAddress,
            useAsCollateral: false,
            eModeId: targetEModeId,
            stakingInfo: stakingInfo('setCollateral'),
            ...callbacks,
            onCancel: disarm,
          });
        } else if (step.kind === 'switch') {
          const callbacks = bindStepSettlementCallbacks<ISendTxOnSuccessData[]>(
            {
              step,
              onSuccess: onStepSuccess,
              onFail: onStepFail,
            },
          );
          await setEMode({
            provider,
            marketAddress,
            eModeId: targetEModeId,
            stakingInfo: stakingInfo('setEMode'),
            ...callbacks,
            onCancel: disarm,
          });
        }
      } catch {
        // interceptor auto-toasts backend errors; record the failure so the
        // footer offers Retry, and stop the chain.
        if (mountedRef.current) {
          setFailedKey(step.key);
        }
        disarm();
      } finally {
        busyRef.current = false;
        if (mountedRef.current) {
          setPrechecking(false);
        }
      }
    },
    [
      check,
      approval,
      fireRepay,
      setCollateral,
      setEMode,
      provider,
      marketAddress,
      targetEModeId,
      stakingInfo,
      onStepSuccess,
      onStepFail,
      disarm,
    ],
  );

  // Stable handle so the auto-advance effect never depends on runStep (which
  // churns every render because `approval` is a fresh object).
  const runStepRef = useRef(runStep);
  runStepRef.current = runStep;

  const run = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    const step = activeRef.current;
    if (!step || submittedStepRef.current) {
      return;
    }
    setFailedKey(null);
    autoAdvanceRef.current = true;
    launchedKeyRef.current = step.key;
    void runStepRef.current(step);
  }, []);

  // Pending/focus refreshes use the broadcast txid as the final authority.
  // A one-shot status read can resolve a poll-exhausted switch without ever
  // making the footer actionable in between; blocker checks still run after it
  // so amounts/canSwitch stay synchronized with the backend.
  const refresh = useCallback(async () => {
    const seq = (refreshSeqRef.current += 1);
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    const pending = pendingSettlementRef.current;
    const isCurrentAttempt = () =>
      mountedRef.current &&
      refreshSeqRef.current === seq &&
      !controller.signal.aborted;
    try {
      if (pending?.txid) {
        const status = await waitForTxFinalStatus({
          accountId,
          networkId,
          txid: pending.txid,
          maxAttempts: 1,
          intervalMs: 0,
          signal: controller.signal,
        });
        if (!isCurrentAttempt()) {
          return;
        }
        const outcome = applySettlementStatus({
          pending,
          status,
          abortPoll:
            status === EOnChainHistoryTxStatus.Success ||
            status === EOnChainHistoryTxStatus.Failed,
        });
        if (outcome === 'switched') {
          return;
        }
      }
      if (!isCurrentAttempt()) {
        return;
      }
      await runCheck(targetEModeId);
    } finally {
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = undefined;
      }
    }
  }, [accountId, networkId, targetEModeId, applySettlementStatus, runCheck]);

  // A bounded initial status poll may finish before the chain/indexer does.
  // Keep the exact submitted tx recoverable while this screen stays mounted;
  // route remounts are covered by the serialized stakingInfo pending tag.
  useEffect(() => {
    if (!submittedKey || isSettling || !pendingSettlementRef.current?.txid) {
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const pending = pendingSettlementRef.current;
      if (!pending) {
        return;
      }
      try {
        await refresh();
      } catch {
        // Best-effort; the next tick and route-level pending tracker retry.
      } finally {
        if (!disposed && pendingSettlementRef.current === pending) {
          timer = setTimeout(() => void poll(), UNLOCK_POLL_INTERVAL_MS);
        }
      }
    };
    timer = setTimeout(() => void poll(), UNLOCK_POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [submittedKey, isSettling, refresh]);

  // Re-drive the check while the switch step is blocked on a stale
  // canSwitch=false (or an errored check → null). Each stable waiting render
  // schedules ONE recheck; landing back in the waiting state schedules the
  // next, up to the budget. Leaves the screen (unmount) or any state flip
  // (isChecking/isBusy) cancels the pending timer.
  const waitingForUnlock =
    activeStep?.kind === 'switch' &&
    hasCheckedOnce &&
    !isChecking &&
    !isBusy &&
    !check?.canSwitch;
  useEffect(() => {
    if (!waitingForUnlock) {
      return;
    }
    if (unlockPollAttemptsRef.current >= UNLOCK_POLL_MAX_ATTEMPTS) {
      return;
    }
    const timer = setTimeout(() => {
      unlockPollAttemptsRef.current += 1;
      void runCheck(targetEModeId);
    }, UNLOCK_POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [waitingForUnlock, runCheck, targetEModeId]);

  // Auto-chaining: once a step settles (isBusy drops with the active step
  // advanced), fire the next one — until the switch closes the screen. Guard
  // order is load-bearing (see the ref block): only a flow-produced advance
  // (advanceExpectedRef) launches the next step; an out-of-band key change
  // disarms instead of self-popping a dialog.
  useEffect(() => {
    // 1. not armed / busy / mid-recheck / no live check.
    if (!autoAdvanceRef.current || isBusy || isChecking || !check) {
      return;
    }
    // 2. nothing to run (activeStep is never a completed step by construction).
    if (!activeStep || stepState.completed.has(activeStep.key)) {
      return;
    }
    // 3. switch not yet unblocked — stay armed WITHOUT consuming the token, so it
    //    fires when a late recheck flips canSwitch true.
    if (activeStep.kind === 'switch' && !check.canSwitch) {
      return;
    }
    // 3.5 the flow advanced onto a repay step the wallet cannot fund — a
    //     designed stop, not an error: disarm (the remedy — Get {symbol} —
    //     lives outside the chain), never auto-launch a step known to revert
    //     at estimate.
    if (activeStep.kind === 'repay' && activeShortfall) {
      disarm();
      return;
    }
    // The balance effect runs before this effect and flips the ref
    // synchronously, closing the one-render window before loading state lands.
    if (
      activeStep.kind === 'repay' &&
      (checkingActiveBalance || balanceRequestPendingRef.current)
    ) {
      return;
    }
    // 4. same key still in flight (repay-sheet push dip, USDT reset soft-stop,
    //    dust reopen) — stay armed, don't re-fire.
    if (launchedKeyRef.current === activeStep.key) {
      return;
    }
    // 5. key changed while armed but the flow didn't advance it → an out-of-band
    //    recheck moved it; kill the intent silently, never self-pop a dialog.
    if (!advanceExpectedRef.current) {
      disarm();
      return;
    }
    // 6. consume the token and launch.
    advanceExpectedRef.current = false;
    launchedKeyRef.current = activeStep.key;
    void runStepRef.current(activeStep);
  }, [
    activeStep,
    isBusy,
    isChecking,
    check,
    stepState,
    disarm,
    activeShortfall,
    checkingActiveBalance,
  ]);

  return {
    steps,
    stepIndex,
    activeStep,
    isBusy,
    settlingStepKey,
    approveSubStatus,
    shouldApprove: approval.shouldApprove,
    shortfallByKey,
    balanceByKey,
    activeShortfall,
    checkingActiveBalance,
    failedKey,
    submittedKey,
    run,
    disarm,
    check,
    isChecking,
    hasCheckedOnce,
    runCheck,
    refresh,
  };
}
