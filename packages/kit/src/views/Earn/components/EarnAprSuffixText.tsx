import type { ComponentProps } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

// Design spec (OK-58881/OK-58854/OK-58879, figma 27419-39147):
// APY/APR renders as "value + slightly smaller unit suffix".
// Match the trailing APY/APR unit (case-insensitive) and render the parts
// separately.
const APR_SUFFIX_PATTERN = /^(.*?)\s*(APY|APR)\s*$/i;

type ISizableTextSize = ComponentProps<typeof SizableText>['size'];
type ISizableTextColor = ComponentProps<typeof SizableText>['color'];

export function EarnAprSuffixText({
  text,
  size = '$bodyLgMedium',
  suffixSize = '$bodySmMedium',
  color = '$text',
  fallbackUnit,
}: {
  text: string;
  size?: ISizableTextSize;
  suffixSize?: ISizableTextSize;
  color?: ISizableTextColor;
  /** Fallback unit when the server copy has no APY/APR suffix (e.g. provider.rewardUnit) */
  fallbackUnit?: string;
}) {
  const match = text.match(APR_SUFFIX_PATTERN);
  if (!match || !match[1]) {
    if (text && fallbackUnit) {
      return (
        <XStack alignItems="baseline" gap="$1">
          <SizableText size={size} color={color} textAlign="right">
            {text}
          </SizableText>
          <SizableText size={suffixSize} color={color}>
            {fallbackUnit.toUpperCase()}
          </SizableText>
        </XStack>
      );
    }
    return (
      <SizableText size={size} color={color} textAlign="right">
        {text}
      </SizableText>
    );
  }
  const [, value, unit] = match;
  return (
    <XStack alignItems="baseline" gap="$1">
      <SizableText size={size} color={color} textAlign="right">
        {value}
      </SizableText>
      <SizableText size={suffixSize} color={color}>
        {unit.toUpperCase()}
      </SizableText>
    </XStack>
  );
}
