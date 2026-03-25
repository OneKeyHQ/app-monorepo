import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Icon,
  NumberSizeableText,
  Page,
  Progress,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  popModalPages,
  popToTabRootScreen,
  switchTab,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  type EModalBulkSendRoutes,
  ETabRoutes,
  type IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EIntervalMode } from '@onekeyhq/shared/types/bulkSend';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

type ITxStatus = 'pending' | 'signing' | 'waiting' | 'success' | 'failed';

type ITxProgressItem = {
  index: number;
  status: ITxStatus;
  txid?: string;
  error?: string;
};

type IOverallStatus = 'idle' | 'processing' | 'completed' | 'partial';

function getIntervalDelay(intervalSettings?: {
  mode: string;
  minSeconds: string;
  maxSeconds: string;
}): number {
  if (!intervalSettings || intervalSettings.mode === EIntervalMode.None) {
    return 0;
  }
  const min = parseFloat(intervalSettings.minSeconds) * 1000;
  const max = parseFloat(intervalSettings.maxSeconds) * 1000;
  if (Number.isNaN(min) || Number.isNaN(max) || max < min) return 0;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function BulkSendProcess() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendProcess
  >();

  const {
    networkId,
    accountId,
    isInModal,
    unsignedTxs,
    tokenInfo,
    transfersInfo,
    intervalSettings,
    onSuccess,
    onFail,
  } = route.params ?? {};

  const txCount = unsignedTxs?.length ?? 0;

  const [txProgress, setTxProgress] = useState<ITxProgressItem[]>(() =>
    Array.from({ length: txCount }, (_, i) => ({
      index: i,
      status: 'pending' as ITxStatus,
    })),
  );

  const [overallStatus, setOverallStatus] = useState<IOverallStatus>('idle');
  const [isCancelled, setIsCancelled] = useState(false);
  const isCancelledRef = useRef(false);
  const isProcessingRef = useRef(false);
  const resultsRef = useRef<ISendTxOnSuccessData[]>([]);

  const successCount = useMemo(
    () => txProgress.filter((t) => t.status === 'success').length,
    [txProgress],
  );
  const failedCount = useMemo(
    () => txProgress.filter((t) => t.status === 'failed').length,
    [txProgress],
  );
  const processedCount = successCount + failedCount;

  const updateTxStatus = useCallback(
    (index: number, status: ITxStatus, txid?: string, error?: string) => {
      setTxProgress((prev) =>
        prev.map((item) =>
          item.index === index ? { ...item, status, txid, error } : item,
        ),
      );
    },
    [],
  );

  const navigateAfterDone = useCallback(async () => {
    if (accountUtils.isQrAccount({ accountId: accountId ?? '' })) {
      navigation.popStack();
      return;
    }
    if (isInModal) {
      navigation.popStack();
    } else {
      await popModalPages();
      switchTab(ETabRoutes.Home);
      await timerUtils.wait(50);
      await popToTabRootScreen();
    }
  }, [isInModal, navigation, accountId]);

  const processTransactions = useCallback(async () => {
    if (
      isProcessingRef.current ||
      !unsignedTxs ||
      unsignedTxs.length === 0 ||
      !networkId
    ) {
      return;
    }

    isProcessingRef.current = true;
    setOverallStatus('processing');

    const { serviceSend } = backgroundApiProxy;

    for (let i = 0; i < unsignedTxs.length; i += 1) {
      if (isCancelledRef.current) break;

      // Interval delay (skip for first tx)
      if (i > 0) {
        const delay = getIntervalDelay(intervalSettings);
        if (delay > 0) {
          updateTxStatus(i, 'waiting');
          await waitAsync(delay);
        }
      }

      if (isCancelledRef.current) break;

      updateTxStatus(i, 'signing');

      try {
        const unsignedTx = unsignedTxs[i];
        const txAccountId = unsignedTx.accountId || accountId || '';

        const signedTx = await serviceSend.signAndSendTransaction({
          networkId,
          accountId: txAccountId,
          unsignedTx,
          signOnly: false,
        });

        if (signedTx) {
          resultsRef.current.push({
            signedTx,
          } as ISendTxOnSuccessData);
          updateTxStatus(i, 'success', signedTx.txid);
        } else {
          updateTxStatus(i, 'failed', undefined, 'No signed tx returned');
        }
      } catch (error) {
        updateTxStatus(
          i,
          'failed',
          undefined,
          (error as Error).message || 'Unknown error',
        );
      }
    }

    const results = resultsRef.current;
    const total = unsignedTxs.length;

    if (results.length === total) {
      setOverallStatus('completed');
      onSuccess?.(results);
    } else if (results.length > 0) {
      setOverallStatus('partial');
      onSuccess?.(results);
    } else {
      setOverallStatus('partial');
      onFail?.(new Error(`All ${total} transactions failed`));
    }

    isProcessingRef.current = false;
  }, [
    unsignedTxs,
    networkId,
    accountId,
    intervalSettings,
    onSuccess,
    onFail,
    updateTxStatus,
  ]);

  // Start processing on mount
  useEffect(() => {
    void processTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent back navigation while processing — handled by disabling back gesture
  // and not showing back button (Page.Header without headerLeft)

  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    setIsCancelled(true);
  }, []);

  const handleDone = useCallback(async () => {
    if (successCount > 0 && successCount < txCount) {
      Toast.success({
        title: `${successCount}/${txCount} transactions sent`,
      });
    } else if (successCount === txCount) {
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        }),
      });
    }
    await navigateAfterDone();
  }, [txCount, successCount, intl, navigateAfterDone]);

  const isProcessing = overallStatus === 'processing';
  const isDone = overallStatus === 'completed' || overallStatus === 'partial';
  const progressValue = txCount > 0 ? (processedCount / txCount) * 100 : 0;

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_title,
        })}
        headerLeft={isProcessing ? () => null : undefined}
      />
      <Page.Body>
        <YStack px="$5" gap="$4">
          {/* Progress summary */}
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {`${processedCount} / ${txCount}`}
              </SizableText>
              {isDone ? (
                <XStack gap="$2">
                  {successCount > 0 ? (
                    <Badge badgeType="success" badgeSize="sm">
                      {`${successCount} ${intl.formatMessage({ id: ETranslations.global_success })}`}
                    </Badge>
                  ) : null}
                  {failedCount > 0 ? (
                    <Badge badgeType="critical" badgeSize="sm">
                      {`${failedCount} failed`}
                    </Badge>
                  ) : null}
                </XStack>
              ) : null}
            </XStack>
            <Progress value={progressValue} />
          </YStack>

          {/* Transaction list */}
          <YStack gap="$1">
            {txProgress.map((item) => {
              const transfer = transfersInfo?.[item.index];
              if (!transfer) return null;

              return (
                <XStack
                  key={item.index}
                  gap="$3"
                  py="$2"
                  px="$3"
                  bg="$bgSubdued"
                  borderRadius="$2"
                  alignItems="center"
                >
                  {/* Status icon */}
                  <YStack width="$5" alignItems="center">
                    {item.status === 'pending' ? (
                      <SizableText size="$bodySm" color="$textDisabled">
                        {item.index + 1}
                      </SizableText>
                    ) : null}
                    {item.status === 'waiting' ? (
                      <Icon
                        name="ClockTimeHistoryOutline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    ) : null}
                    {item.status === 'signing' ? (
                      <Spinner size="small" />
                    ) : null}
                    {item.status === 'success' ? (
                      <Icon
                        name="CheckRadioSolid"
                        size="$4"
                        color="$iconSuccess"
                      />
                    ) : null}
                    {item.status === 'failed' ? (
                      <Icon
                        name="XCircleSolid"
                        size="$4"
                        color="$iconCritical"
                      />
                    ) : null}
                  </YStack>

                  {/* Transfer info */}
                  <YStack flex={1} gap="$0.5">
                    <SizableText
                      size="$bodySm"
                      numberOfLines={1}
                      color="$textSubdued"
                    >
                      {accountUtils.shortenAddress({
                        address: transfer.from,
                      })}{' '}
                      →{' '}
                      {accountUtils.shortenAddress({
                        address: transfer.to,
                      })}
                    </SizableText>
                    {item.error ? (
                      <SizableText
                        size="$bodySm"
                        color="$textCritical"
                        numberOfLines={1}
                      >
                        {item.error}
                      </SizableText>
                    ) : null}
                  </YStack>

                  {/* Amount */}
                  <NumberSizeableText
                    size="$bodySmMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: tokenInfo?.symbol }}
                  >
                    {transfer.amount || '0'}
                  </NumberSizeableText>
                </XStack>
              );
            })}
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <YStack px="$5" pb="$5" gap="$3">
          {isDone ? (
            <Button variant="primary" size="large" onPress={handleDone}>
              {intl.formatMessage({ id: ETranslations.global_done })}
            </Button>
          ) : null}
          {isProcessing ? (
            <Button
              variant="secondary"
              size="large"
              onPress={handleCancel}
              disabled={isCancelled}
            >
              {intl.formatMessage({ id: ETranslations.global_cancel })}
            </Button>
          ) : null}
        </YStack>
      </Page.Footer>
    </Page>
  );
}

export default BulkSendProcess;
