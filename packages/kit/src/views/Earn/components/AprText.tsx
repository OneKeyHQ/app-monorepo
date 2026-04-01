import type { ComponentProps } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

import {
  buildAprRangeText,
  buildAprText,
  formatRewardText,
} from './AprText.utils';

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
        {formatRewardText({
          text: aprRangeText,
          rewardUnit,
          hideSuffix,
        })}
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
            {formatRewardText({
              text: highlight.text,
              rewardUnit,
              hideSuffix,
            })}
          </SizableText>
        </XStack>
        <SizableText
          size="$bodyMd"
          textAlign="right"
          color={deprecated.color || '$textSubdued'}
          textDecorationLine="line-through"
        >
          {formatRewardText({
            text: deprecated.text,
            rewardUnit,
            hideSuffix,
          })}
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
          {formatRewardText({
            text: highlight.text,
            rewardUnit,
            hideSuffix,
          })}
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
        {formatRewardText({
          text: normal.text,
          rewardUnit,
          hideSuffix,
        })}
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
        {formatRewardText({
          text: deprecated.text,
          rewardUnit,
          hideSuffix,
        })}
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
