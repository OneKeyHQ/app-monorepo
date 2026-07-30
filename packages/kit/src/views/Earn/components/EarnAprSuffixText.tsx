import type { ComponentProps } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

// 设计规范 (OK-58881/OK-58854/OK-58879，figma 27419-39147)：
// APY/APR 展示为「数值 + 略小字号的单位后缀」。
// 匹配尾部的 APY/APR 单位（大小写不敏感），拆开分别渲染。
const APR_SUFFIX_PATTERN = /^(.*?)\s*(APY|APR)\s*$/i;

type ISizableTextSize = ComponentProps<typeof SizableText>['size'];
type ISizableTextColor = ComponentProps<typeof SizableText>['color'];

export function EarnAprSuffixText({
  text,
  size = '$bodyLgMedium',
  suffixSize = '$bodySmMedium',
  color = '$text',
}: {
  text: string;
  size?: ISizableTextSize;
  suffixSize?: ISizableTextSize;
  color?: ISizableTextColor;
}) {
  const match = text.match(APR_SUFFIX_PATTERN);
  if (!match || !match[1]) {
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
