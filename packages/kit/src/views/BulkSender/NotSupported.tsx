import { useCallback } from 'react';

import { useIntl } from 'react-intl';

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

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useManageNetworks, useNetwork } from '../../hooks';

function NotSupported({ networkId }: { networkId: string }) {
  const { allNetworks } = useManageNetworks();
  const { network } = useNetwork({ networkId });
  const { serviceNetwork } = backgroundApiProxy;
  const intl = useIntl();

  const networkSupported = allNetworks.filter(
    (n) =>
      n.enabled &&
      n?.settings.supportBatchTransfer &&
      (n?.settings.nativeSupportBatchTransfer
        ? true
        : batchTransferContractAddress[n.id]),
  );

  const handleSelecteNetwork = useCallback(
    (n: INetwork) => {
      if (!n.enabled) return;
      serviceNetwork.changeActiveNetwork(n.id);
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
          {intl.formatMessage(
            {
              id: 'title__str_network_is_not_supported_yet',
            },
            {
              chain: network?.name,
            },
          )}
        </Text>
        <Text typography="Body1" color="text-subdued" mt={2} textAlign="center">
          {intl.formatMessage({
            id: 'content__choose_a_supported_network',
          })}
        </Text>
        <HStack space={2} mt={6} flexWrap="wrap" justifyContent="center">
          {networkSupported.map((n) => (
            <Tooltip key={n.id} label={n?.name} placement="top">
              <Pressable onPress={() => handleSelecteNetwork(n)}>
                <Box mb={3}>
                  <Token
                    position="relative"
                    mb={3}
                    size={8}
                    token={{ logoURI: n?.logoURI }}
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
