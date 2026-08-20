import { useMemo } from 'react';

import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { SizableText } from '../../primitives';

/* The receive page's address grammar, redrawn for the stage card: mono,
 * grouped by four, the first and last six characters highlighted. */
const CARD_GROUP_SIZE = 4;
const CARD_HIGHLIGHT_ENDS = 6;
const CARD_MONO = {
  fontSize: 16,
  lineHeight: 24,
  fontFamily: '$monoMedium',
} as const;

/**
 * A payload card row's value, shared by both stage engines. With
 * `highlightEnds` it takes the receive page's address grammar: mono,
 * grouped by four, the first and last six characters highlighted — what
 * the person compares against the device.
 */
export function CardValue({
  value,
  highlightEnds,
}: {
  value: string;
  highlightEnds?: boolean;
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
    return (
      <SizableText fontSize={15} lineHeight={24}>
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
