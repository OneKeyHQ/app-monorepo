import { useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';

type IHighlightAddressProps = {
  address: string;
  leadingHighlightCount?: number;
  trailingHighlightCount?: number;
  groupSize?: number;
  variant?: 'grouped' | 'inline';
  size?: ISizableTextProps['size'];
  fontFamily?: ISizableTextProps['fontFamily'];
};

function HighlightAddress({
  address,
  leadingHighlightCount = 6,
  trailingHighlightCount = 6,
  groupSize = 4,
  variant = 'grouped',
  size,
  fontFamily = '$monoMedium',
}: IHighlightAddressProps) {
  const parts = useMemo(() => {
    if (!address) {
      return null;
    }

    const totalLen = address.length;
    const minLength = leadingHighlightCount + trailingHighlightCount;

    if (variant === 'inline') {
      if (totalLen <= minLength) {
        return { leading: address, middle: '', trailing: '' };
      }
      return {
        leading: address.slice(0, leadingHighlightCount),
        middle: address.slice(
          leadingHighlightCount,
          totalLen - trailingHighlightCount,
        ),
        trailing: address.slice(totalLen - trailingHighlightCount),
      };
    }

    // Group the ENTIRE address first to preserve visual rhythm
    const grouped =
      address.match(new RegExp(`.{1,${groupSize}}`, 'g'))?.join(' ') || address;

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
  }, [
    address,
    leadingHighlightCount,
    trailingHighlightCount,
    groupSize,
    variant,
  ]);

  if (!parts) {
    return null;
  }

  const { leading, middle, trailing } = parts;

  if (!middle && !trailing) {
    return (
      <SizableText size={size} fontFamily={fontFamily} color="$textInteractive">
        {leading}
      </SizableText>
    );
  }

  return (
    <SizableText size={size} fontFamily={fontFamily} color="$text">
      <SizableText size={size} fontFamily={fontFamily} color="$textInteractive">
        {leading}
      </SizableText>
      {middle}
      <SizableText size={size} fontFamily={fontFamily} color="$textInteractive">
        {trailing}
      </SizableText>
    </SizableText>
  );
}

export { HighlightAddress };
export type { IHighlightAddressProps };
