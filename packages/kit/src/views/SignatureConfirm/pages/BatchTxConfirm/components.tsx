import {
  Icon,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

// U+2212 MINUS SIGN (not a hyphen) to match the outgoing-amount style used
// across the app's transaction rows.
const MINUS_SIGN = '−';

// Shared between TransactionRow and BatchSigningProgress's "current
// transaction" card so both surfaces describe multi-output items the same
// way.
export function formatRecipientLine({
  recipient,
  extraRecipientCount,
}: {
  recipient: string;
  extraRecipientCount: number;
}): string {
  if (!recipient) {
    return 'To multiple outputs';
  }
  return extraRecipientCount > 0
    ? `To ${recipient} +${extraRecipientCount}`
    : `To ${recipient}`;
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack px="$4" py="$3" alignItems="center" gap="$4">
      <SizableText flex={1} size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" textAlign="right">
        {value}
      </SizableText>
    </XStack>
  );
}

export function TransactionRow({
  index,
  recipient,
  extraRecipientCount,
  amountText,
  fiatText,
  signed,
  failed,
  disabled,
  onPress,
}: {
  index: number;
  recipient: string;
  extraRecipientCount: number;
  amountText: string;
  fiatText?: string;
  signed: boolean;
  failed?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const subtitleColor = failed ? '$textCritical' : '$textSubdued';

  return (
    <XStack
      minHeight="$16"
      px="$3.5"
      py="$3"
      alignItems="center"
      gap="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      bg={signed ? '$bgSuccessSubdued' : '$bgSubdued'}
      opacity={disabled ? 0.5 : 1}
      userSelect="none"
      cursor={disabled ? undefined : 'pointer'}
      hoverStyle={disabled ? undefined : { bg: '$bgHover' }}
      pressStyle={disabled ? undefined : { bg: '$bgActive' }}
      focusable={!disabled}
      onPress={disabled ? undefined : onPress}
    >
      <Stack
        width="$9"
        height="$9"
        flexShrink={0}
        alignItems="center"
        justifyContent="center"
        borderRadius="$full"
        bg={signed ? '$bgSuccessSubdued' : '$bgStrong'}
      >
        {signed ? (
          <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />
        ) : (
          <SizableText size="$bodySmMedium" color={subtitleColor}>
            {String(index + 1).padStart(2, '0')}
          </SizableText>
        )}
      </Stack>

      <YStack flex={1} minWidth={0}>
        <XStack alignItems="center" gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {`Transaction ${index + 1}`}
          </SizableText>
          {signed ? (
            <SizableText size="$bodySmMedium" color="$textSuccess">
              Signed
            </SizableText>
          ) : null}
          {failed ? (
            <SizableText size="$bodySmMedium" color="$textCritical">
              Failed
            </SizableText>
          ) : null}
        </XStack>
        <SizableText size="$bodySm" color={subtitleColor} numberOfLines={1}>
          {formatRecipientLine({ recipient, extraRecipientCount })}
        </SizableText>
      </YStack>

      <YStack flexShrink={0} alignItems="flex-end">
        <SizableText size="$bodyMdMedium">
          {`${MINUS_SIGN}${amountText}`}
        </SizableText>
        {fiatText ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {fiatText}
          </SizableText>
        ) : null}
      </YStack>

      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

export function BatchSigningProgress({
  totalCount,
  signedCount,
  currentRow,
}: {
  totalCount: number;
  signedCount: number;
  currentRow?: { title: string; recipient: string; amountText: string };
}) {
  const remainingCount = totalCount - signedCount;
  const isComplete = remainingCount === 0;
  const progressValue = totalCount > 0 ? (signedCount / totalCount) * 100 : 0;
  let progressDescription =
    'Review and approve this transaction on your hardware wallet';
  if (isComplete) {
    progressDescription = `${totalCount} signatures are ready to return to the DApp`;
  }

  return (
    <YStack
      width="100%"
      maxWidth={480}
      alignSelf="center"
      justifyContent="center"
      gap="$5"
      py="$8"
    >
      <YStack alignItems="center" gap="$2">
        <Stack
          width="$12"
          height="$12"
          alignItems="center"
          justifyContent="center"
          borderRadius="$full"
          bg={isComplete ? '$bgSuccessSubdued' : '$bgStrong'}
        >
          <Icon
            name={isComplete ? 'CheckRadioSolid' : 'BitcoinOutline'}
            size="$6"
            color={isComplete ? '$iconSuccess' : '$icon'}
          />
        </Stack>
        <SizableText size="$headingLg" textAlign="center">
          {isComplete
            ? 'All transactions signed'
            : `Signing transaction ${Math.min(
                signedCount + 1,
                totalCount,
              )} of ${totalCount}`}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {progressDescription}
        </SizableText>
      </YStack>

      <YStack gap="$2">
        <Progress animated size="medium" value={progressValue} />
        <XStack alignItems="center">
          <SizableText flex={1} size="$bodySm" color="$textSubdued">
            {`${signedCount} signed`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`${remainingCount} remaining`}
          </SizableText>
        </XStack>
      </YStack>

      {!isComplete && currentRow ? (
        <YStack
          px="$4"
          py="$3.5"
          gap="$2"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Current transaction
          </SizableText>
          <XStack alignItems="center" gap="$4">
            <YStack flex={1} minWidth={0}>
              <SizableText size="$bodyMdMedium">{currentRow.title}</SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {currentRow.recipient}
              </SizableText>
            </YStack>
            <SizableText size="$bodyMdMedium">
              {`${MINUS_SIGN}${currentRow.amountText}`}
            </SizableText>
          </XStack>
        </YStack>
      ) : null}

      {!isComplete ? (
        <XStack
          px="$4"
          py="$3"
          alignItems="center"
          gap="$3"
          borderRadius="$3"
          bg="$bgSubdued"
        >
          <Icon name="LaptopOutline" size="$5" color="$iconSubdued" />
          <SizableText flex={1} size="$bodySm" color="$textSubdued">
            Keep your device connected. You will confirm every transaction
            separately.
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}
