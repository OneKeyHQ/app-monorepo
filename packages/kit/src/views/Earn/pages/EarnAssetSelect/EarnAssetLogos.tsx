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

// Where a kind's logos sit in one token logo's square (40), by how many it
// shows: four in a square as the app draws All Networks, three in a
// triangle, two side by side
const KIND_LOGO_PLACES: Record<number, { left: number; top: number }[]> = {
  2: [
    { left: 0, top: 10 },
    { left: 20, top: 10 },
  ],
  3: [
    { left: 0, top: 0 },
    { left: 20, top: 0 },
    { left: 10, top: 20 },
  ],
  4: [
    { left: 0, top: 0 },
    { left: 20, top: 0 },
    { left: 0, top: 20 },
    { left: 20, top: 20 },
  ],
};

/**
 * A whole kind of token in a token logo's place, so its row's logo and name
 * start where every token row's do: its first logos, a little apart
 */
export function EarnAssetKindLogos({ logos }: { logos: string[] }) {
  const shown = logos.slice(0, 4);
  const places = KIND_LOGO_PLACES[shown.length];
  if (!places) {
    return <Token tokenImageUri={shown[0]} />;
  }
  return (
    <Stack w="$10" h="$10" flexShrink={0}>
      {shown.map((uri, index) => (
        <Stack
          key={`${uri}-${index}`}
          position="absolute"
          left={places[index].left}
          top={places[index].top}
          // Each logo a little smaller than its cell, so they don't touch
          scale={0.9}
        >
          <Token size="xs" tokenImageUri={uri} />
        </Stack>
      ))}
    </Stack>
  );
}
