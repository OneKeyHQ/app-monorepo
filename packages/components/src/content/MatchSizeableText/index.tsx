import { useMemo } from 'react';

import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export type IMatchSizeableTextProps = Omit<ISizableTextProps, 'children'> & {
  matchTextStyle?: Omit<ISizableTextProps, 'children'>;
  match?: IFuseResultMatch;
  children: string;
};

const defaultMatchTextStyle: ISizableTextProps = {
  color: '#0029ff',
};

export function MatchSizeableText({
  children,
  match,
  matchTextStyle = defaultMatchTextStyle,
  ...props
}: IMatchSizeableTextProps) {
  const result = useMemo(() => {
    if (match) {
      let currentIndex = 0;
      const strings: { text: string; isMatch: boolean }[] = [];
      for (let index = 0; index < match.indices.length; index += 1) {
        const item = match.indices[index];
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
  }, [children, match]);
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
