import BigNumber from 'bignumber.js';

import { Image, Skeleton, Stack } from '@onekeyhq/components';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';

export function formatTvl(tvl: string | undefined) {
  if (!tvl) {
    return undefined;
  }

  const bn = new BigNumber(tvl);
  if (bn.isNaN()) {
    return tvl;
  }
  if (bn.gte(1e9)) {
    return `$${bn.div(1e9).toFixed(2)}B`;
  }
  if (bn.gte(1e6)) {
    return `$${bn.div(1e6).toFixed(2)}M`;
  }
  if (bn.gte(1e3)) {
    return `$${bn.div(1e3).toFixed(2)}K`;
  }

  return `$${bn.toFixed(2)}`;
}

export function ProtocolImage({
  logoURI,
  networkLogoURI,
}: {
  logoURI?: string;
  networkLogoURI?: string;
}) {
  return (
    <Stack position="relative" w="$9" h="$9" flexShrink={0}>
      {logoURI ? (
        <Image w="$9" h="$9" borderRadius="$2" source={{ uri: logoURI }} />
      ) : (
        <Skeleton w="$9" h="$9" borderRadius="$2" />
      )}
      {networkLogoURI ? (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          bg="$bgApp"
          borderRadius="$full"
        >
          <NetworkAvatarBase size="$4" logoURI={networkLogoURI} />
        </Stack>
      ) : null}
    </Stack>
  );
}
