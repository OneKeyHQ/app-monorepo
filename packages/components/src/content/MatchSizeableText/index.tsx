import { useMemo } from 'react';

import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export type IMatchSizeableTextProps = Omit<ISizableTextProps, 'children'> & {
  matchTextStyle?: Omit<ISizableTextProps, 'children'>;
  match?: IFuseResultMatch;
  children: string;
  matchMaxLength?: boolean;
};

const defaultMatchTextStyle: ISizableTextProps = {
  color: '$textInfo',
};

export function MatchSizeableText({
  children,
  match,
  matchMaxLength = true,
  matchTextStyle = defaultMatchTextStyle,
  ...props
}: IMatchSizeableTextProps) {
  const result = useMemo(() => {
    if (match) {
      let currentIndex = 0;
      const strings: { text: string; isMatch: boolean }[] = [];
      let indices = match.indices;
      if (matchMaxLength) {
        const matchIndices = indices.map((m) => ({
          raw: m,
          length: m[1] - m[0],
        }));
        const matchItem = matchIndices
          .sort((a, b) => a.length - b.length)
          .pop();
        indices = matchItem?.raw ? [matchItem.raw] : [];
      }
      for (let index = 0; index < indices.length; index += 1) {
        const item = indices[index];
        const [start, end] = item;
        strings.push({
          text: children.slice(currentIndex, start),
          isMatch: false,
        });
        strings.push({ text: children.slice(start, end + 1), isMatch: true });
        currentIndex = end + 1;
      }
      if (currentIndex !== children.length - 1) {
        strings.push({
          text: children.slice(currentIndex, children.length),
          isMatch: false,
        });
      }
      return strings;
    }
    return children;
  }, [children, match, matchMaxLength]);
  return typeof result === 'string' ? (
    <SizableText {...props}>{result}</SizableText>
  ) : (
    <SizableText {...props}>
      {result.map(({ text, isMatch }, index) => (
        <SizableText
          key={index}
          {...props}
          {...(isMatch ? matchTextStyle : undefined)}
        >
          {text}
        </SizableText>
      ))}
    </SizableText>
  );
}
