import type { ComponentProps } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

// Design spec (OK-58881/OK-58854/OK-58879, figma 27419-39147):
// APY/APR renders as "value + slightly smaller unit suffix".
// Match the trailing APY/APR unit (case-insensitive) and render the parts
// separately.
const APR_SUFFIX_PATTERN = /^(.*?)\s*(APY|APR)\s*$/i;

type ISizableTextSize = ComponentProps<typeof SizableText>['size'];
type ISizableTextColor = ComponentProps<typeof SizableText>['color'];

// Figma (27171-35810): value bodyLg-medium (16px) pairs with an APY/APR span
// of bodyMd-medium (14px) — the suffix is exactly one type-scale step below
// the value. Derive the default so every caller stays on spec.
const SUFFIX_SIZE_BY_VALUE_SIZE: Partial<Record<string, ISizableTextSize>> = {
  '$bodyLgMedium': '$bodyMdMedium',
  '$bodyLg': '$bodyMd',
  '$bodyMdMedium': '$bodySmMedium',
  '$bodyMd': '$bodySm',
};

export function EarnAprSuffixText({
  text,
  size = '$bodyLgMedium',
  suffixSize,
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
  const resolvedSuffixSize =
    suffixSize ?? SUFFIX_SIZE_BY_VALUE_SIZE[String(size)] ?? '$bodyMdMedium';
  const match = text.match(APR_SUFFIX_PATTERN);
  if (!match || !match[1]) {
    if (text && fallbackUnit) {
      return (
        <XStack alignItems="baseline" gap="$1">
          <SizableText size={size} color={color} textAlign="right">
            {text}
          </SizableText>
          <SizableText size={resolvedSuffixSize} color={color}>
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
      <SizableText size={resolvedSuffixSize} color={color}>
        {unit.toUpperCase()}
      </SizableText>
    </XStack>
  );
}
