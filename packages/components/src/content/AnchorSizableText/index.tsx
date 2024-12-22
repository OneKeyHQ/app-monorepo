import { Anchor, SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export interface IAnchorSizableTextProps extends ISizableTextProps {
  anchorRegExp?: RegExp;
  hrefRegExp?: RegExp;
}

export function AnchorSizableText({
  anchorRegExp = /<url(?:\s+[^>]*?)?>(.*?)<\/url>/g,
  hrefRegExp = /href="(.*?)"/,
  children,
  ...props
}: IAnchorSizableTextProps) {
  const line = children as string;
  const isAnchor = anchorRegExp.test(line);
  if (isAnchor) {
    const parts = line.split(anchorRegExp);
    const hrefMatch = line.match(/href="(.*?)"/);
    return (
      <SizableText {...props}>
        {parts.map((part, partIndex) => {
          if (partIndex === 1) {
            return (
              <Anchor
                {...props}
                key={partIndex}
                href={hrefMatch?.[1]}
                target="_blank"
                color="$textInfo"
              >
                {part}
              </Anchor>
            );
          }
          return part;
        })}
      </SizableText>
    );
  }
  return <SizableText {...props}>{line}</SizableText>;
}
