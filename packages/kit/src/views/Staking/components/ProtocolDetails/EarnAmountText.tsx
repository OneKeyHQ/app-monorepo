import { useMemo } from 'react';

import { NumberSizeableText, SizableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

type IEarnAmountTextProps = Omit<ISizableTextProps, 'children'> & {
  children: string;
};

// Matches a leading number: integer or decimal, with optional thousands-separator commas
const LEADING_NUMBER_PATTERN = /^(\d[\d,]*(?:\.\d+)?)([\s\S]*)/;

/**
 * Smart text renderer for server-returned amount strings.
 *
 * Handles three data formats from the server:
 *
 * 1. **`<subscripts>` tagged text** (e.g. `"0.0<subscripts>5</subscripts>2948 PT"`)
 *    → delegated to FormatHyperlinkText which already renders subscript tags
 *      with smaller font via react-intl rich text.
 *
 * 2. **Percentages** (e.g. `"1.00%"`, `"0.50%"`)
 *    → rendered as-is via SizableText to preserve server formatting from
 *      toPercentage() which returns fixed 2-decimal percentages.
 *
 * 3. **Raw decimal amounts** (e.g. `"0.000002948"` or `"0.000002948 SY-uniBTC"`)
 *    → the leading number is formatted via NumberSizeableText (formatter="balance")
 *      which handles subscript notation for very small numbers (0.0₅2948),
 *      while any trailing text (token symbol) is rendered as-is.
 *
 * Falls back to plain SizableText when the string does not start with a number.
 */
export function EarnAmountText({
  children: text,
  ...textProps
}: IEarnAmountTextProps) {
  const parsed = useMemo(() => {
    // Case 1: Server returned <subscripts> tagged text (e.g. formatBalance() output)
    if (text.includes('<subscripts>')) {
      return { type: 'subscripts' as const };
    }

    // Case 2: Server returned a percentage (e.g. toPercentage() output like "1.00%")
    if (text.trimEnd().endsWith('%')) {
      return { type: 'passthrough' as const };
    }

    // Case 3: Try to parse as a raw decimal amount with optional suffix
    const match = text.match(LEADING_NUMBER_PATTERN);
    if (!match) {
      return { type: 'passthrough' as const };
    }

    return {
      type: 'number' as const,
      number: match[1].replace(/,/g, ''),
      suffix: match[2],
    };
  }, [text]);

  // Delegate <subscripts> text to FormatHyperlinkText which already
  // renders them with 0.6x font size via its subscripts handler.
  if (parsed.type === 'subscripts') {
    return <FormatHyperlinkText {...textProps}>{text}</FormatHyperlinkText>;
  }

  // Percentages and unrecognized text: render as-is
  if (parsed.type === 'passthrough') {
    return <SizableText {...textProps}>{text}</SizableText>;
  }

  // Pure number without suffix
  if (!parsed.suffix) {
    return (
      <NumberSizeableText {...textProps} formatter="balance">
        {parsed.number}
      </NumberSizeableText>
    );
  }

  // Mixed content (number + suffix like "0.000002948 SY-uniBTC"):
  // render inline — NumberSizeableText for number, plain text for suffix.
  return (
    <SizableText {...textProps}>
      <NumberSizeableText
        size={textProps.size}
        color={textProps.color}
        formatter="balance"
      >
        {parsed.number}
      </NumberSizeableText>
      {parsed.suffix}
    </SizableText>
  );
}
