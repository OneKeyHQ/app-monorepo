import { Anchor, SizableText } from '../../primitives';

import type { IAnchorProps, ISizableTextProps } from '../../primitives';

export interface IAnchorSizableTextProps extends ISizableTextProps {
  anchorRegExp?: RegExp;
  anchorProps?: IAnchorProps;
}

export function AnchorSizableText({
  anchorRegExp = /<url(?:\s+[^>]*?)?>(.*?)<\/url>/g,
  children,
  anchorProps,
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
                target="_blank"
                color="$textInfo"
                {...anchorProps}
                key={partIndex}
                href={hrefMatch?.[1]}
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
