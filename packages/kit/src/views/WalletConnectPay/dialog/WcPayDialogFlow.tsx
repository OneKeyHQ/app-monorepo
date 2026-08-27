import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { DialogV2 } from '@onekeyhq/components/src/composite/DialogV2';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalWalletConnectPayRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  WC_PAY_BROADCAST_UNSUPPORTED_MESSAGE,
  WC_PAY_PROGRESS_DAMAGED_MESSAGE,
  shouldRefuseWcPayOptionUpfront,
} from '@onekeyhq/shared/src/walletConnect/payBroadcastUtils';
import {
  isWcPayTrustedUrl,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
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
  useWcPayDialogState,
} from './wcPayDialogStore';
import { deriveWcPayDialogView } from './wcPayDialogView';

import type { IWcPaySceneBanner, IWcPaySceneOption } from './WcPayDialogScene';
import type {
  IWcPayInlineController,
  IWcPayInlineFailure,
  IWcPayInlinePhase,
} from '../hooks/wcPayInlineUtils';

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

function formatPayAmount(amount: IWcPayAmount): string {
  return `${new BigNumber(amount.value)
    .shiftedBy(-amount.display.decimals)
    .toFixed()} ${amount.display.assetSymbol}`;
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
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { executeActions } = useWcPayActionExecutor();
  const dialogState = useWcPayDialogState();
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pagePhase, setPagePhase] = useState<IWcPayPagePhase>({ name: 'idle' });
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

  // Pre-sign cancellation for the attempt in flight. Aborted when this flow
  // unmounts (the container unmounts it on close), preserving the page's
  // contract: closing during the pre-sign stretch cancels the attempt; once
  // an action has broadcast, the executor stops aborting on it. See
  // PaymentOptionsModal for the full rationale.
  const payCancelControllerRef = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      payCancelControllerRef.current?.abort();
    },
    [],
  );

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

  const { result, isLoading, run } = usePromiseResult(
    async () => {
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
        setLoadError(true);
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
    setIsPaying(true);
    // a new attempt supersedes whatever the previous one left on screen
    setInlineFailure(undefined);
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
        throw new OneKeyLocalError(WC_PAY_BROADCAST_UNSUPPORTED_MESSAGE);
      }

      // 1. compliance data collection must complete BEFORE fetching actions.
      const collectData = selectedOption.collectData ?? payResult.collectData;
      if (collectData) {
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
        // The form is a full-screen route (Q10): the dialog parks while the
        // form owns the screen and returns when it settles either way.
        hideWcPayDialog();
        try {
          await new Promise<void>((resolve, reject) => {
            navigation.pushModal(EModalRoutes.WalletConnectPayModal, {
              screen: EModalWalletConnectPayRoutes.DataCollection,
              params: {
                collectData,
                onComplete: () => resolve(),
                onError: (error: string) =>
                  reject(new OneKeyLocalError(error)),
                onCancel: () =>
                  reject(new WcPayUserCancelledError('User canceled payment')),
              },
            });
          });
        } finally {
          revealWcPayDialog();
        }
      }

      // the compliance form (and any hesitation before it) may outlive the
      // payment deadline; never fetch/execute actions for an expired payment
      if (isWcPayExpired(effectiveExpiryMs)) {
        // surfaced through the expired terminal via isExpiredLocally
        throw new OneKeyLocalError('This payment has expired');
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
        // Single owner of the transition out of inline execution. The dialog
        // parks so the pushed confirm modal owns the screen (it would sit
        // under the iOS system sheet otherwise); handlePay's finally reveals
        // it again.
        onFallback: () => {
          hideWcPayDialog();
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
      } else if (
        (error as Error | undefined)?.message ===
        WC_PAY_PROGRESS_DAMAGED_MESSAGE
      ) {
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
        const message = (error as Error | undefined)?.message;
        if (message !== 'This payment has expired') {
          console.error('wcPay flow failure', error);
          // parity with the page's toast: show the message when there is
          // one, a generic line otherwise
          setGenericFailure(
            message || 'Something went wrong. Please try again.',
          );
        }
      }
    } finally {
      if (payCancelControllerRef.current === cancelController) {
        payCancelControllerRef.current = undefined;
      }
      setIsPaying(false);
      // the dialog may still be parked behind a sub-flow exit path
      revealWcPayDialog();
      // Reduced through the updater rather than the captured `pagePhase`,
      // which is stale inside this closure.
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
    ? getWcPayInlineFailureCopy(inlineFailure.failure)
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
  const handleSelectOption = useCallback((id: string) => {
    setSelectedOptionId((prev) => {
      if (id !== prev) {
        // the (pre-sign) banner reports the previously selected option's
        // attempt and no longer applies
        setInlineFailure((prevFailure) =>
          prevFailure?.failure.kind === EWcPayInlineFailureKind.SendFailed
            ? prevFailure
            : undefined,
        );
        setGenericFailure(undefined);
      }
      return id;
    });
  }, []);
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
        ? // copy pending product i18n keys
          'Switch back to the account you paid with to retry this payment.'
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
  const merchantName = payResult?.info?.merchant?.name ?? '';

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
          merchantText={merchantName ? `to ${merchantName}` : ''}
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
              ? 'Retry'
              : `Pay ${orderAmountText}`
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
      content = <WcPayConfirmingStep />;
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
          merchantText={merchantName ? `to ${merchantName}` : ''}
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
