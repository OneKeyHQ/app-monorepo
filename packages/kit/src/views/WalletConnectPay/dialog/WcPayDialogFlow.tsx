import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { DialogV2 } from '@onekeyhq/components/src/composite/DialogV2';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalWalletConnectPayRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
  IWcPayAmount,
  IWcPayConfirmResult,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
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

import {
  isWcPayPromptParkingEnabled,
  useWcPayPromptParking,
} from './useWcPayPromptParking';
import {
  WcPayConfirmingStep,
  WcPayDamagedStep,
  WcPayFetchFailedStep,
  WcPayFetchingStep,
  WcPayOptionsStep,
  WcPaySubmittedStep,
  WcPaySuccessStep,
  WcPayTerminalStep,
  WcPayUnsupportedStep,
} from './WcPayDialogScene';
import {
  closeWcPayDialog,
  hideWcPayDialog,
  openWcPayDialog,
  revealWcPayDialog,
  setWcPayDialogGuarded,
  useWcPayDialogState,
} from './wcPayDialogStore';
import { deriveWcPayDialogView } from './wcPayDialogView';

import type { IWcPaySceneBanner, IWcPaySceneOption } from './WcPayDialogScene';
import type {
  IWcPayConfirmingPhase,
  IWcPayInlineController,
  IWcPayInlineFailure,
  IWcPayInlineSigningSummary,
} from '../hooks/wcPayInlineUtils';
import type { IntlShape } from 'react-intl';

// Longest standard modal dismissal on iOS/Android (~350ms) plus slack.
const WC_PAY_MODAL_TRANSITION_MS = 500;
// Time for the system sheet to finish dismissing before an RN-layer modal is
// pushed over the same presenter (see parkWcPayDialogAndWait).
const WC_PAY_SHEET_DISMISS_MS = 450;

// stable fallback so render never fabricates a fresh array identity
const EMPTY_OPTIONS: IWcPayOption[] = [];
const EMPTY_SIGNATURES: string[] = [];

/**
 * What the flow is doing right now. Ported unchanged from
 * PaymentOptionsModal — see the phase contract there. `result` is TERMINAL:
 * it is only ever entered once signatures exist, its polling keeps
 * re-submitting confirmPayment, and returning to a payable state from it
 * could pay a second time.
 */
type IWcPayPagePhase =
  | { name: 'idle' }
  // Shared with the scene's own prop type, so the two cannot drift.
  | { name: 'paying'; step: IWcPayConfirmingPhase }
  | {
      name: 'result';
      params: {
        paymentId: string;
        optionId: string;
        signatures: string[];
        initialResult: IWcPayConfirmResult;
      };
    };

// Placeholder identity for the result poller while the flow is not in its
// result phase. The hook is disabled then — nothing is requested — and resets
// itself from the real `initialResult` once the identity changes.
const WC_PAY_IDLE_RESULT: IWcPayConfirmResult = {
  status: EWcPayStatus.Processing,
  isFinal: false,
};

/**
 * Banner-surfaced failure plus the identity of the attempt that produced it.
 * The identity matters for the post-sign kind: its Retry must re-enter the
 * recovery machinery for the SAME payment option and account (see the
 * SendFailed lock in PaymentOptionsModal).
 */
interface IWcPayInlineFailureRecord {
  failure: IWcPayInlineFailure;
  optionId: string;
  accountKey: string;
}

/**
 * Kind-derived banner copy — the ONLY failure text rendered;
 * `failure.message` is a diagnostic, never shown (see PaymentOptionsModal).
 */
function getWcPayInlineFailureCopy(
  failure: IWcPayInlineFailure,
  intl: IntlShape,
): {
  guidance: string;
  offersPageRetry: boolean;
} {
  if (failure.kind === EWcPayInlineFailureKind.InsufficientBalance) {
    return {
      guidance: intl.formatMessage({
        id: ETranslations.wc_pay_insufficient_balance_pick_another__msg,
      }),
      offersPageRetry: false,
    };
  }
  return {
    guidance: intl.formatMessage({
      id: ETranslations.wc_pay_send_failed_retry_resume__msg,
    }),
    offersPageRetry: true,
  };
}

// The default `key` every OneKeyError carries before a real one is assigned.
const ONEKEY_ERROR_DEFAULT_KEY = 'onekey_error';

/**
 * Banner text for a failure that ended an attempt. A coded WalletConnect Pay
 * verdict (or any OneKeyError carrying a real i18n key) renders its
 * localized copy; an error without one keeps its own message, as the routed
 * page's toast did; and the generic line covers an error with neither.
 */
function resolveWcPayFailureText(error: unknown, intl: IntlShape): string {
  const { key, info, message } =
    (error as
      | { key?: string; info?: Record<string, unknown>; message?: string }
      | undefined) ?? {};
  if (key && key !== ONEKEY_ERROR_DEFAULT_KEY) {
    return intl.formatMessage(
      { id: key as ETranslations },
      info as Record<string, string> | undefined,
    );
  }
  return (
    message ||
    intl.formatMessage({ id: ETranslations.wc_pay_generic_failure__msg })
  );
}

// option.account is CAIP-10 ("namespace:reference:address"); its chain part
// maps to a wallet networkId so icons/names can be resolved locally instead
// of relying on the server-provided (often missing) icon urls
function getWcPayOptionNetworkId(option: IWcPayOption): string | undefined {
  const [namespace, reference] = option.account.split(':');
  return wcPayChainIdToNetworkId(`${namespace}:${reference}`) ?? undefined;
}

// External accounts broadcast inside their connected wallet during the
// "signing" step, so the duplicate-payment boundary cannot cover them;
// watch-only accounts cannot sign at all (see PaymentOptionsModal).
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

function formatPayAmountParts(amount: IWcPayAmount): {
  amount: string;
  token: string;
} {
  return {
    amount: new BigNumber(amount.value)
      .shiftedBy(-amount.display.decimals)
      .toFixed(),
    token: amount.display.assetSymbol,
  };
}

function formatPayAmount(amount: IWcPayAmount): string {
  const { amount: value, token } = formatPayAmountParts(amount);
  return `${value} ${token}`;
}

// Q6: the countdown is not displayed anymore; only the local expiry signal
// survives, feeding the expired terminal and the payment-actionable gate.
function useIsExpiredLocally(expiryMs: number | undefined) {
  const [isExpiredLocally, setIsExpiredLocally] = useState(false);
  useEffect(() => {
    if (!expiryMs) {
      setIsExpiredLocally(false);
      return undefined;
    }
    const tick = () => {
      setIsExpiredLocally(expiryMs - Date.now() <= 0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiryMs]);
  return isExpiredLocally;
}

interface IWcPayDamagedContext {
  paymentId: string;
  optionId: string;
  accountKey: string;
}

function WcPayDialogFlowInner({ paymentLink }: { paymentLink: string }) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { executeActions } = useWcPayActionExecutor();
  const dialogState = useWcPayDialogState();
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pagePhase, setPagePhase] = useState<IWcPayPagePhase>({ name: 'idle' });
  // What the headless signature in flight commits to, as proven by the
  // consistency validator. Reported by the executor right before it enters
  // the `signingMessage` phase, which is the only phase that renders it.
  const [signingSummary, setSigningSummary] = useState<
    IWcPayInlineSigningSummary | undefined
  >(undefined);
  // failures the dialog keeps on screen (persistent banner) instead of
  // toasting: an insufficient balance the user resolves by switching option,
  // and a post-sign send failure whose retry must re-enter the recovery
  // machinery
  const [inlineFailure, setInlineFailure] =
    useState<IWcPayInlineFailureRecord>();
  // generic pre-sign failures that used to be toasts on the routed page; a
  // toast under the iOS system sheet is invisible, so they render through
  // the banner slot instead. Holds the message the toast would have shown.
  const [genericFailure, setGenericFailure] = useState<string | undefined>();
  // deterministically corrupt stored progress: rendered as a dedicated
  // in-dialog step instead of the page's Dialog.show (an RN-layer dialog
  // would sit under the iOS system sheet)
  const [damagedContext, setDamagedContext] = useState<IWcPayDamagedContext>();
  const [damagedDiscardLoading, setDamagedDiscardLoading] = useState(false);
  const [damagedDiscardFailed, setDamagedDiscardFailed] = useState(false);
  // A pushed RN-layer page (the compliance form route, or a confirm modal)
  // owns the screen while the sheet is parked for it. State, not a ref: the
  // prompt parking below has to react to it. See useWcPayPromptParking.
  const [isSubFlowOwningScreen, setIsSubFlowOwningScreen] = useState(false);

  // Pre-sign cancellation for the attempt in flight. Aborted when this flow
  // unmounts (the container unmounts it on close), preserving the page's
  // contract: closing during the pre-sign stretch cancels the attempt; once
  // an action has broadcast, the executor stops aborting on it. See
  // PaymentOptionsModal for the full rationale.
  const payCancelControllerRef = useRef<AbortController | undefined>(undefined);
  // Synchronous re-entry latch. `isPaying` is React state and only lands on
  // the next render; this ref closes the same-task window a second caller
  // could otherwise use before that render commits.
  const payInFlightRef = useRef(false);
  // The host sheet is a system presentation (SwiftUI sheet on iOS). Presenting
  // it again while the RN-layer confirm modal is still animating out attaches
  // the sheet to a controller that is being torn down: it stays visible but
  // never receives touches (Retry/Done dead on device). Reveal only after the
  // modal's dismissal transition has had time to finish; park cancels any
  // pending reveal so a follow-up confirm never races a stale timer.
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const clearPendingReveal = useCallback(() => {
    if (revealTimerRef.current !== undefined) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = undefined;
    }
  }, []);
  const parkWcPayDialog = useCallback(() => {
    clearPendingReveal();
    hideWcPayDialog();
  }, [clearPendingReveal]);
  // Park and wait for the sheet's dismissal transition: a modal pushed while
  // the sheet is still presented lands under it (or gets torn down with it),
  // leaving the flow waiting on a confirm page the user can never see.
  const parkWcPayDialogAndWait = useCallback(async () => {
    parkWcPayDialog();
    await timerUtils.wait(WC_PAY_SHEET_DISMISS_MS);
  }, [parkWcPayDialog]);
  const revealWcPayDialogAfterTransition = useCallback(() => {
    clearPendingReveal();
    revealTimerRef.current = setTimeout(() => {
      revealTimerRef.current = undefined;
      revealWcPayDialog();
    }, WC_PAY_MODAL_TRANSITION_MS);
  }, [clearPendingReveal]);
  useEffect(
    () => () => {
      payCancelControllerRef.current?.abort();
    },
    [],
  );
  // The password prompt and the hardware dialogs/toasts are RN-layer surfaces
  // the system sheet covers on native: park it while one is up, reveal it
  // when it clears (web/desktop already paint those above the DialogV2 popup,
  // so the rule is native-only — see isWcPayPromptParkingEnabled). Reveal
  // ownership is split — this hook only undoes its OWN park, and only while
  // no sub-flow owns the screen: revealing after a confirm page belongs to
  // onAfterConfirmModalSettled (the sheet would otherwise pop up over a
  // confirm page that is still open, since the page's own password prompt
  // clears while the page stays), and the terminal reveal on every exit path
  // belongs to handlePay's finally.
  useWcPayPromptParking({
    enabled: isWcPayPromptParkingEnabled({
      // platformEnv flags are optional booleans; narrow at the boundary so
      // the rule itself stays a plain boolean predicate
      isNative: Boolean(platformEnv.isNative),
      pagePhaseName: pagePhase.name,
      isSubFlowOwningScreen,
    }),
    park: parkWcPayDialog,
    reveal: revealWcPayDialogAfterTransition,
  });

  // Mounted unconditionally (hooks order); idle until the result phase.
  const resultParams =
    pagePhase.name === 'result' ? pagePhase.params : undefined;
  const { result: pollResult, pollExhausted } = useWcPayResultPolling({
    paymentId: resultParams?.paymentId ?? '',
    optionId: resultParams?.optionId ?? '',
    signatures: resultParams?.signatures ?? EMPTY_SIGNATURES,
    initialResult: resultParams?.initialResult ?? WC_PAY_IDLE_RESULT,
    enabled: Boolean(resultParams),
  });

  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;
  const isUnsupportedAccountType = isWcPayUnsupportedAccountType({
    accountId,
    indexedAccountId,
  });

  // a pre-sign banner reports one account's attempt; switching account makes
  // it stale. The post-sign banner survives account switches on purpose —
  // see PaymentOptionsModal.
  useEffect(() => {
    setInlineFailure((prev) =>
      prev?.failure.kind === EWcPayInlineFailureKind.SendFailed
        ? prev
        : undefined,
    );
    setGenericFailure(undefined);
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
      // don't fetch options for account types the flow refuses anyway
      if (isWcPayUnsupportedAccountType({ accountId, indexedAccountId })) {
        return undefined;
      }
      // usePromiseResult swallows rejections; track failures explicitly to
      // render an error state instead of an endless spinner
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
      // survive into the loading window (see PaymentOptionsModal)
      undefinedResultIfReRun: true,
    },
  );

  const payResult = result?.pay;
  const networkMap = result?.networkMap;
  const supportsDurableProgress = result?.supportsDurableProgress ?? false;
  const options = payResult?.options ?? EMPTY_OPTIONS;
  // Deterministic pre-form gate — see PaymentOptionsModal for why
  // option.actions cannot be trusted here.
  const areOptionsRefusedOnPlatform = shouldRefuseWcPayOptionUpfront({
    supportsDurableProgress,
  });
  // The post-sign failure state is terminal for the option/account choice.
  const isSendFailedLocked =
    inlineFailure?.failure.kind === EWcPayInlineFailureKind.SendFailed;
  // While SendFailed-locked the selection is PINNED to the attempt that
  // failed (see PaymentOptionsModal for the drift rationale).
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
  // The effective deadline is the earliest of the payment-level and the
  // selected option's expiry; every gate below uses this single value.
  const effectiveExpiryMs = getWcPayEffectiveExpiryMs({
    infoExpiresAt: payResult?.info?.expiresAt,
    optionExpiresAt: selectedOption?.expiresAt,
  });
  const isExpiredLocally = useIsExpiredLocally(effectiveExpiryMs);
  const payStatus = payResult?.info?.status;
  // Positive gate: only a server-reported requires_action status may enter
  // the payment executor (see PaymentOptionsModal).
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
      // the result phase is terminal: a second run could pay twice
      pagePhase.name === 'result'
    ) {
      return;
    }
    // A post-sign failure pins the payment to the attempt that produced it
    // (see PaymentOptionsModal); a differently-targeted attempt must not
    // start.
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
    setSigningSummary(undefined);
    setGenericFailure(undefined);
    setPagePhase({ name: 'paying', step: 'preparing' });
    // one cancel scope per attempt; aborted by the unmount cleanup above
    const cancelController = new AbortController();
    payCancelControllerRef.current = cancelController;
    try {
      const { paymentId } = payResult;
      const optionId = selectedOption.id;

      // Refuse before the compliance form whenever durable progress is
      // unavailable (see PaymentOptionsModal).
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
      const collectData = selectedOption.collectData ?? payResult.collectData;
      if (collectData) {
        if (!collectData.url) {
          throw new WcPayError({
            code: EWcPayErrorCode.DataCollectionUnavailable,
            message: 'WalletConnect Pay data collection form is unavailable',
          });
        }
        // the form URL comes from the server response; never load an
        // untrusted host into the webview/iframe presented as WC Pay
        if (!isWcPayTrustedUrl(collectData.url)) {
          throw new WcPayError({
            code: EWcPayErrorCode.DataCollectionUntrusted,
            message: 'Untrusted WalletConnect Pay data collection URL',
          });
        }
        // The form is a full-screen route (Q10): the dialog parks while the
        // form owns the screen and returns when it settles either way.
        setIsSubFlowOwningScreen(true);
        await parkWcPayDialogAndWait();
        try {
          await new Promise<void>((resolve, reject) => {
            navigation.pushModal(EModalRoutes.WalletConnectPayModal, {
              screen: EModalWalletConnectPayRoutes.DataCollection,
              params: {
                collectData,
                onComplete: () => resolve(),
                onError: (error: string) => reject(new OneKeyLocalError(error)),
                onCancel: () =>
                  reject(new WcPayUserCancelledError('User canceled payment')),
              },
            });
          });
        } finally {
          setIsSubFlowOwningScreen(false);
          revealWcPayDialogAfterTransition();
        }
      }

      // the compliance form (and any hesitation before it) may outlive the
      // payment deadline; never fetch/execute actions for an expired payment
      if (isWcPayExpired(effectiveExpiryMs)) {
        // surfaced through the expired terminal via isExpiredLocally
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
      // (see PaymentOptionsModal for the resume contract).
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
      // The inline path's observer/decider — verdicts as on the page, plus
      // the dialog visibility choreography around the confirm-modal
      // fallback.
      const inlineController: IWcPayInlineController = {
        onPhase: (step) => setPagePhase({ name: 'paying', step }),
        // Always reported before the matching `signingMessage` phase, so the
        // sheet never labels a signature with the previous action's payload.
        onSigningSummary: (summary) => setSigningSummary(summary),
        // Parks the dialog before EVERY confirm modal the executor pushes —
        // the inline fallback as well as the typed-data/personal-sign/Solana
        // branches and later actions of a multi-action sequence, none of
        // which enter the inline attempts loop. The pushed RN-layer confirm
        // page would otherwise sit under this system-level sheet while the
        // paying phase keeps it non-dismissible — an unrecoverable deadlock.
        // Paired with onAfterConfirmModalSettled below; both calls are
        // idempotent.
        onBeforePushConfirmModal: async () => {
          setIsSubFlowOwningScreen(true);
          await parkWcPayDialogAndWait();
        },
        // Reveals the dialog the moment a confirm modal settles, so the
        // paying progress owns the screen through the between-action waits
        // (Permit2's mined-wait between the approve confirm and the
        // follow-up typed-data confirm can run for minutes; a parked dialog
        // there means minutes of blank screen with the entry guard silently
        // refusing new scans). The next confirm parks it again via
        // onBeforePushConfirmModal; handlePay's finally stays as the
        // terminal reveal on every exit path.
        onAfterConfirmModalSettled: () => {
          setIsSubFlowOwningScreen(false);
          revealWcPayDialogAfterTransition();
        },
        // Single owner of the transition out of inline execution. The dialog
        // parks so the pushed confirm modal owns the screen (it would sit
        // under the iOS system sheet otherwise); handlePay's finally reveals
        // it again.
        // Every park is paired with the flag, here as everywhere: a confirm
        // modal follows this park, and relying on onBeforePushConfirmModal
        // (a few statements later) to raise the flag would make the pairing
        // an ordering accident. Cleared by onAfterConfirmModalSettled and, on
        // any exit path, by handlePay's finally.
        onFallback: () => {
          setIsSubFlowOwningScreen(true);
          parkWcPayDialog();
          setPagePhase({ name: 'paying', step: 'preparing' });
        },
        onInlineFailure: (failure) => {
          if (failure.kind === EWcPayInlineFailureKind.FeeEstimateFailed) {
            return Promise.resolve('retry');
          }
          if (failure.kind === EWcPayInlineFailureKind.WalletNotBackedUp) {
            // the backup dialog is an RN-layer dialog and owns the next
            // step; close the sheet entirely so it is visible (the flow is
            // over anyway — the verdict below aborts)
            closeWcPayDialog();
            return Promise.resolve('abort');
          }
          if (failure.kind === EWcPayInlineFailureKind.InsufficientBalance) {
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
        // pre-sign cancellation boundary — see PaymentOptionsModal
        cancelSignal: cancelController.signal,
        option: selectedOption,
        inlineController,
        progressContext: {
          paymentId,
          optionId,
          accountKey: progressAccountKey,
        },
        // absolute deadline checked before every action and enforced before
        // any broadcast; it never moves during the flow
        expiryMs: effectiveExpiryMs,
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
      // stopped-after-broadcast exit: do NOT submit a known-partial
      // signature set (see PaymentOptionsModal — every produced result is
      // already durably persisted; the next entry resumes).
      if (signatures.length < actions.length) {
        return;
      }

      // 4. submit and show result. A confirmPayment failure must NOT drop
      // the signatures back on the options step (see PaymentOptionsModal).
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
      // the flow must never leave this phase again
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
        // so this must not vanish — the banner's Retry re-enters the
        // durable-progress recovery machinery (see PaymentOptionsModal)
        console.error('wcPay inline post-sign failure', error);
        setInlineFailure({
          failure: classifyWcPayInlineFailure({ stage: 'send', error }),
          optionId: selectedOption.id,
          accountKey: indexedAccountId ?? accountId ?? '',
        });
      } else if (isWcPayErrorCode(error, EWcPayErrorCode.ProgressDamaged)) {
        // Deterministically corrupt stored progress: surfaced as a dedicated
        // in-dialog step with a user-confirmed discard (see
        // PaymentOptionsModal for the content-verdict-only contract).
        // Never from a dead flow: the fetches above can outlive a close.
        if (cancelController.signal.aborted) {
          return;
        }
        setDamagedDiscardFailed(false);
        setDamagedContext({
          paymentId: payResult.paymentId,
          optionId: selectedOption.id,
          accountKey: indexedAccountId ?? accountId ?? '',
        });
      } else if (!(error instanceof WcPayUserCancelledError)) {
        // user-intent cancellation ends the flow silently; local expiry is
        // rendered by the expired terminal (isExpiredLocally), everything
        // else lands in the generic banner — a toast would be invisible
        // under the iOS system sheet
        if (!isWcPayErrorCode(error, EWcPayErrorCode.PaymentExpired)) {
          console.error('wcPay flow failure', error);
          setGenericFailure(resolveWcPayFailureText(error, intl));
        }
      }
    } finally {
      payInFlightRef.current = false;
      if (payCancelControllerRef.current === cancelController) {
        payCancelControllerRef.current = undefined;
      }
      setIsPaying(false);
      // no sub-flow can outlive the attempt that pushed it; releasing the
      // flag here keeps a stuck `true` from disabling the prompt parking for
      // every later attempt
      setIsSubFlowOwningScreen(false);
      // the dialog may still be parked behind a sub-flow exit path
      revealWcPayDialogAfterTransition();
      // Reduced through the updater rather than the captured `pagePhase`,
      // which is stale inside this closure.
      setPagePhase(nextWcPayPagePhaseAfterAttempt);
      // A summary describes one signature of one attempt; it must never
      // outlive it, whichever way the attempt ended.
      setSigningSummary(undefined);
    }
  }, [
    payResult,
    selectedOption,
    isPaying,
    isLoading,
    isPaymentActionable,
    pagePhase.name,
    parkWcPayDialog,
    parkWcPayDialogAndWait,
    revealWcPayDialogAfterTransition,
    inlineFailure,
    effectiveExpiryMs,
    navigation,
    executeActions,
    accountId,
    indexedAccountId,
    intl,
  ]);

  const handleDamagedDiscard = useCallback(async () => {
    if (!damagedContext || damagedDiscardLoading) {
      return;
    }
    setDamagedDiscardLoading(true);
    try {
      await backgroundApiProxy.serviceWalletConnectPay.discardActionResultsFrom(
        {
          paymentId: damagedContext.paymentId,
          optionId: damagedContext.optionId,
          accountKey: damagedContext.accountKey,
          fromIndex: 0,
        },
      );
      setDamagedContext(undefined);
      setDamagedDiscardFailed(false);
    } catch (discardError) {
      // a failed discard must not vanish silently: the record is untouched
      // and the step says so (see PaymentOptionsModal's failed-discard path)
      console.error('wcPay discard damaged progress failed', discardError);
      setDamagedDiscardFailed(true);
    } finally {
      setDamagedDiscardLoading(false);
    }
  }, [damagedContext, damagedDiscardLoading]);

  const inlineFailureCopy = inlineFailure
    ? getWcPayInlineFailureCopy(inlineFailure.failure, intl)
    : undefined;
  // With the selection pinned, the only drift left is the signing account —
  // plus a pinned option missing from the current account's list (see
  // PaymentOptionsModal).
  const isSendFailedTargetMismatch =
    isSendFailedLocked &&
    !!inlineFailure &&
    (selectedOption?.id !== inlineFailure.optionId ||
      (indexedAccountId ?? accountId ?? '') !== inlineFailure.accountKey);

  const view = deriveWcPayDialogView({
    isLoading: Boolean(isLoading),
    loadError,
    hasPayResult: Boolean(payResult),
    isUnsupportedAccountType,
    areOptionsRefusedOnPlatform,
    optionsCount: options.length,
    payStatus,
    isExpiredLocally,
    hasDamagedProgress: Boolean(damagedContext),
    pagePhaseName: pagePhase.name,
    pollStatus: resultParams ? pollResult.status : undefined,
    pollIsFinal: resultParams ? pollResult.isFinal : false,
    pollExhausted,
  });

  // Entry-guard sync: while this view is non-dismissible, a new pay link
  // must not remount the flow (see wcPayDialogStore.openWcPayDialog). The
  // unmount cleanup releases the guard so a closed flow never blocks entry.
  useEffect(() => {
    setWcPayDialogGuarded(!view.dismissible);
  }, [view.dismissible]);
  useEffect(
    () => () => {
      setWcPayDialogGuarded(false);
      clearPendingReveal();
    },
    [clearPendingReveal],
  );

  const handleClose = useCallback(() => {
    closeWcPayDialog();
  }, []);
  const handleRetryFetch = useCallback(() => {
    void run();
  }, [run]);
  // A terminal Retry restarts the whole flow from fetch by re-opening the
  // dialog: the instanceId bump remounts this component, and the server's
  // payment status (positive RequiresAction gate) decides what is still
  // payable — the terminal result phase itself is never mutated.
  const handleTerminalRetry = useCallback(() => {
    openWcPayDialog({ paymentLink });
  }, [paymentLink]);
  const handleSelectOption = useCallback(
    (id: string) => {
      // Updaters must stay pure (StrictMode double-invokes them), so the
      // banner-clearing side effects live outside the setState call.
      if (id !== selectedOptionId) {
        // the (pre-sign) banner reports the previously selected option's
        // attempt and no longer applies
        setInlineFailure((prevFailure) =>
          prevFailure?.failure.kind === EWcPayInlineFailureKind.SendFailed
            ? prevFailure
            : undefined,
        );
        setGenericFailure(undefined);
      }
      setSelectedOptionId(id);
    },
    [selectedOptionId],
  );
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      // belt to the shell's own locks: a dismiss gesture only closes the
      // flow when the current view says it may
      if (!nextOpen && view.dismissible) {
        closeWcPayDialog();
      }
    },
    [view.dismissible],
  );

  const sceneOptions: IWcPaySceneOption[] = options.map((option) => {
    const { display } = option.amount;
    const networkId = getWcPayOptionNetworkId(option);
    const network = networkId ? networkMap?.[networkId] : undefined;
    // native-coin options often ship without iconUrl; the local network
    // logo is the canonical icon for them
    return {
      id: option.id,
      primaryText: formatPayAmount(option.amount),
      secondaryText: network?.name ?? display.networkName ?? '',
      tokenImageUri: display.iconUrl || network?.logoURI,
      networkImageUri: network?.logoURI ?? display.networkIconUrl,
    };
  });

  let banner: IWcPaySceneBanner | undefined;
  if (inlineFailureCopy) {
    banner = {
      guidance: inlineFailureCopy.guidance,
      mismatchHint: isSendFailedTargetMismatch
        ? intl.formatMessage({
            id: ETranslations.wc_pay_switch_back_to_paying_account__msg,
          })
        : undefined,
    };
  } else if (genericFailure) {
    banner = {
      guidance: genericFailure,
      mismatchHint: undefined,
    };
  }

  const orderAmountText = payResult?.info?.amount
    ? formatPayAmount(payResult.info.amount)
    : '';
  const payAmountButtonText = payResult?.info?.amount
    ? intl.formatMessage(
        { id: ETranslations.prime_pay_amount__action },
        formatPayAmountParts(payResult.info.amount),
      )
    : intl.formatMessage({ id: ETranslations.global_pay });
  const merchantName = payResult?.info?.merchant?.name ?? '';
  const merchantText = merchantName
    ? intl.formatMessage(
        { id: ETranslations.wc_pay_to_merchant__label },
        { merchant: merchantName },
      )
    : '';

  let content: ReactNode = null;
  switch (view.step.name) {
    case 'fetching':
      content = <WcPayFetchingStep />;
      break;
    case 'fetchFailed':
      content = <WcPayFetchFailedStep onRetry={handleRetryFetch} />;
      break;
    case 'unsupported':
      content = <WcPayUnsupportedStep onClose={handleClose} />;
      break;
    case 'options':
      content = (
        <WcPayOptionsStep
          merchantIconUri={payResult?.info?.merchant?.iconUrl}
          amountText={orderAmountText}
          merchantText={merchantText}
          options={sceneOptions}
          selectedId={selectedOption?.id}
          onSelectOption={handleSelectOption}
          listDisabled={
            areOptionsRefusedOnPlatform || isPaying || isSendFailedLocked
          }
          banner={banner}
          empty={view.step.empty}
          payButtonText={
            inlineFailureCopy?.offersPageRetry
              ? intl.formatMessage({ id: ETranslations.global_retry })
              : payAmountButtonText
          }
          payDisabled={
            !isPaymentActionable ||
            !selectedOption ||
            isPaying ||
            Boolean(isLoading) ||
            // a post-sign Retry is only safe against the exact attempt the
            // failure came from
            isSendFailedTargetMismatch
          }
          payLoading={isPaying}
          onPay={() => {
            void handlePay();
          }}
          onClose={handleClose}
        />
      );
      break;
    case 'confirming':
      content = (
        <WcPayConfirmingStep
          phase={pagePhase.name === 'paying' ? pagePhase.step : undefined}
          amountText={
            selectedOption
              ? formatPayAmount(selectedOption.amount)
              : orderAmountText
          }
          signingSummary={signingSummary}
        />
      );
      break;
    case 'damaged':
      content = (
        <WcPayDamagedStep
          onDiscard={() => {
            void handleDamagedDiscard();
          }}
          onClose={handleClose}
          discardLoading={damagedDiscardLoading}
          discardFailed={damagedDiscardFailed}
        />
      );
      break;
    case 'submitted':
      content = (
        <WcPaySubmittedStep
          canClose={view.step.canClose}
          onDone={handleClose}
        />
      );
      break;
    case 'success':
      content = (
        <WcPaySuccessStep
          amountText={orderAmountText}
          merchantText={merchantText}
          onDone={handleClose}
        />
      );
      break;
    case 'terminal':
      content = (
        <WcPayTerminalStep
          reason={view.step.reason}
          onRetry={handleTerminalRetry}
          onClose={handleClose}
        />
      );
      break;
    default:
      break;
  }

  return (
    <DialogV2
      open={!dialogState.isHidden}
      onOpenChange={handleOpenChange}
      dismissible={view.dismissible}
    >
      {content}
    </DialogV2>
  );
}

export default function WcPayDialogFlow({
  paymentLink,
}: {
  paymentLink: string;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <WcPayDialogFlowInner paymentLink={paymentLink} />
    </AccountSelectorProviderMirror>
  );
}
