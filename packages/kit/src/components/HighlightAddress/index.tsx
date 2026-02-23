import { useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';

type IHighlightAddressProps = {
  address: string;
  leadingHighlightCount?: number;
  trailingHighlightCount?: number;
  groupSize?: number;
};

function HighlightAddress({
  address,
  leadingHighlightCount = 6,
  trailingHighlightCount = 6,
  groupSize = 4,
}: IHighlightAddressProps) {
  const parts = useMemo(() => {
    if (!address) {
      return null;
    }

    // Group the ENTIRE address first to preserve visual rhythm
    const grouped =
      address.match(new RegExp(`.{1,${groupSize}}`, 'g'))?.join(' ') ||
      address;

    const totalLen = address.length;
    const minLength = leadingHighlightCount + trailingHighlightCount;

    if (totalLen <= minLength) {
      return { leading: grouped, middle: '', trailing: '' };
    }

    // Map original char position to grouped string position.
    // A space is inserted every groupSize chars in the grouped string.
    const toGroupedPos = (origPos: number) => {
      if (origPos <= 0) return 0;
      if (origPos >= totalLen) return grouped.length;
      return origPos + Math.floor(origPos / groupSize);
    };

    const leadEnd = toGroupedPos(leadingHighlightCount);
    const trailStart = toGroupedPos(totalLen - trailingHighlightCount);

    return {
      leading: grouped.slice(0, leadEnd),
      middle: grouped.slice(leadEnd, trailStart),
      trailing: grouped.slice(trailStart),
    };
  }, [address, leadingHighlightCount, trailingHighlightCount, groupSize]);

  if (!parts) {
    return null;
  }

  const { leading, middle, trailing } = parts;

  if (!middle && !trailing) {
    return (
      <SizableText fontFamily="$monoMedium" color="$text">
        {leading}
      </SizableText>
    );
  }

  // Nested Text components flow inline in React Native,
  // preserving natural text wrapping behavior.
  return (
    <SizableText fontFamily="$monoRegular" color="$textSubdued">
      <SizableText fontFamily="$monoMedium" color="$text">
        {leading}
      </SizableText>
      {middle}
      <SizableText fontFamily="$monoMedium" color="$text">
        {trailing}
      </SizableText>
    </SizableText>
  );
}

export { HighlightAddress };
export type { IHighlightAddressProps };
