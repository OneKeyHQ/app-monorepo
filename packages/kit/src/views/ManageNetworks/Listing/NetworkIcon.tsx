import React, { FC } from 'react';

import { Box, Image, Typography } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

type NetworkIconProps = {
  network: Network;
};

export const NetworkIcon: FC<NetworkIconProps> = ({ network }) =>
  network.preset ? (
    <Image
      alt="logoURI"
      size={{ base: 8, md: 6 }}
      source={{ uri: network.logoURI }}
      mr="3"
    />
  ) : (
    <Box
      mr="3"
      borderRadius="full"
      w={{ base: '8', md: '6' }}
      h={{ base: '8', md: '6' }}
      display="flex"
      justifyContent="center"
      alignItems="center"
      bg="decorative-surface-one"
    >
      <Typography.DisplaySmall numberOfLines={1}>
        {network.name.trim()[0].toUpperCase()}
      </Typography.DisplaySmall>
    </Box>
  );
