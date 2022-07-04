import React, { FC } from 'react';

import { Box, Token } from '@onekeyhq/components';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import { useNetwork } from '../../../../hooks/redux';

type NetworkTokenProps = {
  networkId?: string | null;
  token?: TokenType;
};

const NetworkToken: FC<NetworkTokenProps> = ({ networkId, token }) => {
  const network = useNetwork(networkId ?? null);
  if (!token) {
    return <></>;
  }
  return (
    <Box position="relative">
      <Token size="6" src={token.logoURI} />
      {network ? (
        <Box
          position="absolute"
          right="-4"
          top="-4"
          w="18px"
          h="18px"
          bg="surface-subdued"
          display="flex"
          justifyContent="center"
          alignItems="center"
          borderRadius="full"
        >
          <Token size="4" src={network.logoURI} />
        </Box>
      ) : null}
    </Box>
  );
};

export default NetworkToken;
