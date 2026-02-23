import { useMemo } from 'react';

import { SizableText } from '@onekeyhq/components';

type IHighlightAddressProps = {
  address: string;
  leadingHighlightCount?: number;
  trailingHighlightCount?: number;
  groupSize?: number;
};

function groupChars(str: string, size: number): string {
  return str.match(new RegExp(`.{1,${size}}`, 'g'))?.join(' ') ?? str;
}

function HighlightAddress({
  address,
  leadingHighlightCount = 6,
  trailingHighlightCount = 6,
  groupSize = 4,
}: IHighlightAddressProps) {
  const segments = useMemo(() => {
    if (!address) {
      return [];
    }
    const minLength = leadingHighlightCount + trailingHighlightCount;
    if (address.length <= minLength) {
      // Address too short to split — render all as highlighted
      return [{ text: groupChars(address, groupSize), highlight: true }];
    }
    const leading = address.slice(0, leadingHighlightCount);
    const middle = address.slice(
      leadingHighlightCount,
      -trailingHighlightCount,
    );
    const trailing = address.slice(-trailingHighlightCount);
    return [
      { text: groupChars(leading, groupSize), highlight: true },
      { text: groupChars(middle, groupSize), highlight: false },
      { text: groupChars(trailing, groupSize), highlight: true },
    ];
  }, [address, leadingHighlightCount, trailingHighlightCount, groupSize]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((segment, index) => (
        <SizableText
          key={index}
          fontFamily={segment.highlight ? '$monoMedium' : '$monoRegular'}
          color={segment.highlight ? '$text' : '$textSubdued'}
        >
          {segment.text}
          {index < segments.length - 1 ? ' ' : ''}
        </SizableText>
      ))}
    </>
  );
}

export { HighlightAddress };
export type { IHighlightAddressProps };
