import { useCallback } from 'react';

import {
  Box,
  Center,
  HStack,
  Pressable,
  Text,
  Token,
  Tooltip,
} from '@onekeyhq/components';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import type { INetwork } from '@onekeyhq/engine/src/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../hooks';

function NotSupported() {
  const { allNetworks } = useManageNetworks();
  const { serviceNetwork } = backgroundApiProxy;

  const networkSupported = allNetworks.filter(
    (network) =>
      network?.settings.supportBatchTransfer &&
      (network.impl !== IMPL_EVM ||
        (network.impl === IMPL_EVM &&
          batchTransferContractAddress[network.id])),
  );

  const handleSelecteNetwork = useCallback(
    (network: INetwork) => {
      if (!network.enabled) return;
      serviceNetwork.changeActiveNetwork(network.id);
    },
    [serviceNetwork],
  );

  return (
    <Center>
      <Box maxW="340px">
        <Text fontSize="56px" textAlign="center" mt={8}>
          🤷‍♀️
        </Text>
        <Text typography="DisplayMedium" mt={3} textAlign="center">
          Aptos is not supported yet
        </Text>
        <Text typography="Body1" color="text-subdued" mt={2} textAlign="center">
          Choose a supported network.
        </Text>
        <HStack space={2} mt={6} flexWrap="wrap" justifyContent="center">
          {networkSupported.map((network) => (
            <Tooltip key={network.id} label={network?.name} placement="top">
              <Pressable onPress={() => handleSelecteNetwork(network)}>
                <Box mb={3} opacity={network.enabled ? 1 : 0.7}>
                  <Token
                    position="relative"
                    mb={3}
                    size={8}
                    token={{ logoURI: network?.logoURI }}
                  />
                </Box>
              </Pressable>
            </Tooltip>
          ))}
        </HStack>
      </Box>
    </Center>
  );
}

export { NotSupported };
