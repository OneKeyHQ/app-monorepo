// cspell: words unifold Unifold
import { useState } from 'react';

import {
  Icon,
  IconButton,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IUnifoldDepositExecution } from '@onekeyhq/shared/types/unifoldDeposit';

import {
  formatUnifoldExecutionDate,
  formatUnifoldProcessingTime,
  formatUnifoldUsd,
  normalizeUnifoldIconUrl,
} from './unifoldFormat';

// Per-execution status cards pinned to the bottom of the deposit modal while
// it is open (D2 decision: SDK-style in-modal cards; after the modal closes
// the bg tracking loop takes over with the standard perps toast).
//
// Status rendering follows the contract, not the SDK:
// - waiting/pending → processing card
// - delayed → processing card + "taking longer than usual" (never a failure)
// - succeeded → completed card
// - failed/refunded → "contact support" + sessionId, no invented reason

function StatusBadge({ execution }: { execution: IUnifoldDepositExecution }) {
  if (execution.status === 'succeeded') {
    return (
      <Stack
        position="absolute"
        right={-2}
        bottom={-2}
        bg="$bgSuccessStrong"
        borderRadius="$full"
        p="$0.5"
      >
        <Icon name="CheckLargeOutline" size="$2.5" color="$iconOnColor" />
      </Stack>
    );
  }
  if (execution.terminal) {
    return (
      <Stack
        position="absolute"
        right={-2}
        bottom={-2}
        bg="$bgCautionStrong"
        borderRadius="$full"
        p="$0.5"
      >
        <Icon name="ErrorOutline" size="$2.5" color="$iconOnColor" />
      </Stack>
    );
  }
  return (
    <Stack position="absolute" right={-2} bottom={-2}>
      <Spinner size="small" />
    </Stack>
  );
}

function statusTitle(execution: IUnifoldDepositExecution): string {
  if (execution.status === 'succeeded') {
    return 'Deposit completed';
  }
  if (execution.terminal) {
    return 'Deposit needs attention';
  }
  return 'Deposit processing';
}

function statusSubtitle(
  execution: IUnifoldDepositExecution,
  sessionId: string | null,
): string {
  if (execution.terminal && execution.status !== 'succeeded') {
    return sessionId
      ? `Please contact support · Ref ${sessionId}`
      : 'Please contact support';
  }
  if (execution.status === 'delayed') {
    return 'Processing, taking longer than usual';
  }
  return formatUnifoldExecutionDate(execution.createdAt);
}

export function UnifoldExecutionStatusCards({
  executions,
  sessionId,
  estimatedProcessingTimeSeconds,
  onPressExecution,
}: {
  executions: IUnifoldDepositExecution[];
  sessionId: string | null;
  estimatedProcessingTimeSeconds?: number;
  onPressExecution?: (execution: IUnifoldDepositExecution) => void;
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const visible = executions.filter((e) => !dismissedIds.has(e.executionId));
  if (!visible.length) {
    return null;
  }

  return (
    <YStack
      position="absolute"
      left="$0"
      right="$0"
      bottom="$0"
      px="$2"
      pb="$2"
      gap="$1"
    >
      {visible.map((execution) => (
        <XStack
          key={execution.executionId}
          bg="$bgInverse"
          borderRadius="$3"
          p="$3"
          alignItems="center"
          gap="$3"
          borderWidth="$px"
          borderColor={execution.terminal ? '$borderInverse' : '$borderCaution'}
          cursor="pointer"
          onPress={() => onPressExecution?.(execution)}
        >
          <Stack>
            <Token
              size="md"
              tokenImageUri={normalizeUnifoldIconUrl(
                execution.destinationTokenIconUrl,
              )}
            />
            <StatusBadge execution={execution} />
          </Stack>
          <YStack flex={1} minWidth={0}>
            <SizableText
              size="$bodyMdMedium"
              color="$textInverse"
              numberOfLines={1}
            >
              {statusTitle(execution)}
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textInverseSubdued"
              numberOfLines={1}
            >
              {statusSubtitle(execution, sessionId)}
            </SizableText>
          </YStack>
          <YStack alignItems="flex-end" flexShrink={0}>
            <SizableText
              size="$bodyMdMedium"
              color="$textInverse"
              numberOfLines={1}
            >
              {formatUnifoldUsd(
                execution.destinationAmountUsd ?? execution.sourceAmountUsd,
              )}
            </SizableText>
            {!execution.terminal ? (
              <SizableText
                size="$bodySm"
                color="$textInverseSubdued"
                numberOfLines={1}
              >
                {`Est. ${formatUnifoldProcessingTime(
                  estimatedProcessingTimeSeconds,
                )}`}
              </SizableText>
            ) : null}
          </YStack>
          <IconButton
            testID={`unifold-status-card-dismiss-${execution.executionId}`}
            icon="CrossedSmallOutline"
            size="small"
            variant="tertiary"
            onPress={() => {
              setDismissedIds((prev) => {
                const next = new Set(prev);
                next.add(execution.executionId);
                return next;
              });
            }}
          />
        </XStack>
      ))}
    </YStack>
  );
}
