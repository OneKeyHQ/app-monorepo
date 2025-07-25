import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import type { IEarnRewardUnit } from '@onekeyhq/shared/types/staking';

// Helper function to build APR text
const buildAprText = (apr: string, unit: IEarnRewardUnit) => `${apr} ${unit}`;

// APR text component with aprInfo support
export function AprText({ asset }: { asset: IEarnAvailableAsset }) {
  const { aprInfo, aprWithoutFee, rewardUnit } = asset;

  // Special case: both highlight and deprecated exist
  if (aprInfo?.highlight && aprInfo?.deprecated) {
    const { highlight, deprecated } = aprInfo;
    return (
      <YStack alignItems="flex-end" gap="$0.5">
        <XStack alignItems="center" gap="$1">
          {highlight.icon ? (
            <Icon
              name={highlight.icon.icon}
              size="$4"
              color={highlight.icon.color || '$textSuccess'}
            />
          ) : null}
          <SizableText
            size="$bodyLgMedium"
            textAlign="right"
            color={highlight.color || '$textSuccess'}
          >
            {highlight.text}
          </SizableText>
        </XStack>
        <SizableText
          size="$bodyMd"
          textAlign="right"
          color={deprecated.color || '$textSubdued'}
          textDecorationLine="line-through"
        >
          {deprecated.text}
        </SizableText>
      </YStack>
    );
  }

  // Priority 1: highlight mode only
  if (aprInfo?.highlight) {
    const { highlight } = aprInfo;
    return (
      <XStack alignItems="center" gap="$1">
        {highlight.icon ? (
          <Icon
            name={highlight.icon.icon}
            size="$4"
            color={highlight.icon.color || '$textSuccess'}
          />
        ) : null}
        <SizableText
          size="$bodyLgMedium"
          textAlign="right"
          color={highlight.color || '$textSuccess'}
        >
          {highlight.text}
        </SizableText>
      </XStack>
    );
  }

  // Priority 2: normal mode with custom color
  if (aprInfo?.normal) {
    const { normal } = aprInfo;
    return (
      <SizableText
        size="$bodyLgMedium"
        textAlign="right"
        color={normal.color || '$text'}
      >
        {normal.text}
      </SizableText>
    );
  }

  // Priority 3: deprecated only
  if (aprInfo?.deprecated) {
    const { deprecated } = aprInfo;
    return (
      <SizableText
        size="$bodyLgMedium"
        textAlign="right"
        color={deprecated.color || '$textSubdued'}
        textDecorationLine="line-through"
      >
        {deprecated.text}
      </SizableText>
    );
  }

  // Priority 4: fallback to current logic
  return (
    <SizableText size="$bodyLgMedium" textAlign="right">
      {buildAprText(aprWithoutFee, rewardUnit as IEarnRewardUnit)}
    </SizableText>
  );
}
