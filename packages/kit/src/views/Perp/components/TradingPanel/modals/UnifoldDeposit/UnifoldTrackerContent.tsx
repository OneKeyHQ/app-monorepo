// cspell: words unifold Unifold
import { useRef, useState } from 'react';

import {
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
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
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

function shortenHash(hash: string): string {
  if (hash.length <= 18) {
    return hash;
  }
  return `${hash.slice(0, 12)}...${hash.slice(-4)}`;
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
      p="$3"
      alignItems="center"
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <Stack>
        <Token
          size="md"
          tokenImageUri={normalizeUnifoldIconUrl(
            execution.destinationTokenIconUrl,
          )}
        />
        <Stack position="absolute" right={-2} bottom={-2}>
          {isProcessing(execution) ? (
            <Spinner size="small" />
          ) : (
            <Stack
              bg={
                execution.status === 'succeeded'
                  ? '$bgSuccessStrong'
                  : '$bgCautionStrong'
              }
              borderRadius="$full"
              p="$0.5"
            >
              <Icon
                name={
                  execution.status === 'succeeded'
                    ? 'CheckLargeOutline'
                    : 'ErrorOutline'
                }
                size="$2.5"
                color="$iconOnColor"
              />
            </Stack>
          )}
        </Stack>
      </Stack>
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
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

function DetailInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" color="$text">
        {value}
      </SizableText>
    </XStack>
  );
}

export function UnifoldExecutionDetail({
  execution,
}: {
  execution: IUnifoldDepositExecution;
}) {
  const [moreExpanded, setMoreExpanded] = useState(false);
  const processing = isProcessing(execution);
  const [devSettings] = useDevSettingsPersistAtom();
  const destination = resolveUnifoldDepositDestination(devSettings);
  const destinationLabel = isUnifoldHyperCoreDestination(destination)
    ? 'HyperCore'
    : 'Arbitrum';

  return (
    <YStack px="$2">
      <YStack alignItems="center" py="$6" gap="$2">
        <Stack>
          <Token
            size="xl"
            tokenImageUri={normalizeUnifoldIconUrl(
              execution.destinationTokenIconUrl,
            )}
          />
          <Stack position="absolute" right={-4} bottom={-4}>
            {processing ? (
              <Spinner size="small" />
            ) : (
              <Stack
                bg={
                  execution.status === 'succeeded'
                    ? '$bgSuccessStrong'
                    : '$bgCautionStrong'
                }
                borderRadius="$full"
                p="$1"
                borderWidth={3}
                borderColor="$bgApp"
              >
                <Icon
                  name={
                    execution.status === 'succeeded'
                      ? 'CheckLargeOutline'
                      : 'ErrorOutline'
                  }
                  size="$3.5"
                  color="$iconOnColor"
                />
              </Stack>
            )}
          </Stack>
        </Stack>
        <XStack alignItems="center" gap="$1.5">
          <Stack
            w="$2"
            h="$2"
            borderRadius="$full"
            bg={
              execution.status === 'succeeded'
                ? '$bgSuccessStrong'
                : '$bgCautionStrong'
            }
          />
          <SizableText size="$bodyLgMedium" color="$text">
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

      <YStack
        bg="$bgSubdued"
        borderRadius="$3"
        overflow="hidden"
        separator={<Divider mx="$4" />}
      >
        <DetailInfoRow
          label="Amount Sent"
          value={formatUnifoldTokenAmount({
            baseUnit: execution.sourceAmountBaseUnit,
            decimals: execution.sourceTokenDecimals,
            currency: execution.sourceCurrency,
          })}
        />
        <DetailInfoRow
          label="Amount Received"
          value={formatUnifoldTokenAmount({
            baseUnit: execution.destinationAmountBaseUnit,
            decimals: execution.destinationTokenDecimals,
            currency: execution.destinationCurrency,
          })}
        />
        <DetailInfoRow
          label="USD Value"
          value={formatUnifoldUsd(
            execution.destinationAmountUsd ?? execution.sourceAmountUsd,
          )}
        />
        {processing ? (
          <DetailInfoRow
            label="Estimated delivery time"
            value={formatUnifoldProcessingTime(null)}
          />
        ) : null}
        <DetailInfoRow
          label="Source Network"
          value={formatUnifoldChainName({
            chainType: execution.sourceChainType,
            chainId: execution.sourceChainId,
          })}
        />
        {/* Executions do not carry the destination triplet, so this reflects
            the destination the app is configured for. In production that is
            always HyperCore; dev builds may route to a plain chain. */}
        <DetailInfoRow label="Destination Network" value={destinationLabel} />
      </YStack>

      <XStack
        px="$1"
        py="$3"
        alignItems="center"
        justifyContent="space-between"
        cursor="pointer"
        onPress={() => setMoreExpanded((v) => !v)}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {moreExpanded ? 'See less' : 'See more details'}
        </SizableText>
        <Icon
          name={
            moreExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
          }
          size="$3.5"
          color="$iconSubdued"
        />
      </XStack>

      {moreExpanded ? (
        <YStack
          bg="$bgSubdued"
          borderRadius="$3"
          overflow="hidden"
          separator={<Divider mx="$4" />}
        >
          {execution.explorerUrl && execution.transactionHash ? (
            <XStack
              px="$4"
              py="$3"
              alignItems="center"
              justifyContent="space-between"
              cursor="pointer"
              hoverStyle={{ bg: '$bgHover' }}
              onPress={() => {
                if (execution.explorerUrl) {
                  openUrlExternal(execution.explorerUrl);
                }
              }}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                Deposit Tx
              </SizableText>
              <XStack alignItems="center" gap="$1.5">
                <SizableText size="$bodyMdMedium" color="$text">
                  {shortenHash(execution.transactionHash)}
                </SizableText>
                <Icon name="OpenOutline" size="$3.5" color="$iconSubdued" />
              </XStack>
            </XStack>
          ) : null}
          {execution.status === 'succeeded' &&
          execution.destinationExplorerUrl &&
          execution.destinationTransactionHashes[0] ? (
            <XStack
              px="$4"
              py="$3"
              alignItems="center"
              justifyContent="space-between"
              cursor="pointer"
              hoverStyle={{ bg: '$bgHover' }}
              onPress={() => {
                if (execution.destinationExplorerUrl) {
                  openUrlExternal(execution.destinationExplorerUrl);
                }
              }}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                Completion Tx
              </SizableText>
              <XStack alignItems="center" gap="$1.5">
                <SizableText size="$bodyMdMedium" color="$text">
                  {shortenHash(execution.destinationTransactionHashes[0])}
                </SizableText>
                <Icon name="OpenOutline" size="$3.5" color="$iconSubdued" />
              </XStack>
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}

export function UnifoldTrackerContent({
  recipientAddress,
  listHeight,
}: {
  recipientAddress: string | null;
  listHeight?: number;
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

  // Track the selected row by id and re-derive it from the freshest poll
  // result, so an in-progress execution keeps updating inside the detail view
  // instead of freezing at the moment it was tapped.
  const [detailSelection, setDetailSelection] = useState<{
    executionId: string;
    snapshot: IUnifoldDepositExecution;
  } | null>(null);

  // Full history: no `since` param (newest first, up to 100 rows). The 3s
  // poll matches the contract; the server throttles upstream QPS.
  const { result: executions } = usePromiseResult(
    async () => {
      if (!safeRecipient) {
        return [];
      }
      return backgroundApiProxy.serviceUnifoldDeposit.listDepositExecutions({
        recipientAddress: safeRecipient,
      });
    },
    [safeRecipient],
    { watchLoading: true, pollingInterval: TRACKER_POLL_INTERVAL_MS },
  );

  if (!safeRecipient) {
    return (
      <YStack py="$8">
        <Empty
          icon="ErrorOutline"
          title="Deposit history unavailable"
          description="Account address mismatch. Reopen from the deposit menu."
        />
      </YStack>
    );
  }

  if (detailSelection) {
    const liveExecution =
      executions?.find((e) => e.executionId === detailSelection.executionId) ??
      detailSelection.snapshot;
    return (
      <YStack>
        <XStack
          px="$2"
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
        <UnifoldExecutionDetail execution={liveExecution} />
      </YStack>
    );
  }

  // usePromiseResult defers the first run: `executions === undefined` means
  // "not loaded yet" — render the skeleton, never flash the empty state.
  if (executions === undefined) {
    return (
      <YStack gap="$3" width="100%" px="$2" py="$4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={64} radius={12} />
        ))}
      </YStack>
    );
  }

  if (!executions.length) {
    return (
      <YStack py="$8" alignItems="center" gap="$2">
        <Empty
          icon="ClockTimeHistoryOutline"
          title="No deposits yet"
          description="Your deposit history will appear here"
        />
      </YStack>
    );
  }

  return (
    <ScrollView maxHeight={listHeight ?? 460}>
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
  );
}
