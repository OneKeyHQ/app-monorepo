import type { IHyperlinkTextProps } from '@onekeyhq/kit/src/components/HyperlinkText';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

export function EarnText({
  text,
  ...localTextProps
}: { text?: IEarnText } & IHyperlinkTextProps) {
  const { text: textString, ...remoteTextProps } = text || {};
  return text ? (
    <FormatHyperlinkText {...localTextProps} {...remoteTextProps}>
      {textString}
    </FormatHyperlinkText>
  ) : null;
}
