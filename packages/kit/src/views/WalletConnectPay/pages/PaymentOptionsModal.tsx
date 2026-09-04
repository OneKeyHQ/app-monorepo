import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Dialog,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
  usePreventRemove,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalWalletConnectPayRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalWalletConnectPayParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { shouldRefuseWcPayOptionUpfront } from '@onekeyhq/shared/src/walletConnect/payBroadcastUtils';
import {
  isWcPayTrustedUrl,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import {
  EWcPayErrorCode,
  WcPayError,
  isWcPayErrorCode,
} from '@onekeyhq/shared/src/walletConnect/payErrors';
import {
  getWcPayEffectiveExpiryMs,
  isWcPayExpired,
} from '@onekeyhq/shared/src/walletConnect/payExpiryUtils';
import { EWcPayStatus } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type {
  IWcPayConfirmResult,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useWcPayActionExecutor } from '../hooks/useWcPayActionExecutor';
import { useWcPayResultPolling } from '../hooks/useWcPayResultPolling';
import {
  EWcPayInlineFailureKind,
  WcPayUserCancelledError,
  classifyWcPayInlineFailure,
  isWcPayInlinePostSignError,
  nextWcPayPagePhaseAfterAttempt,
} from '../hooks/wcPayInlineUtils';

import type {
  IWcPayInlineController,
  IWcPayInlineFailure,
  IWcPayInlinePhase,
} from '../hooks/wcPayInlineUtils';
import type { RouteProp } from '@react-navigation/core';

// stable fallback so render never fabricates a fresh array identity
const EMPTY_OPTIONS: IWcPayOption[] = [];
const EMPTY_SIGNATURES: string[] = [];

/**
 * What the page is doing right now.
 *
 * `paying` carries the step the inline pipeline last reported (the
 * confirm-modal path reports none and stays on `preparing`, with the pushed
 * modal covering the page anyway).
 *
 * `result` is TERMINAL for this page: it is only ever entered once signatures
 * exist, its polling keeps re-submitting confirmPayment, and returning to a
 * payable state from it could pay a second time.
 */
type IWcPayPagePhase =
  | { name: 'idle' }
  | { name: 'paying'; step: 'preparing' | IWcPayInlinePhase | 'submitting' }
  | {
      name: 'result';
      params: {
        paymentId: string;
        optionId: string;
        signatures: string[];
        initialResult: IWcPayConfirmResult;
      };
    };

type IWcPayPagePayingStep = Extract<
  IWcPayPagePhase,
  { name: 'paying' }
>['step'];

// Placeholder identity for the result poller while the page is not in its
// result phase. The hook is disabled then — nothing is requested — and resets
// itself from the real `initialResult` once the identity changes.
const WC_PAY_IDLE_RESULT: IWcPayConfirmResult = {
  status: EWcPayStatus.Processing,
  isFinal: false,
};

function getWcPayPayingStepLabel(step: IWcPayPagePayingStep): string {
  // copy pending product i18n keys
  switch (step) {
    case 'estimating':
      return 'Estimating network fee…';
    case 'checking':
      return 'Checking balances…';
    // signing and broadcasting happen inside one atomic background call, so
    // the label must not promise a separate broadcast step
    case 'signing':
      return 'Signing & broadcasting…';
    // a message signature never broadcasts; placeholder until the inline
    // Permit2 UI brings the real copy
    case 'signingMessage':
      return 'Signing…';
    case 'recording':
      return 'Finalizing…';
    case 'submitting':
      return 'Submitting payment…';
    case 'preparing':
    default:
      return 'Preparing…';
  }
}

/**
 * A banner-surfaced failure plus the identity of the attempt that produced
 * it. The identity matters for the post-sign kind: its Retry must re-enter
 * the recovery machinery for the SAME payment option and account, so the
 * page refuses to start a differently-targeted attempt while one is on
 * screen (see the SendFailed lock below).
 */
interface IWcPayInlineFailureRecord {
  failure: IWcPayInlineFailure;
  optionId: string;
  accountKey: string;
}

/**
 * User-facing presentation of a failure the page keeps on screen instead of
 * toasting. This kind-derived copy is the ONLY thing rendered: `failure.message`
 * is either a raw vault/RPC string (post-sign) or the pipeline's English debug
 * text (balance) — never reviewed as copy, never translated — so it is logged
 * as a diagnostic and never shown, per `IWcPayInlineFailure.message`.
 *
 * Keyed on `kind` because the two banner-reachable failures differ only by
 * kind. This is NOT the "may this attempt be re-run in place" decision:
 * `failure.retryable` answers that one (false for both of these, see
 * runWcPayInlineAttempts) and is what an in-banner "try again as-is"
 * affordance would have to key off. The footer here re-runs handlePay from the
 * top, which re-enters the durable-progress recovery machinery instead of
 * repeating the failed attempt.
 */
function getWcPayInlineFailureCopy(failure: IWcPayInlineFailure): {
  guidance: string;
  offersPageRetry: boolean;
} {
  if (failure.kind === EWcPayInlineFailureKind.InsufficientBalance) {
    return {
      // copy pending product i18n keys
      guidance:
        'Not enough balance on this network. Pick another asset below, or top up and try again.',
      offersPageRetry: false,
    };
  }
  return {
    // copy pending product i18n keys
    guidance:
      'Something went wrong while sending. Retry to resume this payment safely.',
    offersPageRetry: true,
  };
}

// option.account is CAIP-10 ("namespace:reference:address"); its chain part
// maps to a wallet networkId so icons/names can be resolved locally instead
// of relying on the server-provided (often missing) icon urls
function getWcPayOptionNetworkId(option: IWcPayOption): string | undefined {
  const [namespace, reference] = option.account.split(':');
  return wcPayChainIdToNetworkId(`${namespace}:${reference}`) ?? undefined;
}

// External accounts broadcast inside their connected wallet during the
// "signing" step, so the duplicate-payment boundary (durable pre-broadcast
// txid record) cannot cover them; watch-only accounts cannot sign at all.
// WalletConnect Pay refuses both — the background enforces the same in
// buildPayAccounts and ServiceSend
function isWcPayUnsupportedAccountType({
  accountId,
  indexedAccountId,
}: {
  accountId?: string;
  indexedAccountId?: string;
}): boolean {
  return Boolean(
    !indexedAccountId &&
    accountId &&
    (accountUtils.isExternalAccount({ accountId }) ||
      accountUtils.isWatchingAccount({ accountId })),
  );
}

function formatPayAmount({
  value,
  decimals,
  symbol,
}: {
  value: string;
  decimals: number;
  symbol: string;
}) {
  return `${new BigNumber(value).shiftedBy(-decimals).toFixed()} ${symbol}`;
}

function useExpiryCountdown(expiryMs: number | undefined) {
  const [remainingSec, setRemainingSec] = useState<number | undefined>();
  useEffect(() => {
    if (!expiryMs) {
      setRemainingSec(undefined);
      return;
    }
    const tick = () => {
      setRemainingSec(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiryMs]);
  // expiry is optional in the payment info/options; without it there is no
  // local expiry signal and the server-reported status remains the only gate
  const isExpiredLocally = remainingSec !== undefined && remainingSec <= 0;
  if (remainingSec === undefined) {
    return { countdown: undefined, isExpiredLocally };
  }
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return {
    countdown: `${m}:${String(s).padStart(2, '0')}`,
    isExpiredLocally,
  };
}

function PaymentOptionsPage() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalWalletConnectPayParamList,
        EModalWalletConnectPayRoutes.PaymentOptions
      >
    >();
  const { paymentLink } = route.params;
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { executeActions } = useWcPayActionExecutor();
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pagePhase, setPagePhase] = useState<IWcPayPagePhase>({ name: 'idle' });
  // failures the page keeps on screen (persistent banner) instead of toasting:
  // an insufficient balance the user resolves by switching option, and a
  // post-sign send failure whose retry must re-enter the recovery machinery
  const [inlineFailure, setInlineFailure] =
    useState<IWcPayInlineFailureRecord>();
  // Pre-sign cancellation for the attempt in flight. Aborted when this page
  // unmounts: the pre-executor stretch ('preparing') is closable, and before
  // this signal existed a close there cancelled nothing — the pipeline kept
  // running headless and completed a payment the user believed dismissed.
  // The signal is only ever consulted before signing, so aborting can never
  // lose an in-flight broadcast — and once an action of the attempt has
  // broadcast, the executor stops aborting on it: it ends the sequence at
  // the next UI boundary and returns the results produced so far. handlePay
  // detects that partial set by length and ends without submitting it (the
  // broadcast txid is durably recorded for resume), and no context-free
  // confirm modal is pushed at the user from a dismissed flow.
  const payCancelControllerRef = useRef<AbortController | undefined>(undefined);
  // Synchronous re-entry latch. `isPaying` is React state and only lands on
  // the next render; this ref closes the same-task window a second caller
  // could otherwise use before that render commits.
  const payInFlightRef = useRef(false);
  useEffect(
    () => () => {
      payCancelControllerRef.current?.abort();
    },
    [],
  );

  // Mounted unconditionally (hooks order); idle until the page reaches its
  // result phase.
  const resultParams =
    pagePhase.name === 'result' ? pagePhase.params : undefined;
  const { result: pollResult, pollExhausted } = useWcPayResultPolling({
    paymentId: resultParams?.paymentId ?? '',
    optionId: resultParams?.optionId ?? '',
    signatures: resultParams?.signatures ?? EMPTY_SIGNATURES,
    initialResult: resultParams?.initialResult ?? WC_PAY_IDLE_RESULT,
    enabled: Boolean(resultParams),
  });

  // The signing window used to be covered by the pushed TxConfirm modal; the
  // inline path leaves this page on screen instead, so its own close controls
  // (header close, iOS swipe-down, backdrop) would let the user dismiss
  // mid-signing while the payment completes anyway — the durable progress
  // record keeps the money safe, but the user believes they cancelled.
  //
  // Scoped as tightly as the risk: only while the inline pipeline is actually
  // executing, which is exactly the window where 'preparing' is NOT the step.
  // The pre-executor stretch holds 'preparing' and stays closable — closing
  // there aborts the attempt through payCancelControllerRef (pre-sign, so
  // nothing irreversible has started), rather than letting it run on
  // headless. The controller's onFallback puts the step back to 'preparing'
  // on every exit to the confirm modal — including the retry-exhaustion one
  // the attempts loop takes without asking — so the lock never spans the
  // modal phase, where it would only add a way to strand the user if
  // executeActions never settles. Idle and result stay closable too; result
  // matches the standalone PaymentResultModal it replaces.
  const isInlineExecuting =
    pagePhase.name === 'paying' && pagePhase.step !== 'preparing';
  usePreventRemove(isInlineExecuting, () => {
    // a swallowed close gesture must not read as a frozen app; there is
    // nothing to cancel, so say what is happening instead
    Toast.message({
      // copy pending product i18n keys
      title: 'Payment in progress…',
    });
  });

  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;
  const isUnsupportedAccountType = isWcPayUnsupportedAccountType({
    accountId,
    indexedAccountId,
  });

  // a pre-sign banner (insufficient balance) reports one account's attempt;
  // switching account makes it stale exactly like switching option does. The
  // post-sign banner is different: it may shadow an already-broadcast
  // transaction, and discarding it on an account switch would re-arm Continue
  // for a second payment from the new account while the first may still land
  // — so it survives until its own Retry resolves the attempt
  useEffect(() => {
    setInlineFailure((prev) =>
      prev?.failure.kind === EWcPayInlineFailureKind.SendFailed
        ? prev
        : undefined,
    );
  }, [accountId, indexedAccountId]);

  // Identity of the latest options fetch. usePromiseResult's nonce only
  // guards the returned result; side effects inside the method (setLoadError)
  // would still land from a superseded run after an account switch.
  const optionsFetchGenerationRef = useRef(0);
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      optionsFetchGenerationRef.current += 1;
      const fetchGeneration = optionsFetchGenerationRef.current;
      if (!accountId && !indexedAccountId) {
        return undefined;
      }
      // don't fetch options for account types the flow refuses anyway; the
      // page renders a dedicated state and the background rejects the same
      // request in buildPayAccounts
      if (isWcPayUnsupportedAccountType({ accountId, indexedAccountId })) {
        return undefined;
      }
      // usePromiseResult swallows rejections, which would leave the page on
      // an endless spinner; track failures explicitly to render an error state
      try {
        setLoadError(false);
        const pay =
          await backgroundApiProxy.serviceWalletConnectPay.getPaymentOptions({
            paymentLink,
            accountId,
            indexedAccountId,
          });
        let supportsDurableProgress = false;
        try {
          supportsDurableProgress =
            await backgroundApiProxy.serviceWalletConnectPay.supportsDurableProgress();
        } catch {
          supportsDurableProgress = false;
        }
        // resolve wallet-side network presets once so each option can render
        // the local network icon/name even when the server omits icon urls
        const networkIds = Array.from(
          new Set(
            (pay.options ?? [])
              .map(getWcPayOptionNetworkId)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds,
          });
        const networkMap: Record<string, IServerNetwork> = {};
        for (const network of networks) {
          networkMap[network.id] = network;
        }
        return { pay, networkMap, supportsDurableProgress };
      } catch {
        if (optionsFetchGenerationRef.current === fetchGeneration) {
          setLoadError(true);
        }
        return undefined;
      }
    },
    [paymentLink, accountId, indexedAccountId],
    {
      watchLoading: true,
      // an account switch re-runs this request; the stale result must not
      // survive into the loading window, or Continue could hand options
      // resolved for the previous account to the executor signing with the
      // new one
      undefinedResultIfReRun: true,
    },
  );

  const payResult = result?.pay;
  const networkMap = result?.networkMap;
  const supportsDurableProgress = result?.supportsDurableProgress ?? false;
  const options = payResult?.options ?? EMPTY_OPTIONS;
  // Deterministic pre-form gate: option.actions is advisory — the server
  // may omit it or return a list diverging from the authoritative one that
  // getRequiredPaymentActions fetches AFTER the compliance form — so on
  // platforms without durable progress every option is refused upfront.
  // Gating on option.actions could collect personal identity data first and
  // only then refuse the payment.
  const areOptionsRefusedOnPlatform = shouldRefuseWcPayOptionUpfront({
    supportsDurableProgress,
  });
  // The post-sign failure state is terminal for the option/account choice:
  // its banner is the safety exit back into the recovery machinery, and
  // drifting to another target must not discard it (see handlePay).
  const isSendFailedLocked =
    inlineFailure?.failure.kind === EWcPayInlineFailureKind.SendFailed;
  // While SendFailed-locked the selection is PINNED to the attempt that
  // failed instead of drifting with the account-scoped option list: an
  // account switch re-fetches options, and the `?? options[0]` fallback
  // would silently land on a differently-targeted option — leaving every
  // control disabled at once (list locked, Continue mismatch-blocked,
  // banner not clearable). Pinning resolves to undefined when the failed
  // option is not in the current account's list; Continue stays disabled
  // and the banner tells the user to switch back.
  const selectedOption: IWcPayOption | undefined = (() => {
    if (areOptionsRefusedOnPlatform) {
      return undefined;
    }
    if (isSendFailedLocked) {
      return options.find((option) => option.id === inlineFailure?.optionId);
    }
    return (
      options.find((option) => option.id === selectedOptionId) ?? options[0]
    );
  })();
  const hasPayableOption = options.length > 0 && !areOptionsRefusedOnPlatform;
  // The effective deadline is the earliest of the payment-level and the
  // selected option's expiry; the countdown, the Continue gate and every
  // in-flow re-check below must all use this single value.
  const effectiveExpiryMs = getWcPayEffectiveExpiryMs({
    infoExpiresAt: payResult?.info?.expiresAt,
    optionExpiresAt: selectedOption?.expiresAt,
  });
  const { countdown, isExpiredLocally } = useExpiryCountdown(effectiveExpiryMs);
  const payStatus = payResult?.info?.status;
  // A payment in a final state can no longer be paid regardless of balances.
  const isPaymentInactive =
    payStatus === EWcPayStatus.Cancelled ||
    payStatus === EWcPayStatus.Expired ||
    payStatus === EWcPayStatus.Failed ||
    payStatus === EWcPayStatus.Succeeded;
  // Single gate for starting a payment, shared by the Continue button and
  // handlePay. Positive gate: only a server-reported requires_action status
  // may enter the payment executor. A missing or non-actionable status
  // (e.g. `processing` while options are still present) must NOT be payable,
  // or an already-submitted payment could be fetched and broadcast again.
  // The local countdown must also not have hit zero (the page may outlive
  // the deadline while the server status is stale).
  const isPaymentActionable =
    payStatus === EWcPayStatus.RequiresAction && !isExpiredLocally;

  const handlePay = useCallback(async () => {
    if (
      payInFlightRef.current ||
      !payResult ||
      !selectedOption ||
      isPaying ||
      isLoading ||
      !isPaymentActionable ||
      // the result phase is terminal: its polling keeps re-submitting the
      // signatures this flow produced, so a second run could pay twice. The
      // render never offers a way in — this is the belt to that suspenders.
      pagePhase.name === 'result'
    ) {
      return;
    }
    // A post-sign failure pins the payment to the attempt that produced it:
    // its transaction may already be on chain, and only a retry with the
    // same option and account re-enters the recovery machinery
    // (stored progress is keyed by payment+option+account). Starting a
    // differently-targeted attempt here would sign a second payment while
    // the first may still land. The option list and the confirm button are
    // disabled to the same rule — this is the belt to that suspenders.
    if (
      inlineFailure?.failure.kind === EWcPayInlineFailureKind.SendFailed &&
      (selectedOption.id !== inlineFailure.optionId ||
        (indexedAccountId ?? accountId ?? '') !== inlineFailure.accountKey)
    ) {
      return;
    }
    payInFlightRef.current = true;
    setIsPaying(true);
    // a new attempt supersedes whatever the previous one left on screen
    setInlineFailure(undefined);
    setPagePhase({ name: 'paying', step: 'preparing' });
    // one cancel scope per attempt; aborted by the unmount cleanup above
    const cancelController = new AbortController();
    payCancelControllerRef.current = cancelController;
    try {
      const { paymentId } = payResult;
      const optionId = selectedOption.id;

      // Refuse before the compliance form whenever durable progress is
      // unavailable. option.actions cannot prove the payment is sign-only
      // (the field is advisory; the authoritative list is only fetched
      // after the form), so collecting KYC first could hand personal data
      // to the compliance provider for a payment that cannot complete here.
      if (
        shouldRefuseWcPayOptionUpfront({
          supportsDurableProgress:
            await backgroundApiProxy.serviceWalletConnectPay.supportsDurableProgress(),
        })
      ) {
        throw new WcPayError({
          code: EWcPayErrorCode.BroadcastUnsupported,
          message: 'On-chain payments are not supported on this platform',
        });
      }

      // 1. compliance data collection must complete BEFORE fetching actions.
      // Prefer per-option collectData; fall back to the legacy top-level field
      // so merchants still on the old response shape are not skipped.
      const collectData = selectedOption.collectData ?? payResult.collectData;
      if (collectData) {
        // Only the hosted-url flow is supported (native field rendering is a
        // later phase). When collection is required but no hosted form is
        // available, abort instead of silently skipping compliance data and
        // proceeding to signing.
        if (!collectData.url) {
          throw new OneKeyLocalError(
            'WalletConnect Pay data collection form is unavailable',
          );
        }
        // the form URL comes from the server response; never load an
        // untrusted host into the webview/iframe presented as WC Pay
        if (!isWcPayTrustedUrl(collectData.url)) {
          throw new OneKeyLocalError(
            'Untrusted WalletConnect Pay data collection URL',
          );
        }
        await new Promise<void>((resolve, reject) => {
          navigation.push(EModalWalletConnectPayRoutes.DataCollection, {
            collectData,
            onComplete: () => resolve(),
            onError: (error: string) => reject(new OneKeyLocalError(error)),
            onCancel: () =>
              reject(new WcPayUserCancelledError('User canceled payment')),
          });
        });
      }

      // the compliance form (and any hesitation before it) may outlive the
      // payment deadline; never fetch/execute actions for an expired payment
      if (isWcPayExpired(effectiveExpiryMs)) {
        throw new WcPayError({
          code: EWcPayErrorCode.PaymentExpired,
          message: 'This payment has expired',
        });
      }

      // 2. fetch the ordered signing actions
      const actions =
        await backgroundApiProxy.serviceWalletConnectPay.getRequiredPaymentActions(
          { paymentId, optionId },
        );

      // 3. sign sequentially; results order must match actions order.
      // Progress is persisted in the background per payment+option+account
      // as each action completes, so a retry — or a relaunch after the app
      // was killed mid-flow (on native, main/bg are separate JS heaps and
      // this page's state does not survive) — resumes from the first
      // incomplete action instead of re-broadcasting transactions that are
      // already on-chain. The background validates stored entries against
      // the freshly fetched action list by fingerprint and clears the record
      // only once the server reports a final payment state.
      const progressAccountKey = indexedAccountId ?? accountId ?? '';
      const completedResults =
        await backgroundApiProxy.serviceWalletConnectPay.getStoredActionResults(
          {
            paymentId,
            optionId,
            accountKey: progressAccountKey,
            actions,
          },
        );
      // The inline path's observer/decider. Only two verdicts ever reach the
      // user from here: a fee-estimate failure is re-run by the attempts loop
      // (which caps its own re-runs and then degrades to the confirm page —
      // the design's backstop for fee errors), and an insufficient balance
      // ends the flow with a persistent banner rather than a confirm page the
      // user could not resolve there either. Everything else reroutes to the
      // confirm page.
      const inlineController: IWcPayInlineController = {
        onPhase: (step) => setPagePhase({ name: 'paying', step }),
        // Single owner of the transition out of inline execution. The loop
        // calls this on every fallback exit, including the retry-exhaustion
        // one it decides without asking the controller — so the step label
        // stops claiming the pipeline is running and the page unlocks before
        // the confirm modal is pushed over it.
        onFallback: () => setPagePhase({ name: 'paying', step: 'preparing' }),
        onInlineFailure: (failure) => {
          if (failure.kind === EWcPayInlineFailureKind.FeeEstimateFailed) {
            return Promise.resolve('retry');
          }
          if (failure.kind === EWcPayInlineFailureKind.WalletNotBackedUp) {
            // the backup dialog is already on screen and owns the next step;
            // a banner here would only repeat it in weaker words
            return Promise.resolve('abort');
          }
          if (failure.kind === EWcPayInlineFailureKind.InsufficientBalance) {
            // the selection stays as it is: the banner describes the option
            // the user picked, and the list guides them to another one. Only
            // kind-derived copy reaches the screen, so the shortfall detail
            // lives in the log
            console.error(
              'wcPay inline failure',
              failure.kind,
              failure.message,
            );
            setInlineFailure({
              failure,
              optionId,
              accountKey: progressAccountKey,
            });
            return Promise.resolve('abort');
          }
          // everything else is a pre-sign blocker the confirm page owns; the
          // phase transition is onFallback's job, not this branch's
          return Promise.resolve('fallback');
        },
      };

      const signatures = await executeActions({
        actions,
        accountId,
        indexedAccountId,
        completedResults,
        // pre-sign cancellation boundary: fires when this page unmounts, so
        // a close during the (closable) preparing stretch actually cancels
        // the flow instead of letting it sign and broadcast headless
        cancelSignal: cancelController.signal,
        // opts this call into the inline (headless) send for the action
        // shapes getWcPayInlineTxPlan admits; everything else still runs
        // through the confirm modal
        option: selectedOption,
        inlineController,
        // identity of the durable progress record: eth_sendTransaction
        // confirms hand it to the background so the txid is persisted
        // between signing and broadcast, before onActionComplete below ever
        // gets the chance to run
        progressContext: {
          paymentId,
          optionId,
          accountKey: progressAccountKey,
        },
        // absolute deadline checked before every action and enforced
        // before any broadcast (onBeforeSend + background broadcastDeadline);
        // it never moves during the flow, so capturing it here stays correct
        expiryMs: effectiveExpiryMs,
        // awaited by the executor before the sequence continues, so a
        // broadcast transaction is durably recorded before anything else
        // can fail
        onActionComplete: async ({ index, result: actionResult }) => {
          await backgroundApiProxy.serviceWalletConnectPay.recordActionResult({
            paymentId,
            optionId,
            accountKey: progressAccountKey,
            action: actions[index],
            index,
            result: actionResult,
          });
        },
        // a recorded transaction reverted on chain: discard it (and anything
        // after it) so the next attempt re-executes the action instead of
        // resuming a txid that can never confirm
        onActionInvalidated: async ({ index }) => {
          await backgroundApiProxy.serviceWalletConnectPay.discardActionResultsFrom(
            {
              paymentId,
              optionId,
              accountKey: progressAccountKey,
              fromIndex: index,
            },
          );
        },
      });

      // A result set shorter than the action list is the executor's
      // stopped-after-broadcast exit: the page went away after an on-chain
      // result existed and the remaining actions were never executed. Do
      // NOT submit a known-partial signature set — confirmPayment's
      // contract for short arrays is unverified, and ANY isFinal verdict it
      // returns (failed included) clears the whole progress record,
      // deleting the broadcast evidence. Every produced result is already
      // durably persisted, so ending here keeps the resume machinery
      // intact: the next entry into this payment resumes from the stored
      // prefix, and an abandoned payment expires server-side.
      if (signatures.length < actions.length) {
        return;
      }

      // 4. submit and show result. The transaction may already be broadcast
      // by this point, so a confirmPayment failure must NOT drop the
      // signatures back on the options page (retrying there would sign and
      // broadcast a second payment). Keep the same signatures in the result
      // phase, whose polling keeps re-submitting confirmPayment.
      setPagePhase({ name: 'paying', step: 'submitting' });
      let confirmResult: IWcPayConfirmResult;
      try {
        confirmResult =
          await backgroundApiProxy.serviceWalletConnectPay.confirmPayment({
            paymentId,
            optionId,
            signatures,
          });
      } catch {
        confirmResult = { status: EWcPayStatus.Processing, isFinal: false };
      }
      // both the inline and the confirm-modal path arrive here with
      // signatures in hand; the page must never leave this phase again
      setPagePhase({
        name: 'result',
        params: {
          paymentId,
          optionId,
          signatures,
          initialResult: confirmResult,
        },
      });
    } catch (error) {
      if (isWcPayInlinePostSignError(error)) {
        // thrown at or after signing: a transaction may already be on chain,
        // so this must not vanish with a toast. The banner's page-level Retry
        // re-runs handlePay, which re-enters the durable-progress recovery
        // machinery (stored action results, never-broadcast probe, pinned
        // nonce) instead of signing a second payment. The raw vault/RPC text
        // is a diagnostic only — the banner shows reviewed copy instead.
        console.error('wcPay inline post-sign failure', error);
        setInlineFailure({
          failure: classifyWcPayInlineFailure({ stage: 'send', error }),
          optionId: selectedOption.id,
          accountKey: indexedAccountId ?? accountId ?? '',
        });
      } else if (isWcPayErrorCode(error, EWcPayErrorCode.ProgressDamaged)) {
        // Deterministically corrupt stored progress: without an escape this
        // payment+option+account stays refused until the 48h storage TTL.
        // The discard is user-confirmed and only reachable on a CONTENT
        // verdict: the payload was read and decoded and is provably not a
        // record the store ever wrote (arrays only), so it cannot carry a
        // real txid. Read FAILURES — content unknown, possibly an intact
        // txid-bearing record — classify as unreadable, never corrupt, and
        // can never reach this discard (see readSecureEntries), so this
        // path cannot delete real duplicate-payment evidence.
        //
        // Never from a dead page: the fetches above can outlive a close
        // (the executor got the same gate), and a destructive dialog over
        // whatever screen the user is on now would carry no context. The
        // record is not lost — the dialog re-surfaces on the next entry
        // into this payment, or the TTL cleans it up.
        if (cancelController.signal.aborted) {
          return;
        }
        Dialog.show({
          // copy pending product i18n keys
          title: 'Payment progress damaged',
          description:
            'The progress saved for this payment on this device is damaged and cannot be resumed. Discard it to start this payment over.',
          onConfirmText: 'Discard and start over',
          onConfirm: async ({ close }) => {
            try {
              await backgroundApiProxy.serviceWalletConnectPay.discardActionResultsFrom(
                {
                  paymentId: payResult.paymentId,
                  optionId: selectedOption.id,
                  accountKey: indexedAccountId ?? accountId ?? '',
                  fromIndex: 0,
                },
              );
            } catch (discardError) {
              // a failed discard must not leave the dialog sitting silent
              // (Dialog only auto-closes on a settled onConfirm): say it
              // failed and close — the record is untouched and the dialog
              // returns on the next attempt
              console.error(
                'wcPay discard damaged progress failed',
                discardError,
              );
              Toast.error({
                title: intl.formatMessage({ id: ETranslations.global_failed }),
              });
              await close();
            }
          },
        });
      } else if (!(error instanceof WcPayUserCancelledError)) {
        // user-intent cancellation (dismissed a confirm modal or the collect
        // form) ends the flow silently
        Toast.error({
          title:
            (error as Error | undefined)?.message ??
            intl.formatMessage({ id: ETranslations.global_failed }),
        });
      }
    } finally {
      payInFlightRef.current = false;
      if (payCancelControllerRef.current === cancelController) {
        payCancelControllerRef.current = undefined;
      }
      setIsPaying(false);
      // Covers both the failure paths above and a flow that ended without
      // reaching the result phase. Reduced through the updater rather than the
      // captured `pagePhase`, which is stale inside this closure.
      setPagePhase(nextWcPayPagePhaseAfterAttempt);
    }
  }, [
    payResult,
    selectedOption,
    isPaying,
    isLoading,
    isPaymentActionable,
    pagePhase.name,
    inlineFailure,
    effectiveExpiryMs,
    navigation,
    executeActions,
    accountId,
    indexedAccountId,
    intl,
  ]);

  const inlineFailureCopy = inlineFailure
    ? getWcPayInlineFailureCopy(inlineFailure.failure)
    : undefined;
  // With the selection pinned (see selectedOption above) the only drift
  // left is the signing account — plus a pinned option missing from the
  // current account's list, which surfaces as selectedOption === undefined
  // and keeps the option check below true. Retry must stay disabled until
  // the user is back on the exact attempt that failed; the banner explains
  // the way out.
  const isSendFailedTargetMismatch =
    isSendFailedLocked &&
    !!inlineFailure &&
    (selectedOption?.id !== inlineFailure.optionId ||
      (indexedAccountId ?? accountId ?? '') !== inlineFailure.accountKey);

  // same status shapes the standalone PaymentResultModal renders, shown here
  // once the payment was submitted from this page
  const renderResultStatus = () => {
    if (pollResult.status === EWcPayStatus.Succeeded) {
      return (
        <YStack alignItems="center" gap="$3">
          <Icon name="CheckRadioSolid" size="$16" color="$iconSuccess" />
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.global_success })}
          </SizableText>
          {pollResult.info?.txId ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {pollResult.info.txId}
            </SizableText>
          ) : null}
        </YStack>
      );
    }
    if (
      pollResult.status === EWcPayStatus.Failed ||
      pollResult.status === EWcPayStatus.Expired ||
      pollResult.status === EWcPayStatus.Cancelled
    ) {
      return (
        <YStack alignItems="center" gap="$3">
          <Icon name="XCircleSolid" size="$16" color="$iconCritical" />
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.global_failed })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {pollResult.status}
          </SizableText>
        </YStack>
      );
    }
    return (
      <YStack alignItems="center" gap="$3">
        <Spinner size="large" />
        <SizableText size="$headingXl">
          {intl.formatMessage({ id: ETranslations.global_processing })}
        </SizableText>
      </YStack>
    );
  };

  // The payment was submitted from this page: the whole page becomes the
  // result view. Every hook above has already run, so this branch does not
  // move hook order; it only replaces what is rendered. Nothing here can start
  // another payment — the options list, the Continue gate and the failure
  // banner are all gone.
  if (pagePhase.name === 'result') {
    return (
      <Page scrollEnabled safeAreaEnabled>
        <Page.Header title="WalletConnect Pay" />
        <Page.Body>
          <Stack flex={1} alignItems="center" justifyContent="center" py="$10">
            {renderResultStatus()}
          </Stack>
        </Page.Body>
        <Page.Footer
          onConfirm={() => {
            navigation.popStack();
          }}
          onConfirmText={intl.formatMessage({ id: ETranslations.global_done })}
          confirmButtonProps={{
            disabled: !pollResult.isFinal && !pollExhausted,
          }}
        />
      </Page>
    );
  }

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="WalletConnect Pay" />
      <Page.Body>
        {isUnsupportedAccountType ? (
          <Stack
            flex={1}
            alignItems="center"
            justifyContent="center"
            py="$10"
            px="$5"
          >
            <SizableText size="$bodyLgMedium" textAlign="center">
              {/* copy pending product i18n keys */}
              This account type is not supported by WalletConnect Pay
            </SizableText>
          </Stack>
        ) : null}
        {!isLoading && loadError ? (
          <Stack
            flex={1}
            alignItems="center"
            justifyContent="center"
            py="$10"
            gap="$3"
          >
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              })}
            </SizableText>
            <Button
              testID="wc-pay-options-retry"
              size="small"
              onPress={() => {
                void run();
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </Stack>
        ) : null}
        {!loadError &&
        !isUnsupportedAccountType &&
        (isLoading || !payResult) ? (
          <Stack flex={1} alignItems="center" justifyContent="center" py="$10">
            <Spinner size="large" />
          </Stack>
        ) : null}
        {!loadError && !isLoading && payResult ? (
          <YStack px="$5" gap="$4">
            <YStack alignItems="center" gap="$1" py="$4">
              <SizableText size="$headingXl">
                {payResult.info?.merchant?.name ?? ''}
              </SizableText>
              {payResult.info?.amount ? (
                <SizableText size="$heading3xl">
                  {formatPayAmount({
                    value: payResult.info.amount.value,
                    decimals: payResult.info.amount.display.decimals,
                    symbol: payResult.info.amount.display.assetSymbol,
                  })}
                </SizableText>
              ) : null}
              {countdown ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {countdown}
                </SizableText>
              ) : null}
              {pagePhase.name === 'paying' ? (
                <XStack alignItems="center" gap="$2" pt="$2">
                  <Spinner size="small" />
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {getWcPayPayingStepLabel(pagePhase.step)}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>
            <YStack>
              {options.map((option) => {
                const { display } = option.amount;
                const networkId = getWcPayOptionNetworkId(option);
                const network = networkId ? networkMap?.[networkId] : undefined;
                const networkName = network?.name ?? display.networkName;
                // native-coin options often ship without iconUrl; the local
                // network logo is the canonical icon for them
                const tokenImageUri = display.iconUrl || network?.logoURI;
                const networkImageUri =
                  network?.logoURI ?? display.networkIconUrl;
                // switching option mid-flow would leave the running attempt
                // paying for the previously selected one; after a post-sign
                // failure the list stays locked so the recovery banner (and
                // the pinned option it belongs to) cannot be discarded by
                // picking another option and paying a second time
                const isDisabled =
                  areOptionsRefusedOnPlatform || isPaying || isSendFailedLocked;
                return (
                  <ListItem
                    key={option.id}
                    userSelect="none"
                    disabled={isDisabled}
                    checkMark={selectedOption?.id === option.id}
                    onPress={() => {
                      if (isDisabled) {
                        return;
                      }
                      if (option.id !== selectedOption?.id) {
                        // the (pre-sign) banner reports the previously
                        // selected option's attempt and no longer applies
                        setInlineFailure(undefined);
                      }
                      setSelectedOptionId(option.id);
                    }}
                  >
                    <Token
                      size="lg"
                      tokenImageUri={tokenImageUri}
                      networkImageUri={networkImageUri}
                    />
                    <ListItem.Text
                      flex={1}
                      primary={
                        <XStack alignItems="center" gap="$1" minWidth={0}>
                          <SizableText
                            size="$bodyLgMedium"
                            numberOfLines={1}
                            flexShrink={1}
                          >
                            {display.assetSymbol}
                          </SizableText>
                          {networkName ? (
                            <Badge flexShrink={1}>
                              <Badge.Text numberOfLines={1}>
                                {networkName}
                              </Badge.Text>
                            </Badge>
                          ) : null}
                        </XStack>
                      }
                      secondary={display.assetName}
                    />
                    <ListItem.Text
                      align="right"
                      primary={
                        <NumberSizeableText
                          textAlign="right"
                          size="$bodyLgMedium"
                          formatter="balance"
                          formatterOptions={{
                            tokenSymbol: display.assetSymbol,
                          }}
                        >
                          {new BigNumber(option.amount.value)
                            .shiftedBy(-display.decimals)
                            .toFixed()}
                        </NumberSizeableText>
                      }
                    />
                  </ListItem>
                );
              })}
              {options.length === 0 ? (
                <Stack alignItems="center" py="$8" gap="$1">
                  <SizableText size="$bodyLgMedium">
                    {/* copy pending product i18n keys */}
                    {isPaymentInactive
                      ? 'Payment unavailable'
                      : 'No payment options available'}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {isPaymentInactive
                      ? `This payment is ${payStatus ?? 'closed'} and can no longer be paid.`
                      : 'No supported asset has enough balance to cover this payment. Top up a supported stablecoin (plus gas) and try again.'}
                  </SizableText>
                </Stack>
              ) : null}
              {options.length > 0 && !hasPayableOption ? (
                <Stack alignItems="center" py="$4">
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({
                      id: ETranslations.wc_pay_onchain_unsupported_platform__msg,
                    })}
                  </SizableText>
                </Stack>
              ) : null}
            </YStack>
          </YStack>
        ) : null}
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={() => {
            void handlePay();
          }}
          onConfirmText={intl.formatMessage({
            id: inlineFailureCopy?.offersPageRetry
              ? ETranslations.global_retry
              : ETranslations.global_continue,
          })}
          confirmButtonProps={{
            disabled:
              !isPaymentActionable ||
              !selectedOption ||
              isPaying ||
              !!isLoading ||
              // a post-sign Retry is only safe against the exact attempt the
              // failure came from; a drifted target must not be payable
              isSendFailedTargetMismatch,
            loading: isPaying,
          }}
        >
          {inlineFailureCopy ? (
            <YStack
              flexShrink={1}
              p="$3"
              mb="$5"
              borderRadius="$3"
              bg="$bgCriticalSubdued"
              $gtMd={{ mb: '$0', mr: '$5' }}
            >
              <SizableText size="$bodyMd" color="$textCritical">
                {inlineFailureCopy.guidance}
              </SizableText>
              {isSendFailedTargetMismatch ? (
                <SizableText size="$bodyMd" color="$textCritical">
                  {/* copy pending product i18n keys */}
                  Switch back to the account you paid with to retry this
                  payment.
                </SizableText>
              ) : null}
            </YStack>
          ) : null}
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

export function PaymentOptionsModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <PaymentOptionsPage />
    </AccountSelectorProviderMirror>
  );
}
