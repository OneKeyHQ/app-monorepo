import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

type Props = {
  networkFee: string;
  networkFeeFiat: string;
  feeLevel: string;
  interval: string;
  onFeeLevelPress?: () => void;
};

function BulkSendReviewCostCard({
  networkFee,
  networkFeeFiat,
  feeLevel,
  interval,
  onFeeLevelPress,
}: Props) {
  return (
    <YStack px="$5" py="$3">
      <YStack bg="$bgSubdued" borderRadius="$3" py="$2">
        {/* Network Fee Row */}
        <XStack gap="$2" px="$4" py="$2" alignItems="flex-start">
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            Est. network fee
          </SizableText>
          <YStack alignItems="flex-end">
            <XStack gap="$1">
              <NumberSizeableText
                size="$bodyMdMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: '' }}
              >
                {networkFee}
              </NumberSizeableText>
              <SizableText size="$bodyMdMedium">({networkFeeFiat})</SizableText>
            </XStack>
            <XStack
              gap="$1"
              alignItems="center"
              onPress={onFeeLevelPress}
              cursor={onFeeLevelPress ? 'pointer' : undefined}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {feeLevel}
              </SizableText>
              {onFeeLevelPress ? (
                <Icon
                  name="ChevronGrabberVerOutline"
                  size="$4"
                  color="$iconSubdued"
                />
              ) : null}
            </XStack>
          </YStack>
        </XStack>

        {/* Interval Row */}
        <XStack gap="$2" px="$4" py="$2" alignItems="flex-start">
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            Interval
          </SizableText>
          <SizableText size="$bodyMdMedium">{interval}</SizableText>
        </XStack>
      </YStack>
    </YStack>
  );
}

export default BulkSendReviewCostCard;
