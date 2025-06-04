import type { IHyperlinkTextProps } from '@onekeyhq/kit/src/components/HyperlinkText';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

export function EarnText({
  text,
  color,
  size,
  ...props
}: { text?: IEarnText } & IHyperlinkTextProps) {
  return text ? (
    <FormatHyperlinkText
      color={text.color || color}
      size={text.size || size}
      {...props}
    >
      {text.text}
    </FormatHyperlinkText>
  ) : null;
}
