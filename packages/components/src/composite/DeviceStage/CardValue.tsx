import { useMemo } from 'react';

import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { SizableText } from '../../primitives';

/* The receive page's address grammar, redrawn for the stage card: mono,
 * grouped by four, the first and last six characters highlighted. */
const CARD_GROUP_SIZE = 4;
const CARD_HIGHLIGHT_ENDS = 6;
// bodyMd's metrics on the mono face — the size tokens have no mono
// variants, so the pairing is spelled out.
const CARD_MONO = {
  fontSize: 14,
  lineHeight: 20,
  fontFamily: '$monoMedium',
} as const;

/** The warning value's ink — the stage is committed dark, so the amber
 * is its own, not a theme token (see the card's own inks in ./index). */
const WARN_INK = '#E8B341';

/**
 * A payload card row's value, shared by both stage engines — bodyMd
 * metrics either way. With `highlightEnds` it takes the receive page's
 * address grammar: mono, grouped by four, the first and last six
 * characters highlighted — what the person compares against the device.
 * `warning` inks the value amber (an unlimited allowance).
 */
export function CardValue({
  value,
  highlightEnds,
  warning,
}: {
  value: string;
  highlightEnds?: boolean;
  warning?: boolean;
}) {
  const parts = useMemo(() => {
    if (!highlightEnds || value.length <= CARD_HIGHLIGHT_ENDS * 2) {
      return null;
    }
    const grouped = stringUtils.addSeparatorToString({
      str: value,
      groupSize: CARD_GROUP_SIZE,
      separator: ' ',
    });
    // Original char position -> grouped position (one space per group).
    const pos = (index: number) => index + Math.floor(index / CARD_GROUP_SIZE);
    const leadEnd = pos(CARD_HIGHLIGHT_ENDS);
    const trailStart = pos(value.length - CARD_HIGHLIGHT_ENDS);
    return {
      leading: grouped.slice(0, leadEnd),
      middle: grouped.slice(leadEnd, trailStart),
      trailing: grouped.slice(trailStart),
    };
  }, [highlightEnds, value]);
  if (!parts) {
    // One line only — long raw data truncates; the address grammar
    // below is the one value allowed to wrap (it is the compare
    // artifact, so no character may go missing).
    return (
      <SizableText
        size="$bodyMd"
        color={warning ? WARN_INK : undefined}
        numberOfLines={1}
      >
        {value}
      </SizableText>
    );
  }
  return (
    <SizableText {...CARD_MONO} color="$text">
      <SizableText {...CARD_MONO} color="$textInteractive">
        {parts.leading}
      </SizableText>
      {parts.middle}
      <SizableText {...CARD_MONO} color="$textInteractive">
        {parts.trailing}
      </SizableText>
    </SizableText>
  );
}
