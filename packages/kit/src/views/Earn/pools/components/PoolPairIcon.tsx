import { Stack } from '@onekeyhq/components';
import type { IStackProps, SizeTokens } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenSize } from '@onekeyhq/kit/src/components/Token/tokenSize';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { getPoolPair } from '../poolsFormat';

type IPoolPairIconSize = 'sm' | 'md' | 'lg' | 'xl';

// Pixel size of each icon, the Token size drawn inside it and the network
// badge, matching the app's token icons of the same size
const SIZES: Record<
  IPoolPairIconSize,
  { px: number; token: ITokenSize; network: SizeTokens }
> = {
  sm: { px: 24, token: 'sm', network: '$3' },
  md: { px: 32, token: 'md', network: '$4' },
  lg: { px: 40, token: 'lg', network: '$4' },
  xl: { px: 48, token: 'xl', network: '$5' },
};

/**
 * Uniswap's pair logo (SplitLogo): one circle, the base token's left half
 * beside the quote token's right half with a 2px gap. The network sits at
 * the bottom right, where the app puts it on token icons.
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
  /** The surface behind the icon, so the network badge reads as cut out */
  ringColor?: string;
} & Omit<IStackProps, 'children'>) {
  const { base, quote } = getPoolPair(pool);
  const { px, token, network } = SIZES[size];
  const half = px / 2 - 1;
  return (
    <Stack w={px} h={px} flexShrink={0} {...rest}>
      <Stack
        position="absolute"
        left={0}
        top={0}
        w={half}
        h={px}
        overflow="hidden"
      >
        <Token size={token} tokenImageUri={base.logoURI} borderRadius="$full" />
      </Stack>
      <Stack
        position="absolute"
        right={0}
        top={0}
        w={half}
        h={px}
        overflow="hidden"
      >
        <Stack position="absolute" right={0} top={0}>
          <Token
            size={token}
            tokenImageUri={quote.logoURI}
            borderRadius="$full"
          />
        </Stack>
      </Stack>
      {showNetwork ? (
        <Stack
          position="absolute"
          right="$-1"
          bottom="$-1"
          p="$0.5"
          bg={ringColor}
          borderRadius="$full"
        >
          <NetworkAvatar networkId={pool.networkId} size={network} />
        </Stack>
      ) : null}
    </Stack>
  );
}
