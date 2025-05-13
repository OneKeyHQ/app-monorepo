import { Icon, SizableText, XStack } from '@onekeyhq/components';

export function SlippageSetting() {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <XStack alignItems="center" space="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          Slippage
        </SizableText>
        <Icon name="QuestionmarkOutline" size="$5" color="$iconSubdued" />
      </XStack>
      <XStack alignItems="center" space="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          Auto (0.5%)
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
