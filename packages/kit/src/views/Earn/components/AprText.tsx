import type { ComponentProps } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

// Helper to strip trailing APR/APY suffix from a text string
const stripRewardUnitSuffix = (text: string) =>
  text.replace(/\s*(APR|APY)$/i, '');

// Helper function to build APR text
const buildAprText = (apr: string, unit: string) => `${apr} ${unit}`;

const buildAprRangeText = ({
  minAprInfo,
  maxAprInfo,
  rewardUnit,
}: {
  minAprInfo?: IEarnAvailableAsset['minAprInfo'];
  maxAprInfo?: IEarnAvailableAsset['maxAprInfo'];
  rewardUnit?: IEarnAvailableAsset['rewardUnit'];
}) => {
  const minText = minAprInfo?.normal?.text?.trim();
  const maxText = maxAprInfo?.normal?.text?.trim();

  if (!minText || !maxText || !rewardUnit) {
    return undefined;
  }

  return `${stripRewardUnitSuffix(minText).trim()} - ${stripRewardUnitSuffix(maxText).trim()} ${rewardUnit}`.trim();
};

// APR text component with aprInfo support
export function AprText({
  asset,
  size = '$bodyLgMedium',
  hideSuffix = false,
}: {
  asset: {
    aprInfo?: IEarnAvailableAsset['aprInfo'];
    aprWithoutFee: IEarnAvailableAsset['aprWithoutFee'];
    rewardUnit?: IEarnAvailableAsset['rewardUnit'];
    minAprInfo?: IEarnAvailableAsset['minAprInfo'];
    maxAprInfo?: IEarnAvailableAsset['maxAprInfo'];
  };
  size?: ComponentProps<typeof SizableText>['size'];
  hideSuffix?: boolean;
}) {
  const {
    aprInfo,
    aprWithoutFee,
    rewardUnit = 'APR',
    minAprInfo,
    maxAprInfo,
  } = asset;
  const strip = hideSuffix ? stripRewardUnitSuffix : (t: string) => t;
  const aprRangeText = buildAprRangeText({
    minAprInfo,
    maxAprInfo,
    rewardUnit,
  });

  if (aprRangeText) {
    return (
      <SizableText
        size={size}
        textAlign="right"
        color={
          minAprInfo?.normal?.color ||
          maxAprInfo?.normal?.color ||
          aprInfo?.normal?.color ||
          '$text'
        }
      >
        {strip(aprRangeText)}
      </SizableText>
    );
  }

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
            size={size}
            textAlign="right"
            color={highlight.color || '$textSuccess'}
          >
            {strip(highlight.text)}
          </SizableText>
        </XStack>
        <SizableText
          size="$bodyMd"
          textAlign="right"
          color={deprecated.color || '$textSubdued'}
          textDecorationLine="line-through"
        >
          {strip(deprecated.text)}
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
          size={size}
          textAlign="right"
          color={highlight.color || '$textSuccess'}
        >
          {strip(highlight.text)}
        </SizableText>
      </XStack>
    );
  }

  // Priority 2: normal mode with custom color
  if (aprInfo?.normal) {
    const { normal } = aprInfo;
    return (
      <SizableText
        size={size}
        textAlign="right"
        color={normal.color || '$text'}
      >
        {strip(normal.text)}
      </SizableText>
    );
  }

  // Priority 3: deprecated only
  if (aprInfo?.deprecated) {
    const { deprecated } = aprInfo;
    return (
      <SizableText
        size={size}
        textAlign="right"
        color={deprecated.color || '$textSubdued'}
        textDecorationLine="line-through"
      >
        {strip(deprecated.text)}
      </SizableText>
    );
  }

  // Priority 4: fallback to current logic
  return (
    <SizableText size={size} textAlign="right">
      {hideSuffix ? aprWithoutFee : buildAprText(aprWithoutFee, rewardUnit)}
    </SizableText>
  );
}
