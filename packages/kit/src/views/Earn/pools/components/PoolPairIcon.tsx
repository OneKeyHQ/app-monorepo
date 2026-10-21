import type { CSSProperties } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenSize } from '@onekeyhq/kit/src/components/Token/tokenSize';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { getPoolPair } from '../poolsFormat';

type IPoolPairIconSize = 'sm' | 'md' | 'lg' | 'xl';

// Each logo and the network badge in px, matching the app's token icons of
// the same size, and the Token size that draws the logo
const SIZES: Record<
  IPoolPairIconSize,
  { px: number; token: ITokenSize; network: number }
> = {
  sm: { px: 24, token: 'sm', network: 12 },
  md: { px: 32, token: 'md', network: 16 },
  lg: { px: 40, token: 'lg', network: 16 },
  xl: { px: 48, token: 'xl', network: 20 },
};

// The gap around the front logo and around the network badge
const GAP = 2;
// How far the network badge hangs past the bottom right corner
const BADGE_OUTSET = 4;

// Token sizes shrink on small Android screens, so the geometry scales with them
function getLogoSize(size: IPoolPairIconSize) {
  return s(SIZES[size].px);
}

// Where the quote logo starts: one logo in, less the third the two share
function getQuoteLeft(logo: number) {
  return logo - Math.round(logo / 3);
}

/** The icon's width, for placeholders that hold its place while loading */
export function getPoolPairIconWidth(size: IPoolPairIconSize = 'md') {
  const logo = getLogoSize(size);
  return getQuoteLeft(logo) + logo;
}

// A see-through circle in the masked element; the soft pixel at its edge
// matches the anti-aliased edges of the logos
function getWebHole(x: number, y: number, radius: number): CSSProperties {
  const image = `radial-gradient(circle at ${x}px ${y}px, transparent ${
    radius - 0.5
  }px, #000 ${radius + 0.5}px)`;
  return { WebkitMaskImage: image, maskImage: image };
}

/**
 * Uniswap's stacked pair logo: both logos whole, the base token in front on
 * the left and the quote token behind it on the right. The network sits at
 * the bottom right, where the app puts it on token icons.
 *
 * Web cuts the gaps out of the quote logo, so they show whatever is behind
 * the icon, hovered and pressed rows included. Native has no hover and
 * paints them in ringColor.
 */
export function PoolPairIcon({
  pool,
  size = 'md',
  showNetwork = true,
  ringColor = '$bgApp',
  ...rest
}: {
  pool: IPool;
  size?: IPoolPairIconSize;
  showNetwork?: boolean;
  /** Native only: the surface behind the icon, so the gaps match it */
  ringColor?: string;
} & Omit<IStackProps, 'children'>) {
  const { base, quote } = getPoolPair(pool);
  const { token, network } = SIZES[size];
  const isNative = platformEnv.isNative;
  const logo = getLogoSize(size);
  const quoteLeft = getQuoteLeft(logo);
  const gap = s(GAP);
  const badgeOutset = s(BADGE_OUTSET);
  const badge = s(network) + gap * 2;
  // The badge's centre in the quote logo, which it sits on
  const badgeCenter = logo + badgeOutset - badge / 2;
  return (
    <Stack w={quoteLeft + logo} h={logo} flexShrink={0} {...rest}>
      <Stack
        position="absolute"
        left={quoteLeft}
        top={0}
        w={logo}
        h={logo}
        borderRadius="$full"
        overflow="hidden"
        style={
          isNative
            ? undefined
            : getWebHole(logo / 2 - quoteLeft, logo / 2, logo / 2 + gap)
        }
      >
        <Stack
          style={
            !isNative && showNetwork
              ? getWebHole(badgeCenter, badgeCenter, badge / 2)
              : undefined
          }
        >
          <Token
            size={token}
            tokenImageUri={quote.logoURI}
            borderRadius="$full"
          />
        </Stack>
        {isNative ? (
          <Stack
            position="absolute"
            left={-quoteLeft - gap}
            top={-gap}
            w={logo + gap * 2}
            h={logo + gap * 2}
            borderRadius="$full"
            bg={ringColor}
          />
        ) : null}
      </Stack>
      <Stack position="absolute" left={0} top={0}>
        <Token size={token} tokenImageUri={base.logoURI} borderRadius="$full" />
      </Stack>
      {showNetwork ? (
        <Stack
          position="absolute"
          right={-badgeOutset}
          bottom={-badgeOutset}
          p={gap}
          bg={isNative ? ringColor : undefined}
          borderRadius="$full"
        >
          <NetworkAvatar networkId={pool.networkId} size={s(network)} />
        </Stack>
      ) : null}
    </Stack>
  );
}
