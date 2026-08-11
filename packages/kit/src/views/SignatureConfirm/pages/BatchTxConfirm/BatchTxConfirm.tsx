import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';

import {
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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  DAppSiteMark,
  shouldHideDAppSiteRiskStyle,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';

import {
  BatchSigningProgress,
  MINUS_SIGN,
  SummaryRow,
  TransactionRow,
  formatRecipientLine,
} from './components';

import type { RouteProp } from '@react-navigation/core';
import type { NavigationAction } from '@react-navigation/routers';

const BATCH_PAGE_TITLE = 'Batch PSBT Signing';

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

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { urlSecurityInfo } = useRiskDetection({
    origin: sourceInfo?.origin ?? '',
  });
  const isBlockingRisk = urlSecurityInfo?.level === EHostSecurityLevel.High;

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
  // batch, otherwise fall back to the direct seed snapshot.
  const batch =
    closingSnapshot ??
    (atomProgress?.batchId === batchId ? atomProgress : seededProgress);

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
      return tokenResp?.[0]?.price;
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
  // amount is zero — a pure consolidation psbt has no external outgoing
  // value, and "−0 BTC" would misleadingly read as negative.
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

  const totalOutgoingSatoshi = useMemo(
    () =>
      items
        .reduce((sum, item) => sum.plus(item.amountValue), new BigNumber(0))
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
        title: `Transaction ${currentItem.index + 1}`,
        recipient: formatRecipientLine({
          recipient: currentItem.recipient,
          extraRecipientCount: currentItem.extraRecipientCount,
        }),
        amountText: formatOutgoingAmount(currentItem.amountValue),
      }
    : undefined;

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
      try {
        const unsignedTx =
          await backgroundApiProxy.serviceBatchTxSign.getBatchItemUnsignedTx({
            batchId,
            index: item.index,
          });
        navigation.push(EModalSignatureConfirmRoutes.TxConfirm, {
          accountId,
          networkId,
          unsignedTxs: [unsignedTx],
          signOnly: true,
          feeInfoEditable: false,
          popStack: false,
          // No sourceInfo: this drill-down must hand its result back to the
          // batch, never resolve the dapp request on its own.
          onSuccess: (data: ISendTxOnSuccessData[]) => {
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
                    title: `Transaction ${item.index + 1} signed`,
                  });
                })
                .catch(() => {});
            }
          },
        });
      } catch (_error) {
        Toast.error({ title: 'Unable to open this transaction' });
      }
    },
    [accountId, networkId, batchId, navigation],
  );

  const startSigning = useCallback(() => {
    // A rejection here also covers a stale/disposed batch (e.g. the window
    // reopened against a batch that no longer exists) — without a toast the
    // Sign button would just silently stop responding.
    void backgroundApiProxy.serviceBatchTxSign
      .signRemaining({ batchId })
      .catch(() => {
        Toast.error({ title: 'This signing request is no longer available' });
      });
  }, [batchId]);

  const showSigningNotice = useCallback(() => {
    Dialog.show({
      icon: isHw ? 'LaptopOutline' : 'WalletOutline',
      title:
        remainingCount === totalCount
          ? `Sign all ${remainingCount} transactions?`
          : `Sign ${remainingCount} remaining transactions?`,
      description: isHw
        ? "You'll review and approve each transaction on your hardware wallet. Keep the device connected until signing is complete."
        : `Authorize once to sign all ${remainingCount} transactions. Review the transaction summary carefully before continuing, as signing will begin immediately after you confirm.`,
      renderContent: (
        <XStack
          px="$4"
          py="$3"
          alignItems="center"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            Transactions
          </SizableText>
          <SizableText size="$bodyMdMedium">{remainingCount}</SizableText>
        </XStack>
      ),
      onCancelText: 'Cancel',
      onConfirmText: isHw ? 'Continue' : 'Sign all',
      onConfirm: startSigning,
    });
  }, [isHw, remainingCount, totalCount, startSigning]);

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

  const handleCancelRequest = useCallback(
    (closePageStack: () => void) => {
      Dialog.show({
        tone: 'destructive',
        title: 'Cancel this request?',
        description:
          'Signatures already generated have not been returned to the DApp and will be discarded.',
        onConfirmText: 'Cancel request',
        onCancelText: 'Go back',
        onConfirm: () => {
          void backgroundApiProxy.serviceBatchTxSign
            .cancelBatch({ batchId })
            .catch(() => {});
          closeAndReject(closePageStack);
        },
      });
    },
    [batchId, closeAndReject],
  );

  const handleDone = useCallback(
    async (closePageStack: (extra?: { flag?: string }) => void) => {
      // Freeze the currently-rendered (Complete) stage before
      // takeFinalizedResults clears the shared atom, so the fallback to
      // seededProgress below never gets a chance to flash the page back to
      // a stale Overview for a frame while this closes.
      setClosingSnapshot(batch);
      try {
        const results =
          await backgroundApiProxy.serviceBatchTxSign.takeFinalizedResults({
            batchId,
          });
        await dappApprove.resolve({ result: results });
        // Mark this close as an already-resolved success so handlePageClose
        // does not fire a redundant reject() for the same (now-settled) id —
        // see the comment on handlePageClose for why that is unsafe.
        hasSettledRef.current = true;
        closePageStack({ flag: EDAppModalPageStatus.Confirmed });
      } catch (_error) {
        // Keep the page open on failure: takeFinalizedResults/resolve did
        // not settle the dapp request, so the user can retry Done or fall
        // back to Cancel request instead of silently losing the batch.
        setClosingSnapshot(undefined);
        Toast.error({ title: 'Failed to collect signatures' });
      }
    },
    [batch, batchId, dappApprove],
  );

  const handlePreventRemove = useCallback(
    ({ data }: { data: { action: NavigationAction } }) => {
      Dialog.show({
        tone: 'destructive',
        title: 'Stop signing and cancel the request?',
        description:
          'Signatures already generated will be discarded and the DApp request will be rejected.',
        onConfirmText: 'Stop and cancel',
        onCancelText: 'Keep signing',
        onConfirm: () => {
          void backgroundApiProxy.serviceBatchTxSign
            .cancelBatch({ batchId })
            .catch(() => {});
          hasSettledRef.current = true;
          dappApprove.reject();
          navigation.dispatch(data.action);
        },
      });
    },
    [batchId, dappApprove, navigation],
  );
  usePreventRemove(isSigningNow, handlePreventRemove);

  if (loadError) {
    return (
      <Page onClose={handlePageClose}>
        <Page.Header title={BATCH_PAGE_TITLE} />
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
              Unable to load this request
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              This signing request is no longer available.
            </SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  if (!batch) {
    return (
      <Page onClose={handlePageClose}>
        <Page.Header title={BATCH_PAGE_TITLE} />
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
        <Page.Header title={BATCH_PAGE_TITLE} />
        <Page.Body px="$5">
          <BatchSigningProgress
            totalCount={totalCount}
            signedCount={signedCount}
            currentRow={currentRow}
          />
        </Page.Body>
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={isComplete ? 'Done' : 'Waiting for signature…'}
            confirmButtonProps={{ disabled: !isComplete }}
            onConfirm={(_close, closePageStack) => {
              if (isComplete) {
                void handleDone(closePageStack);
              }
            }}
          />
        </Page.Footer>
      </Page>
    );
  }

  return (
    <Page scrollEnabled onClose={handlePageClose}>
      <Page.Header title={BATCH_PAGE_TITLE} />
      <Page.Body px="$5">
        <YStack width="100%" maxWidth={640} alignSelf="center" gap="$4" pb="$6">
          {sourceInfo?.origin ? (
            <DAppSiteMark
              origin={sourceInfo.origin}
              urlSecurityInfo={urlSecurityInfo}
              hideRiskStyle={shouldHideDAppSiteRiskStyle(urlSecurityInfo)}
            />
          ) : null}

          <YStack bg="$bgSubdued" borderRadius="$3" overflow="hidden">
            <SummaryRow label="Transactions" value={`${totalCount}`} />
            <Stack height={1} bg="$borderSubdued" />
            <SummaryRow
              label="Total outgoing"
              value={formatAmount(totalOutgoingSatoshi)}
            />
            <Stack height={1} bg="$borderSubdued" />
            <SummaryRow
              label="Total network fee"
              value={formatAmount(totalFeeSatoshi)}
            />
          </YStack>

          <YStack gap="$2.5">
            <XStack alignItems="center">
              <SizableText flex={1} size="$bodyMdMedium" color="$textSubdued">
                Transactions
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {`${remainingCount} remaining`}
              </SizableText>
            </XStack>

            {/* Plain .map, no cap per product decision — migrate to FlashList
                if batches beyond ~100 items become a real use case. */}
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
                disabled={isSigningNow}
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
              ? `Sign all ${totalCount}`
              : `Sign remaining ${remainingCount}`
          }
          confirmButtonProps={{
            loading: isSigningNow,
            disabled: isSigningNow || isBlockingRisk || remainingCount === 0,
          }}
          onConfirm={showSigningNotice}
          onCancelText={hasSignedAny ? 'Cancel request' : 'Reject all'}
          cancelButtonProps={{ variant: 'secondary', disabled: isSigningNow }}
          onCancel={(_close, closePageStack) => {
            if (hasSignedAny) {
              handleCancelRequest(closePageStack);
            } else {
              handleRejectAll(closePageStack);
            }
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BatchTxConfirm;
