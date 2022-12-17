import type { FC } from 'react';

import { Box, Image, Typography } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

type NetworkIconProps = {
  network: Network;
  size?: number;
  mr?: number;
};

export const NetworkIcon: FC<NetworkIconProps> = ({ network, size, mr }) =>
  network.preset ? (
    <Image
      alt="logoURI"
      size={size ?? { base: 8, md: 6 }}
      source={{ uri: network.logoURI }}
      borderRadius="full"
      mr={mr ?? '3'}
    />
  ) : (
    <Box
      mr="3"
      borderRadius="full"
      w={size ?? { base: '8', md: '6' }}
      h={size ?? { base: '8', md: '6' }}
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
