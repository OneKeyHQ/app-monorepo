import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  YStack,
  usePreventRemove,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBatchTxSignAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { BTC_TX_PLACEHOLDER_VSIZE } from '@onekeyhq/shared/src/consts/chainConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalSignatureConfirmRoutes,
  type IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EBatchTxSignItemStatus,
  EBatchTxSignStatus,
} from '@onekeyhq/shared/types/batchTxSign';
import type {
  IBatchTxSignItemSummary,
  IBatchTxSignProgress,
} from '@onekeyhq/shared/types/batchTxSign';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  DAppSiteMark,
  shouldHideDAppSiteRiskStyle,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import {
  SecurityCheckCard,
  buildSecurityCheckModel,
} from '../../components/SecurityCheckCard';
import { SignatureConfirmTestIDs } from '../../testIDs';

import { BatchSigningProgress, SummaryRow, TransactionRow } from './components';
import {
  MINUS_SIGN,
  computeSignExitGate,
  formatRecipientLine,
  normalizeNativePrice,
} from './utils';

import type { RouteProp } from '@react-navigation/core';
import type { NavigationAction } from '@react-navigation/routers';

function BatchTxConfirm() {
  const route =
    useRoute<
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.BatchTxConfirm
      >
    >();
  const { batchId, accountId, networkId, sourceInfo } = route.params;
  const navigation = useAppNavigation();
  const intl = useIntl();
  const batchPageTitle = intl.formatMessage({
    id: ETranslations.batch_psbt_signing__title,
  });

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const {
    urlSecurityInfo,
    showContinueOperate,
    continueOperate,
    setContinueOperate,
  } = useRiskDetection({
    origin: sourceInfo?.origin ?? '',
    // BTC signPsbts cannot arrive via WalletConnect today (no BTC namespace
    // in ProviderApiWalletConnect), so this is always undefined for now —
    // passed for parity with TxConfirm/MessageConfirm so a future WC BTC
    // route inherits the isScam/INVALID → High escalation instead of
    // silently dropping Reown's attestation.
    walletConnectVerifyContext: sourceInfo?.walletConnectVerifyContext,
  });
  // Full decision table lives in computeSignExitGate — including the
  // "risk query still pending" state that keeps every signing exit disabled
  // until checkUrlSecurity settles (it always does; failures fall back to
  // Unknown, so this cannot deadlock the page).
  const { isSignExitBlocked } = computeSignExitGate({
    origin: sourceInfo?.origin ?? '',
    urlSecurityInfo,
    showContinueOperate,
    continueOperate,
  });
  const securityCheckModel = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        origin: sourceInfo?.origin,
        urlSecurityInfo,
        isTransactionSecurityApplicable: false,
        intl,
      }),
    [intl, sourceInfo?.origin, urlSecurityInfo],
  );
  // Execution-time recheck for every signing exit: portal Dialogs (the
  // Sign-all confirmation) capture their onConfirm closure at open time and
  // outlive this page's re-renders, so the disabled state of the buttons
  // underneath cannot protect them — a High verdict landing after the
  // dialog opened must still block at confirm time.
  const isSignExitBlockedRef = useRef(isSignExitBlocked);
  isSignExitBlockedRef.current = isSignExitBlocked;

  const [settings] = useSettingsPersistAtom();
  const [atomProgress] = useBatchTxSignAtom();

  const [loadError, setLoadError] = useState(false);
  const { result: seededProgress } = usePromiseResult(async () => {
    try {
      return await backgroundApiProxy.serviceBatchTxSign.getBatchProgress({
        batchId,
      });
    } catch (_error) {
      setLoadError(true);
      return undefined;
    }
  }, [batchId]);

  // Guards against a redundant dappApprove.reject() firing for an
  // already-settled id (see handlePageClose below) from any close path that
  // does not flow through Page.FooterActions' `extra` flag — e.g. the
  // usePreventRemove guard's navigation.dispatch().
  const hasSettledRef = useRef(false);

  // Frozen while handleDone is closing the page: takeFinalizedResults clears
  // the shared atom as soon as it succeeds, and without this freeze the
  // component would re-render on the stale seeded snapshot (back to
  // Overview) for a frame before closePageStack actually unmounts the page.
  const [closingSnapshot, setClosingSnapshot] = useState<
    IBatchTxSignProgress | undefined
  >(undefined);

  // The atom is a single global slot shared by whatever batch is currently
  // in-flight — only trust it when it is actually describing THIS route's
  // batch. If another batch ever preempts the slot (a second dapp request
  // queued behind this still-open page), keep rendering the freshest
  // progress this page has seen instead of snapping back to the mount-time
  // seed — a stale seed could e.g. revive "Reject all" (no destructive
  // confirm) after items were already signed.
  const lastSeenProgressRef = useRef<IBatchTxSignProgress | undefined>(
    undefined,
  );
  useEffect(() => {
    if (atomProgress?.batchId === batchId) {
      lastSeenProgressRef.current = atomProgress;
    }
  }, [atomProgress, batchId]);
  const batch =
    closingSnapshot ??
    (atomProgress?.batchId === batchId
      ? atomProgress
      : (lastSeenProgressRef.current ?? seededProgress));

  const isHw = useMemo(
    () => accountUtils.isHwAccount({ accountId }),
    [accountId],
  );

  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
    // Fall back to undefined instead of rethrowing — decimals/symbol below
    // already default sanely, and an unguarded rethrow here would surface as
    // an unhandled rejection.
    { undefinedResultIfError: true },
  );
  const decimals = network?.decimals ?? 8;
  const symbol = network?.symbol ?? 'BTC';

  const { result: nativePrice } = usePromiseResult(
    async () => {
      const nativeTokenAddress =
        await backgroundApiProxy.serviceToken.getNativeTokenAddress({
          networkId,
        });
      const tokenResp =
        await backgroundApiProxy.serviceToken.fetchTokensDetails({
          networkId,
          accountId,
          contractList: [nativeTokenAddress],
        });
      // The API can deliver a no-price sentinel ('--' on signet, '0' on
      // testnet3) which is truthy and would flow into the fiat math as NaN;
      // normalize so only a finite positive price survives.
      return normalizeNativePrice(tokenResp?.[0]?.price);
    },
    [networkId, accountId],
    // An offline/failed price fetch degrades to "no fiat line" (formatFiat
    // already handles `nativePrice` being undefined); don't let it rethrow
    // as an unhandled rejection.
    { undefinedResultIfError: true },
  );

  const formatAmount = useCallback(
    (satoshiValue: string) =>
      `${numberFormat(
        new BigNumber(satoshiValue).shiftedBy(-decimals).toFixed(),
        { formatter: 'balance' },
      )} ${symbol}`,
    [decimals, symbol],
  );

  // Per-row outgoing amount: prefixed with MINUS_SIGN, except when the
  // amount is zero (only degenerate psbts whose displayed outputs carry no
  // value — "−0 BTC" would misleadingly read as negative). Pure self-transfer
  // psbts carry their owned-output total here, matching the single-psbt
  // confirm page.
  const formatOutgoingAmount = useCallback(
    (satoshiValue: string) => {
      const amountText = formatAmount(satoshiValue);
      return new BigNumber(satoshiValue).isZero()
        ? amountText
        : `${MINUS_SIGN}${amountText}`;
    },
    [formatAmount],
  );

  const formatFiat = useCallback(
    (satoshiValue: string) => {
      if (!nativePrice) {
        return undefined;
      }
      const fiatValue = new BigNumber(satoshiValue)
        .shiftedBy(-decimals)
        .multipliedBy(nativePrice);
      return numberFormat(fiatValue.toFixed(), {
        formatter: 'price',
        formatterOptions: { currency: settings.currencyInfo.symbol },
      });
    },
    [nativePrice, decimals, settings.currencyInfo.symbol],
  );

  // Memoized so a `batch` fallback to `[]` doesn't create a new array
  // reference on every render, which would otherwise defeat the useMemo
  // dependents below.
  const items = useMemo(() => batch?.items ?? [], [batch?.items]);
  const totalCount = batch?.totalCount ?? 0;
  const signedCount = batch?.signedCount ?? 0;
  const remainingCount = totalCount - signedCount;
  const hasSignedAny = signedCount > 0;

  // Sums externalAmountValue, not amountValue: a pure self-transfer row
  // displays its owned-outputs total as amountValue (matching the drill-down
  // confirm), but none of that value leaves the wallet, so only external
  // outgoing may contribute to "Total outgoing".
  const totalOutgoingSatoshi = useMemo(
    () =>
      items
        .reduce(
          (sum, item) => sum.plus(item.externalAmountValue),
          new BigNumber(0),
        )
        .toFixed(),
    [items],
  );
  const totalFeeSatoshi = useMemo(
    () =>
      items
        .reduce((sum, item) => sum.plus(item.feeValue), new BigNumber(0))
        .toFixed(),
    [items],
  );

  const isSigningNow = batch?.status === EBatchTxSignStatus.Signing;
  const isComplete = batch?.status === EBatchTxSignStatus.Complete;
  // Hardware shows per-item progress; software authorizes once and signs the
  // remaining queue in the background while staying on the overview screen.
  const showHwProgressStage = isHw && isSigningNow;

  const currentItem = useMemo(
    () =>
      batch?.currentIndex !== undefined
        ? items.find((item) => item.index === batch.currentIndex)
        : undefined,
    [items, batch?.currentIndex],
  );
  const currentRow = currentItem
    ? {
        title: intl.formatMessage(
          { id: ETranslations.batch_psbt_transaction_number__title },
          { number: currentItem.index + 1 },
        ),
        recipient: formatRecipientLine({
          recipient: currentItem.recipient,
          extraRecipientCount: currentItem.extraRecipientCount,
          intl,
        }),
        amountText: formatOutgoingAmount(currentItem.amountValue),
      }
    : undefined;

  // 1-based, for the "Signing transaction N of total" title. Prefer the
  // batch's real currentIndex — signedCount+1 breaks when items were
  // pre-signed out of order via drill-down (e.g. item 2 signed first would
  // make signedCount+1 point at item 2 while item 1 is actually signing).
  // currentIndex is briefly undefined right when signRemaining flips the
  // batch to Signing but hasn't set it for the first item yet — signedCount+1
  // is still correct in that narrow window since nothing is out of order.
  const currentTransactionNumber =
    batch?.currentIndex !== undefined
      ? batch.currentIndex + 1
      : Math.min(signedCount + 1, totalCount);

  const handlePageClose = useCallback(
    (extra?: { flag?: string }) => {
      // NOT a harmless no-op on a second call: ServicePromise removes a
      // settled callback via Array.splice, which reindexes its backing
      // array, so a stray reject() here after this id already settled could
      // reject a *different*, still-pending dapp request that shifted into
      // the freed slot. Skip when this id was already settled explicitly —
      // via the Confirmed flag (paths that close through Page.FooterActions)
      // or hasSettledRef (paths that close via navigation.dispatch(), which
      // carries no flag). Only fire on a genuine dismissal (back gesture / X
      // button) that never went through Done/Reject/Cancel.
      if (
        hasSettledRef.current ||
        extra?.flag === EDAppModalPageStatus.Confirmed
      ) {
        return;
      }
      dappApprove.reject();
    },
    [dappApprove],
  );

  useEffect(() => {
    // Mirrors TxConfirm: SendConfirmFromDApp/BatchTxConfirmFromDApp arm a
    // 5s reject timer around the navigation replace and only clear it once
    // this event fires, guarding against a dead-end if the replace lands on
    // a route that never mounts.
    appEventBus.emit(
      EAppEventBusNames.SignatureConfirmContainerMounted,
      undefined,
    );
  }, []);

  const handleRowPress = useCallback(
    async (item: IBatchTxSignItemSummary) => {
      if (isSignExitBlockedRef.current) {
        return;
      }
      try {
        const unsignedTx =
          await backgroundApiProxy.serviceBatchTxSign.getBatchItemUnsignedTx({
            batchId,
            index: item.index,
          });
        // Re-check after the await: the risk verdict may have landed while
        // the unsignedTx round-trip was in flight, and the drill-down
        // TxConfirm (no sourceInfo) can never show this origin's warning.
        if (isSignExitBlockedRef.current) {
          return;
        }
        // Backfill the top-level txSize the same way the legacy single-psbt
        // dapp flow gets it (BTC Vault._buildUnsignedTxFromEncodedTx, run by
        // serviceSend.prepareSendConfirmUnsignedTx via SendConfirmFromDApp).
        // This batch item's unsignedTx is built directly in
        // ProviderApiBtc._signPsbtsBatchFlow and never goes through that
        // pass, so it never gets a txSize. TxFeeInfo's feeUTXO branch
        // computes displayed fee as `feeRate * (txSize ?? 0)` — without
        // this, the drill-down shows "Est. network fee 0 BTC" even though
        // encodedTx.fee (used for signing) is correct. encodedTx.txSize is
        // always undefined and inputsForCoinSelect always empty for this
        // flow (see buildPsbtSignFlowPayload), so the vault's own fallback
        // always resolves to this same placeholder — replicate it exactly
        // so the fee shown here matches the legacy flow for the same psbt.
        const unsignedTxWithFeeDisplay = {
          ...unsignedTx,
          txSize: unsignedTx.txSize ?? BTC_TX_PLACEHOLDER_VSIZE,
        };
        const isSigned = item.status === EBatchTxSignItemStatus.Signed;
        navigation.push(EModalSignatureConfirmRoutes.TxConfirm, {
          accountId,
          networkId,
          unsignedTxs: [unsignedTxWithFeeDisplay],
          signOnly: true,
          feeInfoEditable: false,
          popStack: false,
          // The drill-down is pushed onto this batch page's stack, so its
          // cancel action reads "Back" and just pops back here.
          cancelAsBack: true,
          // An already-signed item opens as a review: no Sign action.
          readOnly: isSigned,
          // No sourceInfo: this drill-down must hand its result back to the
          // batch, never resolve the dapp request on its own.
          onSuccess: isSigned
            ? undefined
            : (data: ISendTxOnSuccessData[]) => {
                const hex = data?.[0]?.signedTx?.psbtHex;
                if (hex) {
                  // Only toast once the mark actually landed — a failed
                  // markItemSigned (e.g. the batch was disposed/cancelled
                  // meanwhile) must not claim the item is signed.
                  void backgroundApiProxy.serviceBatchTxSign
                    .markItemSigned({
                      batchId,
                      index: item.index,
                      signedPsbtHex: hex,
                    })
                    .then(() => {
                      Toast.success({
                        title: intl.formatMessage(
                          {
                            id: ETranslations.batch_psbt_transaction_signed__msg,
                          },
                          { number: item.index + 1 },
                        ),
                      });
                    })
                    .catch(() => {});
                }
              },
        });
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.batch_psbt_unable_to_open_transaction__msg,
          }),
        });
      }
    },
    [accountId, networkId, batchId, intl, navigation],
  );

  const startSigning = useCallback(() => {
    // Runs as a portal Dialog's onConfirm, which may fire long after the
    // risk verdict flipped to blocked (see isSignExitBlockedRef). The
    // dialog auto-closes on confirm, landing back on the page whose
    // SecurityCheckCard + disabled buttons explain the refusal.
    if (isSignExitBlockedRef.current) {
      return;
    }
    void backgroundApiProxy.serviceBatchTxSign
      // sourceInfo lets the background loop record each signature into the
      // signature history under the requesting dapp's origin, matching the
      // legacy per-psbt TxConfirm flow.
      .signRemaining({ batchId, sourceInfo })
      .catch((error: unknown) => {
        // signRemaining rejects for two very different reasons and only one
        // deserves this toast:
        //  - the batch is actually gone (ServiceBatchTxSign.requireBatch
        //    throws "batchTxSign: unknown batchId ..." — e.g. a stale
        //    window reopened against a disposed batch), which would
        //    otherwise leave the Sign button silently unresponsive.
        //  - a mid-queue item failed (e.g. device rejection): the batch is
        //    still alive, the item's Failed row + a re-enabled Sign
        //    remaining CTA already reflect it, and signTransaction's lower
        //    layer already toasted the real reason — showing this generic
        //    message on top would be misleading, so stay silent.
        const message = error instanceof Error ? error.message : '';
        if (message.includes('unknown batchId')) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.batch_psbt_request_no_longer_available__msg,
            }),
          });
        }
      });
  }, [batchId, intl, sourceInfo]);

  const showSigningNotice = useCallback(() => {
    Dialog.show({
      icon: isHw ? 'LaptopOutline' : 'WalletOutline',
      title:
        remainingCount === totalCount
          ? intl.formatMessage(
              { id: ETranslations.batch_psbt_sign_all_transactions__title },
              { count: remainingCount },
            )
          : intl.formatMessage(
              {
                id: ETranslations.batch_psbt_sign_remaining_transactions__title,
              },
              { count: remainingCount },
            ),
      description: isHw
        ? intl.formatMessage({
            id: ETranslations.batch_psbt_hardware_signing_notice__desc,
          })
        : intl.formatMessage(
            { id: ETranslations.batch_psbt_software_signing_notice__desc },
            { count: remainingCount },
          ),
      renderContent: (
        <XStack
          px="$4"
          py="$3"
          alignItems="center"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.batch_psbt_transactions__title,
            })}
          </SizableText>
          <SizableText size="$bodyMdMedium">{remainingCount}</SizableText>
        </XStack>
      ),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      onConfirmText: isHw
        ? intl.formatMessage({ id: ETranslations.global_continue })
        : intl.formatMessage({
            id: ETranslations.batch_psbt_sign_all__action,
          }),
      onConfirm: startSigning,
    });
  }, [intl, isHw, remainingCount, totalCount, startSigning]);

  const closeAndReject = useCallback(
    (closePageStack: () => void) => {
      hasSettledRef.current = true;
      dappApprove.reject();
      closePageStack();
    },
    [dappApprove],
  );

  const handleRejectAll = useCallback(
    (closePageStack: () => void) => {
      void backgroundApiProxy.serviceBatchTxSign
        .cancelBatch({ batchId })
        .catch(() => {});
      closeAndReject(closePageStack);
    },
    [batchId, closeAndReject],
  );

  // The confirmation dialogs below render into the full-window overlay
  // portal, outside this page's React tree — each header-close / back
  // attempt carries a fresh navigation action, so without this flag
  // repeated attempts would stack duplicate dialogs.
  const isCancelDialogShowingRef = useRef(false);

  // Shared destructive confirmation for throwing away already-collected
  // signatures — used by the footer "Cancel request" button and by the
  // prevent-remove guard below for header close / back dismissals.
  const showCancelRequestDialog = useCallback(
    (onConfirm: () => void) => {
      if (isCancelDialogShowingRef.current) {
        return;
      }
      isCancelDialogShowingRef.current = true;
      Dialog.show({
        tone: 'destructive',
        title: intl.formatMessage({
          id: ETranslations.batch_psbt_cancel_request__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.batch_psbt_discard_generated_signatures__desc,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.batch_psbt_cancel_request__action,
        }),
        onCancelText: intl.formatMessage({
          id: ETranslations.shortcut_go_back,
        }),
        onConfirm,
        onClose: () => {
          isCancelDialogShowingRef.current = false;
        },
      });
    },
    [intl],
  );

  const handleCancelRequest = useCallback(
    (closePageStack: () => void) => {
      showCancelRequestDialog(() => {
        void backgroundApiProxy.serviceBatchTxSign
          .cancelBatch({ batchId })
          .catch(() => {});
        closeAndReject(closePageStack);
      });
    },
    [batchId, closeAndReject, showCancelRequestDialog],
  );

  // Page.FooterActions does not await onConfirm or auto-disable the button
  // while it runs, and handleDone spans two bg round-trips — without this
  // guard a double-click would resolve the same dapp request id twice (see
  // the comment on handlePageClose for why a double settle is unsafe).
  const isDoneInFlightRef = useRef(false);
  const [isDoneLoading, setIsDoneLoading] = useState(false);
  const handleDone = useCallback(
    async (closePageStack: (extra?: { flag?: string }) => void) => {
      if (isDoneInFlightRef.current || hasSettledRef.current) {
        return;
      }
      if (isSignExitBlockedRef.current) {
        return;
      }
      isDoneInFlightRef.current = true;
      setIsDoneLoading(true);
      // Freeze the currently-rendered (Complete) stage so any atom change
      // while this closes never gets a chance to flash the page back to a
      // stale Overview for a frame.
      setClosingSnapshot(batch);
      try {
        const results =
          await backgroundApiProxy.serviceBatchTxSign.takeFinalizedResults({
            batchId,
          });
        // awaitAck: on split-runtime targets (mobile / ext side panel) the
        // default resolve fire-and-forgets its UI→bg RPC — this catch would
        // never see a bridge failure and the page would close with the dapp
        // callback still pending and the signatures unrecoverable. Awaiting
        // the ack routes that failure into the retry path below.
        await dappApprove.resolve({ result: results, awaitAck: true });
        // Mark this close as an already-resolved success so handlePageClose
        // does not fire a redundant reject() for the same (now-settled) id —
        // see the comment on handlePageClose for why that is unsafe.
        hasSettledRef.current = true;
        closePageStack({ flag: EDAppModalPageStatus.Confirmed });
      } catch (_error) {
        // Keep the page open on failure. The background keeps the batch —
        // and the signatures already collected — alive until the provider
        // disposes it, so retrying Done re-runs takeFinalizedResults against
        // the intact batch; Cancel request stays available as the fallback.
        setClosingSnapshot(undefined);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.batch_psbt_failed_to_collect_signatures__msg,
          }),
        });
      } finally {
        isDoneInFlightRef.current = false;
        setIsDoneLoading(false);
      }
    },
    [batch, batchId, dappApprove, intl],
  );

  const handlePreventRemove = useCallback(
    ({ data }: { data: { action: NavigationAction } }) => {
      // Done / footer Cancel / Reject settle the dapp request themselves and
      // then close via closePageStack while this guard is still armed — let
      // those removals through instead of stacking a second confirmation.
      if (hasSettledRef.current) {
        navigation.dispatch(data.action);
        return;
      }
      // Done is mid-settle (takeFinalizedResults + resolve span two bg
      // round-trips): swallow the dismissal instead of offering a cancel
      // dialog that could outlive the resolve — handleDone closes the page
      // itself once it finishes.
      if (isDoneInFlightRef.current) {
        return;
      }
      const cancelBatchAndReject = () => {
        // Re-check at confirm time: the dialog lives in the full-window
        // overlay portal and survives this page's unmount, so the request
        // may have settled (and the page closed) while it was open. A
        // second reject on a settled id can hit a different still-pending
        // request (see handlePageClose), and the captured action would be
        // dispatched against a route that no longer exists — so do nothing.
        if (hasSettledRef.current) {
          return;
        }
        void backgroundApiProxy.serviceBatchTxSign
          .cancelBatch({ batchId })
          .catch(() => {});
        hasSettledRef.current = true;
        dappApprove.reject();
        navigation.dispatch(data.action);
      };
      if (isSigningNow) {
        if (isCancelDialogShowingRef.current) {
          return;
        }
        isCancelDialogShowingRef.current = true;
        Dialog.show({
          tone: 'destructive',
          title: intl.formatMessage({
            id: ETranslations.batch_psbt_stop_signing_and_cancel_request__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.batch_psbt_discard_signatures_and_reject_request__desc,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.batch_psbt_stop_and_cancel__action,
          }),
          onCancelText: intl.formatMessage({
            id: ETranslations.batch_psbt_keep_signing__action,
          }),
          onConfirm: cancelBatchAndReject,
          onClose: () => {
            isCancelDialogShowingRef.current = false;
          },
        });
        return;
      }
      // Idle dismissal (header close / back gesture) with signatures already
      // collected: require the same discard confirmation as the footer
      // "Cancel request" button instead of rejecting silently.
      showCancelRequestDialog(cancelBatchAndReject);
    },
    [
      batchId,
      dappApprove,
      intl,
      isSigningNow,
      navigation,
      showCancelRequestDialog,
    ],
  );
  // Armed while actively signing AND whenever any signature has been
  // collected: dismissing this page discards collected signatures, so every
  // non-Done exit must go through an explicit destructive confirmation.
  usePreventRemove(isSigningNow || hasSignedAny, handlePreventRemove);

  // Shared by the overview and progress/complete footers so a flagged origin
  // requires the same explicit acknowledgement on every exit — including a
  // page remounted directly into the Complete stage, where continueOperate
  // state starts over.
  const riskAcknowledgement = showContinueOperate ? (
    <Stack pb="$5">
      <Checkbox
        testID={SignatureConfirmTestIDs.BatchTxConfirmRiskCheckbox}
        label={intl.formatMessage({
          id: ETranslations.dapp_connect_proceed_at_my_own_risk,
        })}
        value={continueOperate}
        onChange={(checked) => setContinueOperate(checked === true)}
      />
    </Stack>
  ) : null;

  if (loadError) {
    return (
      <Page onClose={handlePageClose}>
        <Page.Header title={batchPageTitle} />
        <Page.Body>
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            gap="$3"
            p="$5"
          >
            <Icon name="ErrorOutline" size="$10" color="$iconCritical" />
            <SizableText size="$headingLg" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.batch_psbt_unable_to_load_request__title,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.batch_psbt_request_no_longer_available__msg,
              })}
            </SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  if (!batch) {
    return (
      <Page onClose={handlePageClose}>
        <Page.Header title={batchPageTitle} />
        <Page.Body>
          <Stack flex={1} alignItems="center" justifyContent="center" py="$12">
            <Spinner size="large" />
          </Stack>
        </Page.Body>
      </Page>
    );
  }

  if (showHwProgressStage || isComplete) {
    return (
      <Page onClose={handlePageClose}>
        <Page.Header title={batchPageTitle} />
        <Page.Body px="$5">
          <BatchSigningProgress
            totalCount={totalCount}
            signedCount={signedCount}
            currentTransactionNumber={currentTransactionNumber}
            currentRow={currentRow}
          />
        </Page.Body>
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={
              isComplete
                ? intl.formatMessage({ id: ETranslations.global_done })
                : intl.formatMessage({
                    id: ETranslations.batch_psbt_waiting_for_signature__action,
                  })
            }
            confirmButtonProps={{
              // isSignExitBlocked gates EVERY path that hands signatures
              // back to the dapp — Sign all, per-row drill-down and this
              // Done — so a flagged (or not-yet-checked) origin cannot be
              // worked around by signing items one at a time or by reaching
              // the Complete stage without accepting the risk.
              disabled: !isComplete || isDoneLoading || isSignExitBlocked,
              loading: isDoneLoading,
            }}
            onConfirm={(_close, closePageStack) => {
              if (isComplete) {
                void handleDone(closePageStack);
              }
            }}
          >
            {riskAcknowledgement}
          </Page.FooterActions>
        </Page.Footer>
      </Page>
    );
  }

  return (
    <Page scrollEnabled onClose={handlePageClose}>
      <Page.Header title={batchPageTitle} />
      <Page.Body px="$5">
        <YStack width="100%" maxWidth={640} alignSelf="center" gap="$4" pb="$6">
          {sourceInfo?.origin ? (
            <DAppSiteMark
              origin={sourceInfo.origin}
              urlSecurityInfo={urlSecurityInfo}
              hideRiskStyle={shouldHideDAppSiteRiskStyle(urlSecurityInfo)}
            />
          ) : null}

          {/* hideRiskStyle above is only safe because this card carries the
              origin's risk finding (critical for High, warning for Medium) —
              the same split TxConfirm uses. */}
          {sourceInfo?.origin ? (
            <SecurityCheckCard model={securityCheckModel} />
          ) : null}

          <YStack bg="$bgSubdued" borderRadius="$3" overflow="hidden">
            <SummaryRow
              label={intl.formatMessage({
                id: ETranslations.batch_psbt_transactions__title,
              })}
              value={`${totalCount}`}
            />
            <Stack height={1} bg="$borderSubdued" />
            <SummaryRow
              label={intl.formatMessage({
                id: ETranslations.batch_psbt_total_outgoing__title,
              })}
              value={formatAmount(totalOutgoingSatoshi)}
            />
            <Stack height={1} bg="$borderSubdued" />
            <SummaryRow
              label={intl.formatMessage({
                id: ETranslations.batch_psbt_total_network_fee__title,
              })}
              value={formatAmount(totalFeeSatoshi)}
            />
          </YStack>

          <YStack gap="$2.5">
            <XStack alignItems="center">
              <SizableText flex={1} size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.batch_psbt_transactions__title,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage(
                  { id: ETranslations.batch_psbt_remaining_count__desc },
                  { count: remainingCount },
                )}
              </SizableText>
            </XStack>

            {/* Plain .map is fine: the provider rejects batches beyond its
                defensive cap (MAX_SIGN_PSBTS_COUNT, currently 100), so the
                row count is bounded — migrate to FlashList only if that cap
                is ever raised substantially. */}
            {items.map((item) => (
              <TransactionRow
                key={item.index}
                index={item.index}
                recipient={item.recipient}
                extraRecipientCount={item.extraRecipientCount}
                amountText={formatOutgoingAmount(item.amountValue)}
                fiatText={formatFiat(item.amountValue)}
                signed={item.status === EBatchTxSignItemStatus.Signed}
                failed={item.status === EBatchTxSignItemStatus.Failed}
                // isSignExitBlocked: the drill-down TxConfirm intentionally
                // gets no sourceInfo (so it can never resolve the dapp
                // request), which also means it can't show this origin's
                // risk warning — so per-item signing must be gated here,
                // alongside the Sign all and Done buttons, or a flagged site
                // could have every item signed one at a time with no warning
                // shown and no risk accepted.
                disabled={isSigningNow || isSignExitBlocked}
                onPress={() => void handleRowPress(item)}
              />
            ))}
          </YStack>
        </YStack>
      </Page.Body>

      <Page.Footer>
        <Page.FooterActions
          onConfirmText={
            remainingCount === totalCount
              ? intl.formatMessage(
                  { id: ETranslations.batch_psbt_sign_all_count__action },
                  { count: totalCount },
                )
              : intl.formatMessage(
                  { id: ETranslations.batch_psbt_sign_remaining__action },
                  { count: remainingCount },
                )
          }
          confirmButtonProps={{
            loading: isSigningNow,
            // Destructive styling mirrors TxConfirmActions' showTakeRiskAlert
            // treatment for flagged origins.
            variant: showContinueOperate ? 'destructive' : 'primary',
            disabled: isSigningNow || isSignExitBlocked || remainingCount === 0,
          }}
          onConfirm={showSigningNotice}
          onCancelText={
            hasSignedAny
              ? intl.formatMessage({
                  id: ETranslations.batch_psbt_cancel_request__action,
                })
              : intl.formatMessage({
                  id: ETranslations.batch_psbt_reject_all__action,
                })
          }
          cancelButtonProps={{ variant: 'secondary', disabled: isSigningNow }}
          onCancel={(_close, closePageStack) => {
            if (hasSignedAny) {
              handleCancelRequest(closePageStack);
            } else {
              handleRejectAll(closePageStack);
            }
          }}
        >
          {riskAcknowledgement}
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

export default BatchTxConfirm;
