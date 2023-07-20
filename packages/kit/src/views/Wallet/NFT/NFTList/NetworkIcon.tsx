import type { FC } from 'react';
import { useMemo } from 'react';

import { Box, Image } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import { useActiveWalletAccount, useNetwork } from '../../../../hooks';

export const NFTNetworkIcon: FC<{
  networkId?: string;
}> = ({ networkId }) => {
  const { networkId: activeNetworkId } = useActiveWalletAccount();

  const { network } = useNetwork({
    networkId,
  });

  const networkIcon = useMemo(() => {
    if (!isAllNetworks(activeNetworkId)) {
      return null;
    }
    return network?.logoURI;
  }, [network, activeNetworkId]);
  if (!networkIcon) {
    return null;
  }
  return (
    <Box
      borderWidth="2px"
      borderColor="border-default"
      borderRadius="999px"
      position="absolute"
      right="3"
      bottom="3"
      zIndex="999"
    >
      <Image
        width={4}
        height={4}
        src={networkIcon}
        alt={networkIcon}
        borderRadius="full"
      />
    </Box>
  );
};
