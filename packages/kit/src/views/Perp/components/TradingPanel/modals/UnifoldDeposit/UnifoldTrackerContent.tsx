// cspell: words unifold Unifold
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Dialog,
  Divider,
  Empty,
  Icon,
  ScrollView,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useBackHandler,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  isUnifoldHyperCoreDestination,
  resolveUnifoldDepositDestination,
} from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { getSafeUnifoldRecipient } from '@onekeyhq/kit/src/views/Perp/utils/unifoldRecipient';
import {
  perpsActiveAccountAtom,
  useDevSettingsPersistAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IUnifoldDepositExecution } from '@onekeyhq/shared/types/unifoldDeposit';

import {
  formatUnifoldChainName,
  formatUnifoldExecutionDate,
  formatUnifoldProcessingTime,
  formatUnifoldTokenAmount,
  formatUnifoldUsd,
  normalizeUnifoldIconUrl,
} from './unifoldFormat';

const TRACKER_POLL_INTERVAL_MS = 3000;
const DESKTOP_TRACKER_BODY_HEIGHT = 550;

function isProcessing(execution: IUnifoldDepositExecution): boolean {
  return !execution.terminal;
}

// Contract discipline: delayed is never rendered as failure; failed/refunded
// point at support instead of an invented reason.
function rowTitle(execution: IUnifoldDepositExecution): string {
  if (execution.status === 'succeeded') {
    return 'Deposit completed';
  }
  if (execution.terminal) {
    return 'Deposit needs attention';
  }
  return 'Deposit processing';
}

function detailStatusText(execution: IUnifoldDepositExecution): string {
  if (execution.status === 'succeeded') {
    return 'Completed';
  }
  if (execution.terminal) {
    return 'Needs attention';
  }
  return 'Processing';
}

// Processing (including delayed) must read as neutral progress, never as the
// caution color reserved for deposits that actually need attention.
function detailStatusDotColor(
  execution: IUnifoldDepositExecution,
): '$bgInfoStrong' | '$bgSuccessStrong' | '$bgCautionStrong' {
  if (isProcessing(execution)) {
    return '$bgInfoStrong';
  }
  if (execution.status === 'succeeded') {
    return '$bgSuccessStrong';
  }
  return '$bgCautionStrong';
}

function shortenHash(hash: string): string {
  if (hash.length <= 14) {
    return hash;
  }
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

function ExecutionTokenBadge({
  execution,
  compact = false,
}: {
  execution: IUnifoldDepositExecution;
  compact?: boolean;
}) {
  if (isProcessing(execution)) {
    return <Spinner size="small" scale={compact ? 0.65 : 1} />;
  }
  return (
    <Stack
      w={compact ? '$4' : '$5'}
      h={compact ? '$4' : '$5'}
      bg={
        execution.status === 'succeeded'
          ? '$bgSuccessStrong'
          : '$bgCautionStrong'
      }
      borderRadius="$full"
      alignItems="center"
      justifyContent="center"
    >
      <Icon
        name={
          execution.status === 'succeeded'
            ? 'CheckLargeOutline'
            : 'ErrorOutline'
        }
        size={compact ? '$2.5' : '$3.5'}
        color="$iconOnColor"
      />
    </Stack>
  );
}

// Exported so the dev gallery can render fixture rows without any network.
export function UnifoldExecutionRow({
  execution,
  onPress,
}: {
  execution: IUnifoldDepositExecution;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={`perps-unifold-tracker-row-${execution.executionId}`}
      p="$3"
      alignItems="center"
      gap="$3"
      bg="$bgStrong"
      borderRadius="$3"
      cursor="pointer"
      hoverStyle={{ bg: '$bgStrongHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={onPress}
    >
      <Token
        size="md"
        tokenImageUri={normalizeUnifoldIconUrl(
          execution.destinationTokenIconUrl,
        )}
        cornerBadge={<ExecutionTokenBadge execution={execution} compact />}
      />
      <YStack flex={1} minWidth={0}>
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          fontWeight="600"
          numberOfLines={1}
        >
          {rowTitle(execution)}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {formatUnifoldExecutionDate(execution.createdAt)}
        </SizableText>
      </YStack>
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
        flexShrink={0}
      >
        {formatUnifoldUsd(
          execution.destinationAmountUsd ?? execution.sourceAmountUsd,
        )}
      </SizableText>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

function DetailInfoRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <XStack
      px="$4"
      py="$3"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
      role={onCopy ? 'button' : undefined}
      cursor={onCopy ? 'pointer' : undefined}
      userSelect={onCopy ? 'none' : undefined}
      hoverStyle={onCopy ? { bg: '$bgHover' } : undefined}
      pressStyle={onCopy ? { bg: '$bgActive' } : undefined}
      onPress={onCopy}
    >
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1.5" flexShrink={1} minWidth={0}>
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
        >
          {value}
        </SizableText>
        {onCopy ? (
          <Stack p="$1" m="$-1">
            <Icon name="Copy3Outline" size="$3.5" color="$iconSubdued" />
          </Stack>
        ) : null}
      </XStack>
    </XStack>
  );
}

function DetailLinkRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <XStack
      px="$4"
      py="$3"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1.5" flexShrink={1} minWidth={0}>
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
        >
          {value}
        </SizableText>
        <Icon name="OpenOutline" size="$3.5" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}

export function UnifoldExecutionDetail({
  execution,
  estimatedProcessingTimeSeconds,
}: {
  execution: IUnifoldDepositExecution;
  // Comes from the selected chain's catalog entry, so it only exists inside a
  // deposit session. The tracker renders history with no chain selection and
  // passes nothing — in that case the ETA row is omitted rather than guessed.
  estimatedProcessingTimeSeconds?: number;
}) {
  const { copyText } = useClipboard();
  const processing = isProcessing(execution);
  const [devSettings] = useDevSettingsPersistAtom();
  const destination = resolveUnifoldDepositDestination(devSettings);
  const destinationLabel = isUnifoldHyperCoreDestination(destination)
    ? 'HyperCore'
    : 'Arbitrum';
  return (
    <YStack testID={`perps-unifold-execution-detail-${execution.executionId}`}>
      <YStack alignItems="center" py="$6" gap="$2">
        <Token
          size="xxl"
          tokenImageUri={normalizeUnifoldIconUrl(
            execution.destinationTokenIconUrl,
          )}
          cornerBadge={<ExecutionTokenBadge execution={execution} />}
        />
        <XStack alignItems="center" gap="$1.5">
          {execution.status === 'succeeded' ? null : (
            <Stack
              w="$2"
              h="$2"
              borderRadius="$full"
              bg={detailStatusDotColor(execution)}
            />
          )}
          <SizableText size="$headingMd" color="$text">
            {detailStatusText(execution)}
          </SizableText>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          {formatUnifoldExecutionDate(execution.createdAt)}
        </SizableText>
      </YStack>

      {execution.terminal && execution.status !== 'succeeded' ? (
        // Contract §1: failed/refunded → point at support; never invent a
        // failure reason.
        <XStack
          bg="$bgCautionSubdued"
          borderWidth="$px"
          borderColor="$borderCautionSubdued"
          borderRadius="$3"
          p="$3"
          mb="$3"
          gap="$2"
          alignItems="center"
        >
          <Icon name="ErrorOutline" size="$4" color="$iconCaution" />
          <SizableText size="$bodySm" color="$textCaution" flex={1}>
            This deposit needs attention. Please contact support.
          </SizableText>
        </XStack>
      ) : null}

      <YStack gap="$3">
        <YStack bg="$bgStrong" borderRadius="$3" overflow="hidden">
          <DetailInfoRow
            label="Amount Sent"
            value={formatUnifoldTokenAmount({
              baseUnit: execution.sourceAmountBaseUnit,
              decimals: execution.sourceTokenDecimals,
              currency: execution.sourceCurrency,
            })}
          />
          <Divider borderColor="$bgSubdued" />
          <DetailInfoRow
            label="Amount Received"
            value={formatUnifoldTokenAmount({
              baseUnit: execution.destinationAmountBaseUnit,
              decimals: execution.destinationTokenDecimals,
              currency: execution.destinationCurrency,
            })}
          />
          <Divider borderColor="$bgSubdued" />
          <DetailInfoRow
            label="USD Value"
            value={formatUnifoldUsd(
              execution.destinationAmountUsd ?? execution.sourceAmountUsd,
            )}
          />
          {processing &&
          execution.status !== 'delayed' &&
          typeof estimatedProcessingTimeSeconds === 'number' &&
          estimatedProcessingTimeSeconds > 0 ? (
            <>
              <Divider borderColor="$bgSubdued" />
              <DetailInfoRow
                label="Estimated delivery time"
                value={formatUnifoldProcessingTime(
                  estimatedProcessingTimeSeconds,
                )}
              />
            </>
          ) : null}
        </YStack>

        <YStack bg="$bgStrong" borderRadius="$3" overflow="hidden">
          <DetailInfoRow
            label="Source Network"
            value={formatUnifoldChainName({
              chainType: execution.sourceChainType,
              chainId: execution.sourceChainId,
            })}
          />
          <Divider borderColor="$bgSubdued" />
          {/* Executions do not carry the destination triplet, so this reflects
              the destination the app is configured for. In production that is
              always HyperCore; dev builds may route to a plain chain. */}
          <DetailInfoRow label="Destination Network" value={destinationLabel} />
        </YStack>

        <YStack bg="$bgStrong" borderRadius="$3" overflow="hidden">
          {/* Always present: this is the id support asks for, and the caution
              banner above is what sends the user here. */}
          <DetailInfoRow
            label="Reference"
            value={shortenHash(execution.executionId)}
            onCopy={() => copyText(execution.executionId)}
          />
          {execution.explorerUrl && execution.transactionHash ? (
            <>
              <Divider borderColor="$bgSubdued" />
              <DetailLinkRow
                label="Deposit Tx"
                value={shortenHash(execution.transactionHash)}
                onPress={() => {
                  if (execution.explorerUrl) {
                    openUrlExternal(execution.explorerUrl);
                  }
                }}
              />
            </>
          ) : null}
          {execution.status === 'succeeded' &&
          execution.destinationExplorerUrl &&
          execution.destinationTransactionHashes[0] ? (
            <>
              <Divider borderColor="$bgSubdued" />
              <DetailLinkRow
                label="Completion Tx"
                value={shortenHash(execution.destinationTransactionHashes[0])}
                onPress={() => {
                  if (execution.destinationExplorerUrl) {
                    openUrlExternal(execution.destinationExplorerUrl);
                  }
                }}
              />
            </>
          ) : null}
        </YStack>
      </YStack>
    </YStack>
  );
}

export function UnifoldTrackerContent({
  recipientAddress,
  listHeight,
  useDialogHeader = false,
}: {
  recipientAddress: string | null;
  listHeight?: number;
  useDialogHeader?: boolean;
}) {
  // Security MUST-2 applies to the tracker too: the queried recipient must be
  // the currently active perps account at open time. The incoming prop (which
  // may originate from a route param) is cross-checked against the live atom
  // and fails closed on mismatch.
  const safeRecipientRef = useRef<string | null | undefined>(undefined);
  if (safeRecipientRef.current === undefined) {
    const activeAccount = jotaiDefaultStore.get(perpsActiveAccountAtom.atom());
    safeRecipientRef.current = getSafeUnifoldRecipient({
      recipient: recipientAddress,
      activeAccountAddress: activeAccount.accountAddress,
    });
  }
  const safeRecipient = safeRecipientRef.current ?? null;

  // The frozen recipient must also stop being queried once the active perps
  // account moves under an open tracker, or this keeps polling and rendering
  // the PREVIOUS account's deposit history. Positive mismatch only: a null
  // address is the transient state while a switch is in flight.
  const [activePerpsAccount] = usePerpsActiveAccountAtom();
  const liveAccountAddress = activePerpsAccount.accountAddress;
  const accountChanged = Boolean(
    safeRecipient &&
    liveAccountAddress &&
    liveAccountAddress.toLowerCase() !== safeRecipient.toLowerCase(),
  );

  // Track the selected row by id and re-derive it from the freshest poll
  // result, so an in-progress execution keeps updating inside the detail view
  // instead of freezing at the moment it was tapped.
  const [detailSelection, setDetailSelection] = useState<{
    executionId: string;
    snapshot: IUnifoldDepositExecution;
  } | null>(null);

  // Full history: no `since` param (newest first, up to 100 rows). The 3s
  // poll matches the contract; the server throttles upstream QPS.
  // A rejected poll must not leave the screen shimmering forever, which reads
  // exactly like "still loading" — the failure is surfaced instead, while the
  // poll keeps retrying underneath.
  const [loadFailed, setLoadFailed] = useState(false);
  const { result: executions } = usePromiseResult(
    async () => {
      if (!safeRecipient || accountChanged) {
        return [];
      }
      try {
        const items =
          await backgroundApiProxy.serviceUnifoldDeposit.listDepositExecutions({
            recipientAddress: safeRecipient,
          });
        setLoadFailed(false);
        return items;
      } catch (error) {
        setLoadFailed(true);
        throw error;
      }
    },
    [safeRecipient, accountChanged],
    { watchLoading: true, pollingInterval: TRACKER_POLL_INTERVAL_MS },
  );

  // The detail is a sub-view, not a route, so Android's hardware back would
  // otherwise pop the whole tracker modal. Android only: on web the same hook
  // listens for Escape (which must still close the dialog) and iOS modals are
  // dismissed by drag, not by a back event.
  useBackHandler(
    useCallback(() => {
      setDetailSelection(null);
      return true;
    }, []),
    platformEnv.isNativeAndroid && Boolean(detailSelection),
  );

  const withDialogHeader = (body: ReactNode) => {
    if (!useDialogHeader) {
      return body;
    }
    const dialogBody = (
      <Stack
        height={Math.min(
          listHeight ?? DESKTOP_TRACKER_BODY_HEIGHT,
          DESKTOP_TRACKER_BODY_HEIGHT,
        )}
        minHeight={0}
      >
        {body}
      </Stack>
    );
    return (
      <>
        {detailSelection ? (
          <Dialog.Header>
            <XStack
              alignItems="center"
              gap="$2"
              cursor="pointer"
              onPress={() => setDetailSelection(null)}
            >
              <Icon name="ChevronLeftSmallOutline" size="$5" color="$icon" />
              <Dialog.Title>Deposit Details</Dialog.Title>
            </XStack>
          </Dialog.Header>
        ) : (
          <Dialog.Header title="Deposit Tracker" />
        )}
        {dialogBody}
      </>
    );
  };

  if (!safeRecipient || accountChanged) {
    return withDialogHeader(
      <YStack py="$8">
        <Empty
          icon="ErrorOutline"
          title="Deposit history unavailable"
          description={
            accountChanged
              ? 'The active account changed. Reopen from the deposit menu to see its history.'
              : 'Account address mismatch. Reopen from the deposit menu.'
          }
        />
      </YStack>,
    );
  }

  if (detailSelection) {
    const liveExecution =
      executions?.find((e) => e.executionId === detailSelection.executionId) ??
      detailSelection.snapshot;
    return withDialogHeader(
      // Bounded like the list branch: the dialog panel clamps its height but
      // does not scroll, so a tall detail would render outside it.
      <ScrollView
        flex={useDialogHeader ? 1 : undefined}
        maxHeight={listHeight ?? 460}
      >
        <YStack>
          {useDialogHeader ? null : (
            <XStack
              pb="$2"
              alignItems="center"
              gap="$1"
              cursor="pointer"
              onPress={() => setDetailSelection(null)}
            >
              <Icon name="ChevronLeftSmallOutline" size="$5" color="$icon" />
              <SizableText size="$bodyMdMedium" color="$text">
                Deposit Details
              </SizableText>
            </XStack>
          )}
          <UnifoldExecutionDetail execution={liveExecution} />
        </YStack>
      </ScrollView>,
    );
  }

  if (executions === undefined && loadFailed) {
    return withDialogHeader(
      <YStack py="$8">
        <Empty
          icon="ErrorOutline"
          title="Couldn't load deposit history"
          description="Check your connection — this keeps retrying automatically."
        />
      </YStack>,
    );
  }

  // usePromiseResult defers the first run: `executions === undefined` means
  // "not loaded yet" — render the skeleton, never flash the empty state.
  if (executions === undefined) {
    return withDialogHeader(
      // Geometry matches the loaded list exactly, so resolving the first poll
      // does not shift the rows sideways or upwards.
      <YStack flex={useDialogHeader ? 1 : undefined} minHeight={0}>
        <YStack gap="$3" width="100%" flex={1}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={60} radius={12} />
          ))}
        </YStack>
      </YStack>,
    );
  }

  if (!executions.length) {
    return withDialogHeader(
      <YStack flex={useDialogHeader ? 1 : undefined} minHeight={0}>
        <YStack flex={1} py="$8" alignItems="center" gap="$2">
          <Empty
            icon="ClockTimeHistoryOutline"
            title="No deposits yet"
            description="Your deposit history will appear here"
          />
        </YStack>
      </YStack>,
    );
  }

  return withDialogHeader(
    <YStack flex={useDialogHeader ? 1 : undefined} minHeight={0}>
      <ScrollView
        flex={useDialogHeader ? 1 : undefined}
        maxHeight={listHeight ?? 460}
      >
        <YStack gap="$3" pb="$4">
          {executions.map((execution) => (
            <UnifoldExecutionRow
              key={execution.executionId}
              execution={execution}
              onPress={() =>
                setDetailSelection({
                  executionId: execution.executionId,
                  snapshot: execution,
                })
              }
            />
          ))}
        </YStack>
      </ScrollView>
    </YStack>,
  );
}
