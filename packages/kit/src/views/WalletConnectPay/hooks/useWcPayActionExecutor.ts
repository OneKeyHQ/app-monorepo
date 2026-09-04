import { useCallback } from 'react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  extractWcPayPersonalSignMessage,
  extractWcPayTypedDataMessage,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/evmPayUtils';
// The Solana order check has no import here on purpose: its module
// (wcPaySolanaConsistency) decodes transactions with @solana/web3.js, which
// must not enter the UI runtime — it is reached through the background
// service (serviceWalletConnectPay.checkSolanaTxMatchesOrder) instead.
import {
  extractWcPaySolanaTransaction,
  wcPaySolanaTxToEncodedTx,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/solPayUtils';
import { isWcPayEmptyCalldata } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPayOrderConsistency';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WALLET_CONNECT_PAY_TRUSTED_HOST,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';
import { isWcPayExpired } from '@onekeyhq/shared/src/walletConnect/payExpiryUtils';
import {
  EWcPayActionMethod,
  type IWcPayAction,
  type IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

import { wcPayInlineSendTx } from './wcPayInlineSendTx';
import { wcPayInlineSignTypedData } from './wcPayInlineSignMessage';
import { wcPayInlineSignPersonalMessage } from './wcPayInlineSignPersonalMessage';
import { wcPayInlineSignSolanaTx } from './wcPayInlineSignSolana';
import {
  WC_PAY_MAX_ACTIONS_PER_SEQUENCE,
  WC_PAY_MAX_INLINE_APPROVES_PER_SEQUENCE,
  WC_PAY_MAX_INLINE_PERSONAL_SIGNS_PER_SEQUENCE,
  WC_PAY_MAX_INLINE_SPENDS_PER_SEQUENCE,
  WC_PAY_PERMIT_MAX_DEADLINE_S,
  WcPayUserCancelledError,
  classifyWcPayInlineFailure,
  getWcPayInlineMessagePlan,
  getWcPayInlinePersonalSignPlan,
  getWcPayInlineSolanaPlan,
  getWcPayInlineSolanaRequest,
  getWcPayInlineTxPlan,
  isWcPayUnlimitedApproveAmount,
  readWcPayPermitTokenAddress,
  runWcPayInlineAttempts,
} from './wcPayInlineUtils';

import type {
  IWcPayInlineController,
  IWcPayInlineSignResult,
  IWcPayInlineSigningSummary,
  IWcPayInlineSolanaPlan,
  IWcPayInlineSolanaSignResult,
  IWcPayResolvedToken,
} from './wcPayInlineUtils';

// re-exported from its leaf module for the existing import sites
export { WcPayUserCancelledError };

// The one fallback reason this file produces itself; kept in one place — and
// exported — so the refusal, the plans that carry it and the tests that pin
// it can never drift apart.
export const WC_PAY_INLINE_BUDGET_REASON = 'inline spend budget exhausted';

// The approve counterpart, kept beside its sibling for the same reason.
export const WC_PAY_INLINE_APPROVE_BUDGET_REASON =
  'inline approve budget exhausted';

// The personal_sign counterpart (WC_PAY_MAX_INLINE_PERSONAL_SIGNS_PER_SEQUENCE).
export const WC_PAY_INLINE_PERSONAL_SIGN_BUDGET_REASON =
  'inline personal-sign budget exhausted';

/**
 * How many inline-eligible spends a resumed run must consider already made.
 *
 * Fail-closed: an action completed in an EARLIER run may well have been
 * inlined, and nothing in the stored progress records how it was signed. So
 * every shape Phase 2 can inline counts — typed data and Solana
 * unconditionally (both are inline-eligible spends), a transfer when the very
 * gate that would have inlined it says so — and a resumed sequence cannot spend
 * the budget a second time.
 */
function countWcPayCompletedInlineSpends({
  completedActions,
  option,
}: {
  completedActions: IWcPayAction[];
  option: IWcPayOption | undefined;
}): number {
  return completedActions.filter((action) => {
    const method = action?.walletRpc?.method;
    if (
      method === EWcPayActionMethod.EthSignTypedDataV4 ||
      method === EWcPayActionMethod.SolanaSignTransaction
    ) {
      return true;
    }
    // Only the transfer kind is a spend: a completed approve enabled a later
    // permit but moved nothing, and personal_sign is not listed above for
    // the same reason — neither may consume the SPEND budget of a resumed
    // run; each is seeded into a budget of its own below.
    const plan = getWcPayInlineTxPlan({ action, option });
    return plan.mode === 'inline' && plan.kind === 'transfer';
  }).length;
}

/**
 * Fail-closed seeding for the approve budget, the same rule the spend
 * counter applies: a completed approve-shaped action may well have been
 * inlined, so a resumed sequence must not inline a second one.
 */
function countWcPayCompletedInlineApproves({
  completedActions,
  option,
}: {
  completedActions: IWcPayAction[];
  option: IWcPayOption | undefined;
}): number {
  return completedActions.filter((action) => {
    const plan = getWcPayInlineTxPlan({ action, option });
    return plan.mode === 'inline' && plan.kind === 'approve';
  }).length;
}

/**
 * Fail-closed seeding for the personal_sign budget. Nothing in the stored
 * progress records how a completed message was signed, and the display gate
 * cannot be re-run here (its verdict needs the signing address, which is
 * resolved per action inside the loop), so every completed personal_sign
 * counts: over-counting only costs a confirm page, under-counting would
 * hand a resumed sequence a second headless signature.
 */
function countWcPayCompletedInlinePersonalSigns(
  completedActions: IWcPayAction[],
): number {
  return completedActions.filter(
    (action) => action?.walletRpc?.method === EWcPayActionMethod.PersonalSign,
  ).length;
}

// small pause so a finished confirm modal fully dismisses before the next one
const MODAL_TRANSITION_MS = 300;

// Sign requests come from the WalletConnect Pay server / merchant, not from
// the wallet itself, so present them through the regular external-sign
// confirmation path (site mark + risk detection) instead of
// walletInternalSign. The empty id keeps useDappApproveAction a no-op — the
// flow settles via onSuccess/onFail/onCancel callbacks.
function buildWcPaySourceInfo({
  method,
  params,
  scope,
}: {
  method: string;
  params: unknown;
  scope: IDappSourceInfo['scope'];
}): IDappSourceInfo {
  return {
    id: '',
    origin: `https://${WALLET_CONNECT_PAY_TRUSTED_HOST}`,
    hostname: WALLET_CONNECT_PAY_TRUSTED_HOST,
    scope,
    data: { method, params },
    isWalletConnectRequest: false,
  };
}

/**
 * The order carries no token contract (see payTypes.ts), so a payload's
 * self-declared token is never taken at face value: identity is proven
 * through the wallet's own token registry for the chain (spec §4.6), and both
 * inline signing gates refuse when this returns undefined.
 *
 * Never fatal — an unresolvable token only costs the action its inline path,
 * and the confirm page still owns the decision.
 */
async function resolveWcPayToken({
  networkId,
  accountId,
  address,
}: {
  networkId: string;
  accountId: string;
  address: string;
}): Promise<IWcPayResolvedToken | undefined> {
  try {
    const [detail] = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      networkId,
      accountId,
      contractList: [address],
    });
    const info = detail?.info;
    if (
      !info?.address ||
      typeof info.symbol !== 'string' ||
      typeof info.decimals !== 'number'
    ) {
      return undefined;
    }
    return {
      address: info.address,
      symbol: info.symbol,
      decimals: info.decimals,
    };
  } catch (error) {
    console.error('wcPay token resolve failed', error);
    return undefined;
  }
}

export function useWcPayActionExecutor() {
  const navigation = useAppNavigation();

  const executeActions = useCallback(
    async ({
      actions,
      accountId,
      indexedAccountId,
      completedResults,
      expiryMs,
      progressContext,
      option,
      inlineController,
      cancelSignal,
      onActionComplete,
      onActionInvalidated,
    }: {
      actions: IWcPayAction[];
      accountId?: string;
      indexedAccountId?: string;
      // identity of the durable progress record for this payment attempt.
      // When present, every eth_sendTransaction confirm threads it to the
      // send pipeline as wcPayPreBroadcastRecord, so the BACKGROUND persists
      // the txid between signing and broadcast — closing the window where
      // this UI runtime dies after the broadcast but before the confirm
      // round-trip returns and onActionComplete below can run
      progressContext?: {
        paymentId: string;
        optionId: string;
        accountKey: string;
      };
      // absolute payment deadline (ms epoch, the earliest of payment-level
      // and option-level expiry). Checked at the top of every action, and
      // for eth_sendTransaction additionally enforced at the confirm click
      // (onBeforeSend) and again between signing and broadcast
      // (broadcastDeadline, background-enforced), so an on-chain transfer
      // can never start once the deadline has passed.
      expiryMs?: number;
      // the payment option the user selected. Required by the inline path
      // both as the order to re-prove the transaction against and as the
      // source of the expected paying account.
      option?: IWcPayOption;
      // observer/decider for the inline path. Supplying it together with
      // `option` opts this call into the headless send; the gate that decides
      // whether a given action is actually eligible (getWcPayInlineTxPlan)
      // still runs per action. When it is absent, as for every caller today,
      // the executor behaves exactly as before.
      inlineController?: IWcPayInlineController;
      // pre-sign cancellation boundary, fired when the page that started the
      // flow unmounts. Checked before the resume probes, at the top of every
      // action, right before each confirm modal is pushed, and (on the
      // inline path) immediately before signing — never after signing, where
      // cancelling could lose an in-flight broadcast. Before any broadcast,
      // an aborted signal ends the flow with WcPayUserCancelledError, which
      // callers treat as a silent end. Once an action of THIS run has
      // broadcast a transaction the signal stops aborting: an aborted-late
      // sequence instead RETURNS the result prefix at the next UI boundary
      // — the caller detects the partial set by length, skips
      // confirmPayment, and relies on the durable record for resume — and
      // no context-free confirm modal is pushed from a page that is gone.
      // Cancelling may stop work that has not started, never abandon a
      // payment already sent.
      cancelSignal?: AbortSignal;
      // results of actions already executed in a previous partially-failed
      // attempt of the same payment option; execution resumes after them so
      // an already-broadcast transaction is never sent twice. Callers must
      // guarantee these results still correspond one-to-one to the leading
      // entries of `actions` (see the fingerprint validation in
      // ServiceWalletConnectPay.getStoredActionResults) — the executor
      // aligns purely by index.
      completedResults?: string[];
      // reports each action result as soon as it exists and is AWAITED
      // before the sequence continues, so the caller can durably persist
      // progress even when a later action rejects or the app dies mid-flow.
      // Best-effort: a rejection here is logged and swallowed — the result
      // stays in memory for confirmPayment and must never abort the flow
      onActionComplete?: (params: {
        index: number;
        result: string;
      }) => void | Promise<void>;
      // called when a previously recorded result turns out permanently
      // unusable (the recorded transaction reverted on chain); the caller
      // must discard stored progress from `index` on so the next attempt
      // re-executes the action instead of resuming a dead txid
      onActionInvalidated?: (params: { index: number }) => void | Promise<void>;
    }): Promise<string[]> => {
      if (actions.length > WC_PAY_MAX_ACTIONS_PER_SEQUENCE) {
        // A legitimate payment never approaches this; a hostile sequence
        // must fail outright rather than get one confirm page per action
        // as a "fallback" griefing surface (Phase 3 §7).
        throw new WcPayError({
          code: EWcPayErrorCode.TooManyActions,
          message: 'Too many payment actions',
        });
      }
      const startIndex = Math.min(
        completedResults?.length ?? 0,
        actions.length,
      );
      const results: string[] = (completedResults ?? []).slice(
        0,
        actions.length,
      );

      // Expiry model. The loop-top check gates each action before it starts,
      // but cannot cover the unbounded time the user sits on a signing
      // confirmation (hardware signing included). For the only irreversible
      // action — eth_sendTransaction — two guards close that window instead:
      // onBeforeSend fails fast at the confirm click, and broadcastDeadline
      // is enforced by the background between signing and broadcast, so even
      // a signing session that crosses the deadline can never broadcast.
      //
      // The confirm modal is deliberately NOT force-closed when the deadline
      // passes. Closing would unmount TxConfirm, whose unmount handler
      // treats any not-yet-submitted state as a cancellation
      // (`isSubmitted` only becomes true after the broadcast call returns)
      // and nulls the pending submit id — the in-flight submission's success
      // continuation then skips the onSuccess callback entirely, so an
      // already-broadcast txid would be unrecoverable and a retry would pay
      // twice. Leaving the modal open is safe: a post-deadline confirm is
      // blocked before broadcast by the guards above, and sign-only
      // confirmations merely produce a re-executable signature that the
      // loop-top check (or the server) rejects as expired.
      //
      // A broadcast that STARTED before the deadline completes normally; its
      // txid settles the confirmation, is durably persisted below, and the
      // next loop-top check ends the sequence.

      // Marks an error thrown by onBeforeSend before anything is signed or
      // broadcast; the catch below may therefore safely close the confirm
      // modal. A tagged property (not an error subclass) — the file's error
      // classes are capped at one by lint, and OneKeyError types `name`.
      const deadlineBeforeSendFlag = '$$wcPayDeadlineBeforeSend';

      // Persist one produced result, awaited so the durable record normally
      // lands before the sequence continues — but always best-effort: the
      // write failing loses nothing that aborting would save. For
      // eth_sendTransaction the txid is already on-chain and must still
      // reach confirmPayment in-session, and a sign-only result is
      // re-executable — aborting would discard a signature that
      // confirmPayment can still use, only to make the user sign again.
      const persistActionResult = async (index: number, result: string) => {
        try {
          await onActionComplete?.({ index, result });
        } catch (persistError) {
          console.error('wcPay persist action result failed', persistError);
        }
      };

      /**
       * The tail both signing branches share once their own plan said inline:
       * announce what is being signed, run the pipeline, and dispose of its
       * three outcomes identically — including the bookkeeping the modal path
       * performs (`results.push` + an AWAITED persist) so an inline signature
       * is recorded exactly like a confirmed one.
       *
       * The budget deliberately stays at the call sites: the two plans have
       * different shapes, and so does everything that produces them.
       */
      const runInlineSignature = async ({
        index,
        controller,
        summary,
        run,
      }: {
        index: number;
        // passed in rather than closed over: the branches narrow
        // `inlineController` themselves, and that narrowing cannot travel
        // into a closure declared out here
        controller: IWcPayInlineController;
        summary: IWcPayInlineSigningSummary;
        run: () => Promise<
          IWcPayInlineSignResult | IWcPayInlineSolanaSignResult
        >;
      }): Promise<'done' | 'fallback'> => {
        controller.onSigningSummary?.(summary);
        const inline = await run();
        if (inline.status === 'ok') {
          // the two pipelines name their payload differently — a detached
          // signature vs a whole signed transaction — but the Pay server is
          // handed either one the same way
          const result =
            'signature' in inline ? inline.signature : inline.rawTx;
          results.push(result);
          // Same vocabulary as the send leg (wcPayInlineSendTx): the
          // signature exists, what is left is bookkeeping. Announced before
          // the persist so the sheet stops describing a signature already
          // given — otherwise the summary would sit on screen through a later
          // action's confirm page or Permit2's minutes-long mined-wait.
          controller.onPhase('recording');
          await persistActionResult(index, result);
          return 'done';
        }
        if (inline.status === 'abort') {
          // Phase 1 rule: the backup dialog is an RN-layer dialog, so the flow
          // must be told to close the sheet before it can be seen. The
          // controller's verdict is deliberately ignored — this call exists
          // only to trigger that close; the payment ends either way.
          await controller.onInlineFailure(
            classifyWcPayInlineFailure({
              stage: 'backup',
              error: new OneKeyLocalError('Wallet is not backed up'),
            }),
          );
          throw new WcPayUserCancelledError('User canceled payment');
        }
        // The page must learn inline execution ended before the confirm page
        // takes over — the same contract runWcPayInlineAttempts'
        // resolveFallback honours. The reason is logged here because, unlike
        // the send leg's classified failure, nothing else carries it.
        console.error(
          'wcPay inline signature fallback',
          summary.kind,
          inline.reason,
        );
        controller.onFallback?.();
        return 'fallback';
      };

      // cancellation is a pre-sign concept only: checked before the resume
      // probes, at the top of every action, right before each confirm modal
      // is pushed, and immediately before inline signing. Never consulted
      // after signing — an in-flight broadcast must settle and be recorded
      // no matter what the page did. And once THIS run has broadcast a
      // transaction the signal is retired for the rest of the sequence:
      // cancelling mid-sequence would strand a tx that is already on chain
      // — confirmPayment would never run and the merchant payment could
      // never confirm. Cancellation may end work that has not started; it
      // must never abandon a produced result.
      let hasBroadcastInThisRun = false;
      const throwIfCancelled = () => {
        if (hasBroadcastInThisRun) {
          return;
        }
        if (cancelSignal?.aborted) {
          throw new WcPayUserCancelledError('User canceled payment');
        }
      };
      // Post-retirement close handling. Retiring the signal keeps the
      // sequence alive, but a MULTI-action sequence can only advance by
      // pushing another confirm modal — and the signal fires exactly when
      // the page is gone, so that modal would appear with no payment
      // context and its most likely dismissal would strand the broadcast
      // all the same. When the signal fired after retirement, stop BEFORE
      // the next UI step and return the results collected so far. Every
      // such exit returns a PROPER PREFIX (results.length <
      // actions.length), which is the caller's contract for detecting it:
      // a partial set must NOT be submitted to confirmPayment (the
      // short-array contract is unverified, and an isFinal verdict there
      // clears the progress record — the broadcast evidence). Every
      // produced result is already durably persisted, so the payment
      // resumes on the next entry or expires server-side.
      const isStoppedAfterBroadcast = () =>
        hasBroadcastInThisRun && Boolean(cancelSignal?.aborted);
      throwIfCancelled();

      // resuming with recorded progress: re-verify the last recorded action
      // when it broadcast a tx — including a fully completed sequence
      // (startIndex === actions.length), or a phantom txid would be handed
      // to confirmPayment unchecked
      let effectiveStartIndex = startIndex;
      // nonce to pin when re-executing an invalidated broadcast action: the
      // never-broadcast verdict is fallible (the tx may merely be invisible
      // to the probe pool), so the re-executed tx must reuse the recorded
      // nonce — a misjudgment then yields a nonce conflict where only one
      // tx lands, never a second payment at nonce+1
      const pinnedNonces: Record<number, number> = {};
      if (startIndex > 0) {
        const prevIndex = startIndex - 1;
        const prevRpc = actions[prevIndex].walletRpc;
        const prevTxid = results[prevIndex];
        if (
          prevRpc.method === EWcPayActionMethod.EthSendTransaction &&
          prevTxid
        ) {
          const prevNetworkId = wcPayChainIdToNetworkId(prevRpc.chainId);
          if (prevNetworkId) {
            // the pre-broadcast record is written before the broadcast
            // attempt, so a definitive broadcast rejection leaves a phantom
            // txid behind; re-execute that action instead of resuming it —
            // otherwise one failed broadcast deadlocks the payment until
            // expiry (the slot is only cleared on a final server state).
            // The check errs toward keeping the txid: only consistent
            // "transaction does not exist" probes plus a still-unconsumed
            // sender nonce count as never-broadcast
            const isNeverBroadcast =
              await backgroundApiProxy.serviceWalletConnectPay.isTxNeverBroadcast(
                {
                  networkId: prevNetworkId,
                  txid: prevTxid,
                },
              );
            if (isNeverBroadcast) {
              // read the recorded nonce BEFORE invalidation — truncating
              // stored progress deletes the entry that holds it
              const broadcastMeta =
                await backgroundApiProxy.serviceWalletConnectPay.getBroadcastMetaByTxid(
                  { txid: prevTxid },
                );
              await onActionInvalidated?.({ index: prevIndex });
              results.length = prevIndex;
              effectiveStartIndex = prevIndex;
              if (broadcastMeta) {
                pinnedNonces[prevIndex] = broadcastMeta.nonce;
              }
            } else if (prevIndex < actions.length - 1) {
              // mid-sequence resume: the broadcast tx must be mined before
              // the follow-up signing so the Permit2 "approve mined before
              // typed-data" ordering holds even when the original
              // waitForTxMined was the step that failed. A fully completed
              // sequence needs no mined-wait — confirmPayment and the
              // server-side settling own the final state
              const { isReverted } =
                await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined(
                  {
                    networkId: prevNetworkId,
                    txid: prevTxid,
                  },
                );
              if (isReverted) {
                // the recorded txid can never confirm; drop it from stored
                // progress so the next attempt re-executes this action
                // instead of waiting on a dead transaction until the TTL
                // expires
                await onActionInvalidated?.({ index: prevIndex });
                throw new WcPayError({
                  code: EWcPayErrorCode.TxReverted,
                  message: 'Transaction reverted on chain',
                });
              }
            }
          }
        }
      }

      // Sequence spend budget (§3.1 invariant 1, see
      // WC_PAY_MAX_INLINE_SPENDS_PER_SEQUENCE). Seeded from the prefix this
      // run will SKIP, so a resumed sequence cannot inline a second spend.
      let inlinedSpends = countWcPayCompletedInlineSpends({
        completedActions: actions.slice(0, effectiveStartIndex),
        option,
      });
      // Consumed before an inline path is ENTERED — an attempt may broadcast,
      // so the budget must be spent at the attempt, not at its success. The
      // refusal warns from in here rather than at the call sites, so no
      // future inline branch can take the budget and forget to report it.
      const takeInlineSpend = () => {
        if (inlinedSpends >= WC_PAY_MAX_INLINE_SPENDS_PER_SEQUENCE) {
          // Reported at error level, not warn: the sequence asked to inline
          // more spends than a legitimate payment ever contains, which is a
          // louder condition than any single pipeline falling back.
          console.error('wcPay inline fallback', WC_PAY_INLINE_BUDGET_REASON);
          return false;
        }
        inlinedSpends += 1;
        return true;
      };
      // The approve budget, same consumption rule: taken at the attempt.
      // Outside the spend budget (an approve moves nothing) but bounded on
      // its own, or a hostile sequence could burn gas on one headless
      // approve per remaining action slot.
      let inlinedApproves = countWcPayCompletedInlineApproves({
        completedActions: actions.slice(0, effectiveStartIndex),
        option,
      });
      const takeInlineApprove = () => {
        if (inlinedApproves >= WC_PAY_MAX_INLINE_APPROVES_PER_SEQUENCE) {
          console.error(
            'wcPay inline fallback',
            WC_PAY_INLINE_APPROVE_BUDGET_REASON,
          );
          return false;
        }
        inlinedApproves += 1;
        return true;
      };
      // The personal_sign budget, same consumption rule: taken at the
      // attempt. Outside the spend budget (a signature moves nothing) but
      // bounded on its own, or a hostile sequence could sign out one
      // arbitrary message per remaining action slot with no click anywhere
      // in the pipeline.
      let inlinedPersonalSigns = countWcPayCompletedInlinePersonalSigns(
        actions.slice(0, effectiveStartIndex),
      );
      const takeInlinePersonalSign = () => {
        if (
          inlinedPersonalSigns >= WC_PAY_MAX_INLINE_PERSONAL_SIGNS_PER_SEQUENCE
        ) {
          console.error(
            'wcPay inline fallback',
            WC_PAY_INLINE_PERSONAL_SIGN_BUDGET_REASON,
          );
          return false;
        }
        inlinedPersonalSigns += 1;
        return true;
      };

      for (let i = effectiveStartIndex; i < actions.length; i += 1) {
        // the page owning this flow may have unmounted during the resume
        // probes above (waitForTxMined can block for minutes) or between
        // actions; nothing has been signed for action i yet AND no earlier
        // action of this run has broadcast (throwIfCancelled retires once
        // one has), so ending here abandons no pending confirmPayment
        // obligation. A RESUMED run whose broadcasts all happened in a
        // PREVIOUS run may still cancel here: those txids are durably
        // recorded and re-enterable, unlike this run's un-submitted results.
        throwIfCancelled();
        if (isStoppedAfterBroadcast()) {
          return results;
        }
        // a summary reported for an earlier action must never describe this
        // one; each leg that wants a summary re-reports its own
        inlineController?.onSigningSummary?.(undefined);
        // terminate the whole sequence the moment the deadline passes;
        // progress persisted via onActionComplete keeps already-broadcast
        // transactions safe for the (server-driven) expired/failed settling
        if (isWcPayExpired(expiryMs)) {
          throw new WcPayError({
            code: EWcPayErrorCode.PaymentExpired,
            message: 'This payment has expired',
          });
        }
        const { chainId, method, params } = actions[i].walletRpc;
        const networkId = wcPayChainIdToNetworkId(chainId);
        if (!networkId) {
          throw new WcPayError({
            code: EWcPayErrorCode.UnsupportedChain,
            message: `Unsupported WalletConnect Pay chain: ${chainId}`,
          });
        }
        // honour the user's global derive type so the signing account matches
        // the address offered in buildPayAccounts
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : accountId,
            indexedAccountId,
            networkId,
            deriveType,
          });
        const parsed = JSON.parse(params) as unknown;

        if (i > 0) {
          await timerUtils.wait(MODAL_TRANSITION_MS);
        }

        switch (method) {
          case EWcPayActionMethod.EthSendTransaction: {
            const encodedTx = (
              Array.isArray(parsed) ? parsed[0] : parsed
            ) as IEncodedTx;
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  networkId,
                  accountId: account.id,
                  encodedTx,
                  // pin the re-execution of an invalidated broadcast action
                  // to its recorded nonce (see pinnedNonces above)
                  nonceInfo:
                    pinnedNonces[i] !== undefined
                      ? { nonce: pinnedNonces[i] }
                      : undefined,
                },
              );
            // Re-check after the async prep above, BEFORE the inline path:
            // an inline broadcast is a UI boundary of its own (it raises the
            // password/hardware prompt and owns the recovery decision), so a
            // sequence that already broadcast and then lost its page must
            // stop with the collected prefix rather than send again from a
            // page that is gone. Same ordering as the two signing branches
            // below.
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // Inline path: run the headless pipeline instead of pushing the
            // confirm modal. It receives the very unsignedTx the modal would
            // have shown — pinned nonce included — so an invalidated
            // re-execution keeps its nonce here too. Nothing is caught: a
            // thrown pipeline error (post-sign tagged or pre-sign untagged)
            // must reach the page, which owns the recovery decision.
            // Assigned by whichever path produces the broadcast — inline or
            // confirm page — so both join the one post-broadcast tail below.
            let txid: string | undefined;
            if (inlineController && option) {
              // the gate is evaluated per action, so it judges the very
              // action this iteration executes
              let plan = getWcPayInlineTxPlan({ action: actions[i], option });
              // only the transfer kind spends the order amount; an approve
              // enables the later permit and is never charged (Phase 3 §7)
              if (
                plan.mode === 'inline' &&
                plan.kind === 'transfer' &&
                !takeInlineSpend()
              ) {
                plan = {
                  mode: 'fallback',
                  reason: WC_PAY_INLINE_BUDGET_REASON,
                };
              }
              if (
                plan.mode === 'inline' &&
                plan.kind === 'approve' &&
                !takeInlineApprove()
              ) {
                plan = {
                  mode: 'fallback',
                  reason: WC_PAY_INLINE_APPROVE_BUDGET_REASON,
                };
              }
              if (plan.mode === 'inline' && plan.kind === 'transfer') {
                // What the sheet shows for this leg is the option's display
                // line, so the asset that display names must be the asset the
                // tx actually moves. The pure validator cannot see this (the
                // option carries no token contract): prove it here through
                // the wallet registry for the ERC20 shape — the same rule the
                // approve/permit/Solana legs apply — and through the wallet's
                // own network config for the native shape. Either mismatch
                // only demotes to the confirm page, never refuses the payment.
                const transferTokenAddress = isWcPayEmptyCalldata(
                  (encodedTx as { data?: string }).data,
                )
                  ? undefined
                  : (encodedTx as { to?: string }).to;
                if (transferTokenAddress) {
                  const resolvedToken = await resolveWcPayToken({
                    networkId,
                    accountId: account.id,
                    address: transferTokenAddress,
                  });
                  if (
                    !resolvedToken ||
                    // the registry must be answering about the very contract
                    // that was asked (parity with the approve leg below)
                    resolvedToken.address.toLowerCase() !==
                      transferTokenAddress.toLowerCase() ||
                    resolvedToken.symbol !==
                      option.amount?.display?.assetSymbol ||
                    resolvedToken.decimals !== option.amount?.display?.decimals
                  ) {
                    plan = {
                      mode: 'fallback',
                      reason: 'transfer token mismatch',
                    };
                  }
                } else {
                  // Native transfer: no contract to resolve; the network's
                  // own native asset is the ground truth the display must
                  // match. A symbol rename shipped server-side first lands on
                  // the confirm page rather than blocking the payment.
                  const network =
                    await backgroundApiProxy.serviceNetwork.getNetwork({
                      networkId,
                    });
                  if (
                    network.decimals !== option.amount?.display?.decimals ||
                    network.symbol !== option.amount?.display?.assetSymbol
                  ) {
                    plan = {
                      mode: 'fallback',
                      reason: 'native asset mismatch',
                    };
                  }
                }
              }
              if (plan.mode === 'inline' && plan.kind === 'approve') {
                // The calldata `to` is the token contract; prove its identity
                // through the wallet registry — the same rule the permit leg
                // applies to its token (§4.6). An approve for a token that is
                // not the order's asset is exactly the shape a compromised
                // server would send, and the pure validator cannot see it.
                const approveTokenAddress = (encodedTx as { to?: string }).to;
                const resolvedToken = approveTokenAddress
                  ? await resolveWcPayToken({
                      networkId,
                      accountId: account.id,
                      address: approveTokenAddress,
                    })
                  : undefined;
                if (
                  !resolvedToken ||
                  // the registry must be answering about the very contract
                  // that was asked (parity with the permit/Solana legs'
                  // address checks), not a normalized substitute
                  resolvedToken.address.toLowerCase() !==
                    approveTokenAddress?.toLowerCase() ||
                  resolvedToken.symbol !==
                    option.amount?.display?.assetSymbol ||
                  resolvedToken.decimals !== option.amount?.display?.decimals
                ) {
                  plan = { mode: 'fallback', reason: 'approve token mismatch' };
                } else {
                  // reported before the pipeline so the sheet describes the
                  // allowance through the send-leg phases (§8)
                  inlineController.onSigningSummary?.({
                    kind: 'approve',
                    summary: {
                      symbol: resolvedToken.symbol,
                      unlimited: isWcPayUnlimitedApproveAmount(
                        (encodedTx as { data?: string }).data,
                      ),
                    },
                  });
                }
              }
              if (plan.mode === 'fallback') {
                // the plan reasons otherwise vanish silently into the confirm
                // push below; the signature legs log their fallbacks, and an
                // approve demoted here must be as visible on a device
                console.error('wcPay inline tx fallback', plan.reason);
              }
              if (plan.mode === 'inline') {
                const planKind = plan.kind;
                const inlineOutcome = await runWcPayInlineAttempts({
                  controller: inlineController,
                  run: () =>
                    wcPayInlineSendTx({
                      networkId,
                      accountId: account.id,
                      unsignedTx,
                      option,
                      // the pipeline's final recheck asserts the signed tx
                      // still has the calldata shape this plan approved
                      intent: planKind,
                      sourceInfo: buildWcPaySourceInfo({
                        method,
                        params: parsed,
                        scope: 'ethereum',
                      }),
                      expiryMs,
                      // identical construction to the modal path below: the
                      // durable-progress identity must not differ by route
                      wcPayPreBroadcastRecord: progressContext
                        ? {
                            ...progressContext,
                            action: actions[i],
                            index: i,
                          }
                        : undefined,
                      // the executor's own checker rather than the raw
                      // signal, so the retirement rule travels with it (a
                      // bare-signal check would re-arm cancellation for a
                      // Phase 2 multi-action inline run)
                      throwIfCancelled,
                      onPhase: inlineController.onPhase,
                    }),
                });
                if (inlineOutcome.status === 'ok') {
                  txid = inlineOutcome.txid;
                } else if (inlineOutcome.status === 'abort') {
                  throw new WcPayUserCancelledError('User canceled payment');
                }
                // fallback: continue into the standard confirm modal below
              }
            }
            if (txid === undefined) {
              // the async prep above (account resolution, tx preparation, a
              // possible inline fallback) may span a page close; re-check so
              // a confirm modal is never pushed onto a stack whose owner is
              // gone — cancelling before a broadcast exists, stopping with
              // the collected prefix after one does
              throwIfCancelled();
              if (isStoppedAfterBroadcast()) {
                return results;
              }
              // park the host dialog before the confirm page takes the screen
              // (see IWcPayInlineController.onBeforePushConfirmModal)
              await inlineController?.onBeforePushConfirmModal?.();
              try {
                txid = await new Promise<string>((resolve, reject) => {
                  navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                    screen: EModalSignatureConfirmRoutes.TxConfirm,
                    params: {
                      networkId,
                      accountId: account.id,
                      unsignedTxs: [unsignedTx],
                      // the gas params provided by WalletConnect Pay are hints;
                      // let the wallet estimate fees like a normal send
                      useFeeInTx: false,
                      // fail fast when the user confirms after the deadline:
                      // runs before signing, so nothing irreversible has
                      // happened when it throws
                      onBeforeSend: () => {
                        if (isWcPayExpired(expiryMs)) {
                          const expiredError = new WcPayError({
                            code: EWcPayErrorCode.PaymentExpired,
                            message: 'This payment has expired',
                          });
                          (expiredError as unknown as Record<string, boolean>)[
                            deadlineBeforeSendFlag
                          ] = true;
                          throw expiredError;
                        }
                      },
                      // hard boundary enforced by the background between
                      // signing and broadcast; covers signing sessions
                      // (e.g. hardware) that cross the deadline after
                      // onBeforeSend already passed
                      broadcastDeadline: expiryMs,
                      // duplicate-payment boundary: the background records the
                      // txid after signing and before broadcast, so even if
                      // this UI runtime dies before onSuccess (or anything
                      // after it) runs, a resumed attempt knows the transfer
                      // was already sent
                      wcPayPreBroadcastRecord: progressContext
                        ? {
                            ...progressContext,
                            action: actions[i],
                            index: i,
                          }
                        : undefined,
                      sourceInfo: buildWcPaySourceInfo({
                        method,
                        params: parsed,
                        scope: 'ethereum',
                      }),
                      onSuccess: (txs: ISendTxOnSuccessData[]) => {
                        const id = txs?.[0]?.signedTx?.txid;
                        if (id) {
                          resolve(id);
                        } else {
                          reject(
                            new WcPayError({
                              code: EWcPayErrorCode.MissingTxid,
                              message: 'Missing transaction id',
                            }),
                          );
                        }
                      },
                      onFail: (error: Error) => reject(error),
                      onCancel: () =>
                        reject(
                          new WcPayUserCancelledError('User canceled payment'),
                        ),
                    },
                  });
                });
              } catch (error) {
                // the deadline tripped at the confirm click: no submission is
                // in flight, so closing the (still open) confirm modal cannot
                // lose a broadcast result — the only situation where closing
                // it from the outside is safe
                if (
                  (error as undefined | Record<string, unknown>)?.[
                    deadlineBeforeSendFlag
                  ]
                ) {
                  navigation.popStack();
                }
                throw error;
              } finally {
                // the confirm modal settled either way: let the host dialog
                // come back so the paying progress stays visible through the
                // between-action waits (the mined-wait below can run for
                // minutes with no other UI on screen)
                inlineController?.onAfterConfirmModalSettled?.();
              }
            }
            // ONE post-broadcast tail for both routes (§3.1 invariant 2): an
            // inlined broadcast is as on-chain as a confirmed one, so it owes
            // the same bookkeeping and the same mined-wait before the next
            // action — the inline path must never skip past this. An on-chain
            // result now exists, so retire the cancel signal: the remaining
            // actions (and confirmPayment) always run.
            hasBroadcastInThisRun = true;
            results.push(txid);
            // the txid was already durably recorded by the background between
            // signing and broadcast (wcPayPreBroadcastRecord, passed by both
            // routes); this second write merely reaffirms it once the route
            // that produced it returned, and must still never lose it to a
            // later-step failure (including the mined-wait below)
            await persistActionResult(i, txid);
            // Permit2 flow: the approve must be mined before signing the
            // follow-up typed data
            if (i < actions.length - 1) {
              // the mined-wait serves only the follow-up signing; when the
              // page is gone that signing will not be requested — return
              // the prefix now instead of blocking on it for minutes
              if (isStoppedAfterBroadcast()) {
                return results;
              }
              const { isReverted } =
                await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined(
                  {
                    networkId,
                    txid,
                  },
                );
              if (isReverted) {
                // a reverted tx is a terminal failure of this action: the
                // recorded txid must not be resumed on retry. Timeout/RPC
                // uncertainty (thrown above) keeps the txid so a retry never
                // re-broadcasts a possibly-mined payment.
                await onActionInvalidated?.({ index: i });
                throw new WcPayError({
                  code: EWcPayErrorCode.TxReverted,
                  message: 'Transaction reverted on chain',
                });
              }
            }
            break;
          }
          case EWcPayActionMethod.EthSignTypedDataV4: {
            const message = extractWcPayTypedDataMessage(parsed);
            // re-check after the async prep above (see eth_sendTransaction).
            // A headless signature is a UI boundary of its own — it raises the
            // password/hardware prompt — so it sits behind the same guards the
            // confirm modal does, never in front of them.
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // Inline path: sign the Permit2 payload without a confirm page
            // when it proves to be exactly the order the user approved.
            // Nothing is caught — a thrown pipeline error must reach the page,
            // which owns the recovery decision. A signature is not a
            // broadcast, so this branch performs the same bookkeeping as the
            // modal path below and, like it, never sets hasBroadcastInThisRun.
            if (inlineController && option) {
              const permitToken = readWcPayPermitTokenAddress(message);
              const resolvedToken = permitToken
                ? await resolveWcPayToken({
                    networkId,
                    accountId: account.id,
                    address: permitToken,
                  })
                : undefined;
              const nowMs = Date.now();
              let plan = getWcPayInlineMessagePlan({
                action: actions[i],
                option,
                nowMs,
                resolvedToken,
                // The fixed validator ceiling is the whole bound (Phase 3
                // §6), on THIS headless leg included — an explicit product
                // decision (2026-09-03), not an oversight. Tying it to the
                // order lifetime bought nothing except a systematic fallback
                // on the multi-week sigDeadlines Pay SDKs customarily issue,
                // which would route every permit to the confirm page and
                // undo the in-sheet flow. What the decision accepts: a
                // signature produced without a click stays redeemable for up
                // to 30 days by a spender this validator only shape-checks
                // (wcPayMessageConsistency). What bounds it: the amount is
                // pinned to the order, the nonce makes it one-shot, and the
                // Pay server refuses an expired order whatever the permit
                // says. Passed explicitly so the intent stays visible here.
                maxDeadlineS: WC_PAY_PERMIT_MAX_DEADLINE_S,
              });
              if (plan.mode === 'inline' && !takeInlineSpend()) {
                plan = {
                  mode: 'fallback',
                  reason: WC_PAY_INLINE_BUDGET_REASON,
                };
              }
              if (plan.mode === 'fallback') {
                // a plan-level refusal otherwise vanishes silently into the
                // confirm push — the pipeline-level fallbacks all log, and a
                // gate demotion must be as visible on a device
                console.error('wcPay inline permit plan fallback', plan.reason);
              }
              if (plan.mode === 'inline') {
                const outcome = await runInlineSignature({
                  index: i,
                  controller: inlineController,
                  summary: { kind: 'typedData', summary: plan.summary },
                  run: () =>
                    wcPayInlineSignTypedData({
                      networkId,
                      accountId: account.id,
                      accountAddress: account.address,
                      message,
                      option,
                      sourceInfo: buildWcPaySourceInfo({
                        method,
                        params: parsed,
                        scope: 'ethereum',
                      }),
                      throwIfCancelled,
                      onPhase: inlineController.onPhase,
                    }),
                });
                if (outcome === 'done') {
                  break;
                }
              }
            }
            // the inline attempt above may itself have spanned a page close;
            // re-check so no confirm modal is pushed onto a stack whose owner
            // is gone (see eth_sendTransaction)
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // park the host dialog before the confirm page takes the screen
            // (see IWcPayInlineController.onBeforePushConfirmModal)
            await inlineController?.onBeforePushConfirmModal?.();
            let signature: string;
            try {
              signature = await new Promise<string>((resolve, reject) => {
                navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                  screen: EModalSignatureConfirmRoutes.MessageConfirm,
                  params: {
                    networkId,
                    accountId: account.id,
                    unsignedMessage: {
                      type: EMessageTypesEth.TYPED_DATA_V4,
                      message,
                      payload: [account.address, message],
                    },
                    sourceInfo: buildWcPaySourceInfo({
                      method,
                      params: parsed,
                      scope: 'ethereum',
                    }),
                    onSuccess: (result: string) => resolve(result),
                    onFail: (error: Error) => reject(error),
                    onCancel: () =>
                      reject(
                        new WcPayUserCancelledError('User canceled payment'),
                      ),
                  },
                });
              });
            } finally {
              // reveal the host dialog once this confirm settles (see the
              // eth_sendTransaction branch)
              inlineController?.onAfterConfirmModalSettled?.();
            }
            results.push(signature);
            await persistActionResult(i, signature);
            break;
          }
          case EWcPayActionMethod.PersonalSign: {
            // normalize un-prefixed hex payloads like every other
            // personal_sign entry point, so the signed bytes match the
            // counterparty's expectation
            const message = autoFixPersonalSignMessage({
              message: extractWcPayPersonalSignMessage({
                parsed,
                accountAddress: account.address,
              }),
            });
            // re-check after the async prep above (see eth_sendTransaction)
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // Inline path (Phase 3 §4): sign after the sheet has shown the
            // message, when the gate proved it displayable. No order proof
            // exists for an arbitrary message, so display IS the contract —
            // anything the gate refuses goes to the confirm page, whose
            // raw/hex rendering has no such constraint. Never a spend: the
            // spend budget is not consulted, but the leg is bounded on its
            // own (one headless signature per sequence, taken at the
            // attempt like every other inline budget). Same bookkeeping as
            // the typed-data branch; nothing here broadcasts.
            if (inlineController && option) {
              let plan = getWcPayInlinePersonalSignPlan({
                action: actions[i],
                option,
                accountAddress: account.address,
              });
              if (plan.mode === 'inline' && !takeInlinePersonalSign()) {
                plan = {
                  mode: 'fallback',
                  reason: WC_PAY_INLINE_PERSONAL_SIGN_BUDGET_REASON,
                };
              }
              if (plan.mode === 'fallback') {
                // parity with the other branches: a gate demotion must be
                // visible on a device (the confirm push itself is silent)
                console.error(
                  'wcPay inline personal-sign plan fallback',
                  plan.reason,
                );
              }
              if (plan.mode === 'inline') {
                const outcome = await runInlineSignature({
                  index: i,
                  controller: inlineController,
                  summary: { kind: 'personalSign', summary: plan.summary },
                  run: () =>
                    wcPayInlineSignPersonalMessage({
                      networkId,
                      accountId: account.id,
                      accountAddress: account.address,
                      // the gate's normalized message — the very string its
                      // summary text is the decode of. It matches this
                      // branch's own `message` by construction (same
                      // extraction + normalization), so gate-refused
                      // messages still reach the page below unchanged.
                      message: plan.message,
                      option,
                      sourceInfo: buildWcPaySourceInfo({
                        method,
                        params: parsed,
                        scope: 'ethereum',
                      }),
                      throwIfCancelled,
                      onPhase: inlineController.onPhase,
                    }),
                });
                if (outcome === 'done') {
                  break;
                }
              }
            }
            // the inline attempt above may itself have spanned a page close;
            // re-check so no confirm modal is pushed onto a stack whose owner
            // is gone (see eth_sendTransaction)
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // park the host dialog before the confirm page takes the screen
            // (see IWcPayInlineController.onBeforePushConfirmModal)
            await inlineController?.onBeforePushConfirmModal?.();
            let signature: string;
            try {
              signature = await new Promise<string>((resolve, reject) => {
                navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                  screen: EModalSignatureConfirmRoutes.MessageConfirm,
                  params: {
                    networkId,
                    accountId: account.id,
                    unsignedMessage: {
                      type: EMessageTypesEth.PERSONAL_SIGN,
                      message,
                      payload: [message, account.address],
                    },
                    sourceInfo: buildWcPaySourceInfo({
                      method,
                      params: parsed,
                      scope: 'ethereum',
                    }),
                    onSuccess: (result: string) => resolve(result),
                    onFail: (error: Error) => reject(error),
                    onCancel: () =>
                      reject(
                        new WcPayUserCancelledError('User canceled payment'),
                      ),
                  },
                });
              });
            } finally {
              // reveal the host dialog once this confirm settles (see the
              // eth_sendTransaction branch)
              inlineController?.onAfterConfirmModalSettled?.();
            }
            results.push(signature);
            await persistActionResult(i, signature);
            break;
          }
          case EWcPayActionMethod.SolanaSignTransaction: {
            const txBase64 = extractWcPaySolanaTransaction(parsed);
            const encodedTx = wcPaySolanaTxToEncodedTx(txBase64);
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  networkId,
                  accountId: account.id,
                  encodedTx,
                },
              );
            // re-check after the async prep above (see eth_sendTransaction);
            // as in the typed-data branch, the headless signature sits behind
            // these guards rather than in front of them
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // Inline path: sign only, without a confirm page, when the blob
            // proves to be the approved order. Same bookkeeping rules as the
            // typed-data branch above — a signature is not a broadcast.
            if (inlineController && option) {
              // Re-derives, from the same params, the very txBase64 this case
              // already extracted; it is called for the gate that comes with
              // its own checks: the method, the CAIP-2 chain shape, and the
              // size pre-filter that keeps an oversize blob off the background
              // proxy. The blob handed to the plan below stays the one the
              // unsignedTx above was built from, so what gets signed is what
              // gets checked.
              const request = getWcPayInlineSolanaRequest({
                action: actions[i],
                option,
              });
              // Everything the plan is built from is sourced from the
              // REQUEST, so check → plan → sign is one value by construction:
              // a refused request never reaches the check, and carries its
              // own reason straight into the fallback plan. The blob the
              // request holds is the same string as the case-local
              // `txBase64` above — both come from
              // extractWcPaySolanaTransaction on these very params — which
              // stays only as what wcPaySolanaTxToEncodedTx built the
              // unsignedTx from.
              let plan: IWcPayInlineSolanaPlan;
              if (request.mode === 'request') {
                // The order check decodes the blob with @solana/web3.js,
                // which lives in the background runtime only (spec §5
                // "Runtime placement").
                const consistency =
                  await backgroundApiProxy.serviceWalletConnectPay.checkSolanaTxMatchesOrder(
                    {
                      txBase64: request.txBase64,
                      caip2ChainId: request.caip2ChainId,
                      option,
                    },
                  );
                // spl legs: the mint must resolve through the wallet registry
                // and agree with the option asset (the rule the EVM Permit2
                // token check draws); native legs carry no mint and are fully
                // judged by the validator itself.
                const mint = consistency.ok
                  ? consistency.summary.mint
                  : undefined;
                const resolvedToken = mint
                  ? await resolveWcPayToken({
                      networkId,
                      accountId: account.id,
                      address: mint,
                    })
                  : undefined;
                plan = getWcPayInlineSolanaPlan({
                  option,
                  txBase64: request.txBase64,
                  consistency,
                  resolvedToken,
                });
              } else {
                plan = { mode: 'fallback', reason: request.reason };
              }
              if (plan.mode === 'inline' && !takeInlineSpend()) {
                plan = {
                  mode: 'fallback',
                  reason: WC_PAY_INLINE_BUDGET_REASON,
                };
              }
              if (plan.mode === 'fallback') {
                // parity with the other branches: a gate demotion must be
                // visible on a device (the confirm push itself is silent)
                console.error('wcPay inline solana plan fallback', plan.reason);
              }
              if (plan.mode === 'inline') {
                const outcome = await runInlineSignature({
                  index: i,
                  controller: inlineController,
                  summary: { kind: 'solana', summary: plan.summary },
                  run: () =>
                    wcPayInlineSignSolanaTx({
                      networkId,
                      accountId: account.id,
                      accountAddress: account.address,
                      option,
                      unsignedTx,
                      // the checked blob, carried through the plan so the
                      // pipeline compares the signed transaction against it
                      txBase64: plan.txBase64,
                      sourceInfo: buildWcPaySourceInfo({
                        method,
                        params: parsed,
                        scope: 'solana',
                      }),
                      throwIfCancelled,
                      onPhase: inlineController.onPhase,
                    }),
                });
                if (outcome === 'done') {
                  break;
                }
              }
            }
            // the inline attempt above may itself have spanned a page close;
            // re-check before the confirm modal (see eth_sendTransaction)
            throwIfCancelled();
            if (isStoppedAfterBroadcast()) {
              return results;
            }
            // park the host dialog before the confirm page takes the screen
            // (see IWcPayInlineController.onBeforePushConfirmModal)
            await inlineController?.onBeforePushConfirmModal?.();
            let rawTx: string;
            try {
              rawTx = await new Promise<string>((resolve, reject) => {
                navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                  screen: EModalSignatureConfirmRoutes.TxConfirm,
                  params: {
                    networkId,
                    accountId: account.id,
                    unsignedTxs: [unsignedTx],
                    // WalletConnect Pay submits the signed transaction itself;
                    // the wallet must sign only and never broadcast
                    signOnly: true,
                    // the Pay server fixed the fee inside the tx blob; block
                    // the fee flow from rewriting it before signing (sol vault
                    // attaches a priority-fee instruction unless this is
                    // false)
                    feeInfoEditable: false,
                    sourceInfo: buildWcPaySourceInfo({
                      method,
                      params: parsed,
                      scope: 'solana',
                    }),
                    onSuccess: (txs: ISendTxOnSuccessData[]) => {
                      const raw = txs?.[0]?.signedTx?.rawTx;
                      if (raw) {
                        resolve(raw);
                      } else {
                        reject(
                          new WcPayError({
                            code: EWcPayErrorCode.MissingSignedTx,
                            message: 'Missing signed transaction',
                          }),
                        );
                      }
                    },
                    onFail: (error: Error) => reject(error),
                    onCancel: () =>
                      reject(
                        new WcPayUserCancelledError('User canceled payment'),
                      ),
                  },
                });
              });
            } finally {
              // reveal the host dialog once this confirm settles (see the
              // eth_sendTransaction branch)
              inlineController?.onAfterConfirmModalSettled?.();
            }
            // confirmPayment expects the full signed transaction; sol
            // signedTx.rawTx is already base64, pass through unchanged
            results.push(rawTx);
            await persistActionResult(i, rawTx);
            break;
          }
          default:
            // never skip unknown actions: results must match actions exactly
            throw new WcPayError({
              code: EWcPayErrorCode.UnsupportedMethod,
              message: `Unsupported WalletConnect Pay method: ${method}`,
            });
        }
      }

      return results;
    },
    [navigation],
  );

  return { executeActions };
}
