// cspell: words unifold Unifold
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
  isUnifoldExecutionFailed,
  normalizeUnifoldIconUrl,
  shortenUnifoldRef,
} from './unifoldFormat';

import type { LayoutChangeEvent } from 'react-native';

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
  if (isUnifoldExecutionFailed(execution)) {
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
  if (isUnifoldExecutionFailed(execution)) {
    return 'Deposit needs attention';
  }
  return 'Deposit processing';
}

function statusSubtitle(
  execution: IUnifoldDepositExecution,
  sessionId: string | null,
): string {
  if (isUnifoldExecutionFailed(execution)) {
    // The card subtitle is a single narrow line, so the ref is shortened here;
    // the full value stays copyable in the execution detail.
    return sessionId
      ? `Contact support · Ref ${shortenUnifoldRef(sessionId)}`
      : 'Contact support';
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
  onDismiss,
  onHeightChange,
  floating = true,
}: {
  // Already filtered by the owner: dismissal lives with whoever reserves the
  // space for this overlay, otherwise the two states drift apart.
  executions: IUnifoldDepositExecution[];
  sessionId: string | null;
  estimatedProcessingTimeSeconds?: number;
  onPressExecution?: (execution: IUnifoldDepositExecution) => void;
  onDismiss: (executionId: string) => void;
  onHeightChange?: (height: number) => void;
  floating?: boolean;
}) {
  if (!executions.length) {
    return null;
  }

  return (
    <YStack
      {...(floating
        ? ({
            position: 'absolute',
            left: '$0',
            right: '$0',
            bottom: '$0',
          } as const)
        : undefined)}
      pb="$2"
      gap="$1"
      onLayout={(event: LayoutChangeEvent) =>
        // Rounded up: react-native-web measures through ResizeObserver and
        // reports fractional heights that would otherwise flip the reserved
        // padding back and forth between renders.
        onHeightChange?.(Math.ceil(event.nativeEvent.layout.height))
      }
    >
      {executions.map((execution) => (
        <XStack
          key={execution.executionId}
          bg="$bgInverse"
          borderRadius="$3"
          p="$3"
          alignItems="center"
          gap="$3"
          borderWidth="$px"
          borderColor={
            isUnifoldExecutionFailed(execution)
              ? '$borderCaution'
              : '$borderInverse'
          }
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
            onPress={() => onDismiss(execution.executionId)}
          />
        </XStack>
      ))}
    </YStack>
  );
}
