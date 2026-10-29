import type { ColorTokens, IXStackProps } from '@onekeyhq/components';
import { Stack, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';

type ILogoSize = NonNullable<ITokenProps['size']>;

// How far each logo slides under the one before, as the app's token groups
// overlap theirs
const OVERLAP: Partial<Record<ILogoSize, string>> = {
  lg: '$-4',
  md: '$-3.5',
  sm: '$-3',
  xs: '$-2.5',
  xxs: '$-2',
};

/**
 * A kind of token's first three logos, overlapped as the app's token groups
 * draw them: each in a ring of what it sits on. Inside a row that is hovered
 * or picked, the ring takes that color too, so no dark edge shows around a
 * logo
 */
export function EarnAssetLogos({
  logos,
  size = 'sm',
  ringColor = '$bgApp',
  groupHoverRingColor,
  ...rest
}: {
  logos: string[];
  size?: ILogoSize;
  ringColor?: ColorTokens;
  // The row's own hover color, where the row is a group
  groupHoverRingColor?: ColorTokens;
} & Omit<IXStackProps, 'children'>) {
  const shown = logos.slice(0, 3);
  return (
    <XStack ai="center" flexShrink={0} {...rest}>
      {shown.map((uri, index) => (
        <Stack
          key={`${uri}-${index}`}
          p="$0.5"
          borderRadius="$full"
          bg={ringColor}
          ml={index ? OVERLAP[size] : undefined}
          {...(groupHoverRingColor
            ? { '$group-hover': { bg: groupHoverRingColor } }
            : undefined)}
        >
          <Token size={size} tokenImageUri={uri} />
        </Stack>
      ))}
    </XStack>
  );
}
