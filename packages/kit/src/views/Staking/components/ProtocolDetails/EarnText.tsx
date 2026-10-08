import type { IHyperlinkTextProps } from '@onekeyhq/kit/src/components/HyperlinkText';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

export function EarnText({
  text,
  ...localTextProps
}: { text?: IEarnText } & IHyperlinkTextProps) {
  const { text: textString, ...remoteTextProps } = text || {};
  return text ? (
    // Dashboard edits this copy in a textarea, so it can carry real newlines.
    // React Native honours them; the web/desktop DOM collapses them into a
    // space unless white-space says otherwise (OK-61338). Declared before the
    // spreads so a caller can still override it.
    <FormatHyperlinkText
      whiteSpace="pre-line"
      {...localTextProps}
      {...remoteTextProps}
    >
      {textString}
    </FormatHyperlinkText>
  ) : null;
}
