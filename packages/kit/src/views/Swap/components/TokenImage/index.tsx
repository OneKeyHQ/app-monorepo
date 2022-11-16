import React, { FC } from 'react';

import { Box, NetImage, Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useNetwork } from '../../../../hooks';

type TokenImageProps = {
  token: Token;
};

export const TokenImage: FC<TokenImageProps> = ({ token }) => {
  const { network } = useNetwork({ networkId: token.networkId });
  let networkName = network?.name ?? '';
  if (network?.name && network.name.length > 20) {
    networkName = `${network.name.slice(0, 20)}...`;
  }
  return (
    <Box flexDirection="row" alignItems="center">
      <Box mr="2" borderRadius="full" overflow="hidden">
        <NetImage
          width={8}
          height={8}
          src={token.logoURI}
          bgColor="surface-neutral-default"
        />
      </Box>
      <Box>
        <Typography.Body2Strong color="text-default" fontSize={20}>
          {token.symbol}
        </Typography.Body2Strong>
        <Typography.Body2 fontSize={12} color="text-subdued">
          {networkName}
        </Typography.Body2>
      </Box>
    </Box>
  );
};
