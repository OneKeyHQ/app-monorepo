import { Stack, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { getPoolPair } from '../poolsFormat';

type IPoolPairIconSize = 'sm' | 'md' | 'lg' | 'xl';

const OVERLAP: Record<IPoolPairIconSize, string> = {
  sm: '$-2.5',
  md: '$-3.5',
  lg: '$-4',
  xl: '$-5',
};

/** Base and quote logos, overlapped; the chain badge sits on the quote */
export function PoolPairIcon({
  pool,
  size = 'md',
  showNetwork = false,
  ringColor = '$bgApp',
  ...rest
}: {
  pool: IPool;
  size?: IPoolPairIconSize;
  showNetwork?: boolean;
  ringColor?: string;
} & Omit<IXStackProps, 'children'>) {
  const { base, quote } = getPoolPair(pool);
  return (
    <XStack ai="center" {...rest}>
      <Stack p="$0.5" borderRadius="$full" bg={ringColor}>
        <Token size={size} tokenImageUri={base.logoURI} borderRadius="$full" />
      </Stack>
      <Stack ml={OVERLAP[size]} p="$0.5" borderRadius="$full" bg={ringColor}>
        <Token
          size={size}
          tokenImageUri={quote.logoURI}
          borderRadius="$full"
          networkId={showNetwork ? pool.networkId : undefined}
          showNetworkIcon={showNetwork}
        />
      </Stack>
    </XStack>
  );
}
